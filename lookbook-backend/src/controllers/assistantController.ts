import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { env } from "../config/env";
import { Order } from "../models/Order";
import { Book } from "../models/Book";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BookSearchTool {
  name: "searchBooks";
  args: { query: string; limit?: number };
}

interface OrderStatusTool {
  name: "getOrderStatus";
  args: { orderId?: string };
}

interface ActiveRentalsTool {
  name: "getActiveRentals";
  args: Record<string, never>;
}

type ToolCall = BookSearchTool | OrderStatusTool | ActiveRentalsTool;

// Simple regex to detect tool-call JSON in the model's response
const TOOL_CALL_RE = /```tool\s*(\{[\s\S]*?\})\s*```/;

// The tool fence is delimited by a fenced code block tagged "tool". Pass-one
// text is streamed live except for anything inside such a block — the raw JSON
// is never surfaced (only the cleaned follow-up reply is).
const TOOL_OPEN = "```tool";
const TOOL_CLOSE = "```";

/** Longest suffix of `s` that is a prefix of the tool-fence opener — i.e. how
 *  many trailing chars might still turn into "\`\`\`tool" if the next network
 *  chunk continues them (e.g. "\`\`\`to" + "ol"). Those chars are held back
 *  from the SSE stream until we know the marker isn't forming. */
const fenceHoldBack = (s: string): number => {
  const max = Math.min(s.length, TOOL_OPEN.length);
  for (let len = max; len >= 1; len--) {
    if (TOOL_OPEN.startsWith(s.slice(s.length - len))) return len;
  }
  return 0;
};

/** Strips completed tool-call blocks and any trailing (unclosed) tool fence so
 *  a reply's raw JSON never leaks into the final message. */
const cleanReply = (s: string): string =>
  s
    .replace(TOOL_CALL_RE, "")
    .replace(/```tool[\s\S]*$/, "")
    .trim();

const executeToolCall = async (toolCall: ToolCall, userId: string): Promise<string> => {
  if (toolCall.name === "searchBooks") {
    const books = await Book.find({
      $text: { $search: toolCall.args.query },
    })
      .limit(toolCall.args.limit ?? 5)
      .select("title author rentPrice buyPrice category rating");
    if (books.length === 0) return "No books found matching that query.";
    return books
      .map((b) => `• "${b.title}" by ${b.author} — Rent: ₹${b.rentPrice}, Buy: ₹${b.buyPrice} (${b.category})`)
      .join("\n");
  }

  if (toolCall.name === "getOrderStatus") {
    const filter: Record<string, unknown> = { user: userId };
    if (toolCall.args.orderId) filter._id = toolCall.args.orderId;
    const orders = await Order.find(filter)
      .sort("-createdAt")
      .limit(3)
      .populate("items.book", "title");
    if (orders.length === 0) return "No orders found.";
    return orders
      .map((o) => {
        const items = o.items
          .map((i) => {
            const book = i.book as unknown as { title?: string };
            return `"${book?.title ?? "Unknown"}" (${i.mode})`;
          })
          .join(", ");
        return `Order #${o.id.slice(-6).toUpperCase()} — ${items} — Status: ${o.status}, Payment: ${o.paymentStatus}`;
      })
      .join("\n");
  }

  if (toolCall.name === "getActiveRentals") {
    const now = new Date();
    const orders = await Order.find({
      user: userId,
      "items.mode": "rent",
      "items.returnedAt": null,
      "items.dueDate": { $exists: true },
    })
      .sort("items.dueDate")
      .limit(10)
      .populate("items.book", "title");

    const activeRentals = orders.flatMap((o) =>
      o.items
        .filter((i) => i.mode === "rent" && !i.returnedAt && i.dueDate)
        .map((i) => {
          const book = i.book as unknown as { title?: string };
          const due = new Date(i.dueDate!);
          const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
          const status = daysLeft < 0 ? `OVERDUE by ${Math.abs(daysLeft)} days` : `${daysLeft} days left`;
          return `• "${book?.title ?? "Unknown"}" — Due: ${due.toDateString()} (${status})`;
        })
    );

    if (activeRentals.length === 0) return "You have no active rentals.";
    return activeRentals.join("\n");
  }

  return "Unknown tool.";
};

const buildSystemPrompt = (userName: string): string => `You are LookBook Assistant, a helpful AI for the LookBook book rental and selling platform. You help users find books, check their rentals and orders, and answer questions about the platform.

User's name: ${userName}

You have access to these tools. Call them by responding with a code block tagged \`\`\`tool followed by JSON:
- searchBooks: { "name": "searchBooks", "args": { "query": "search text", "limit": 5 } }
- getOrderStatus: { "name": "getOrderStatus", "args": {} }
- getActiveRentals: { "name": "getActiveRentals", "args": {} }

Rules:
1. Be friendly, concise, and helpful.
2. Only use tools when genuinely needed to answer the question.
3. For state-changing actions (renewing, cancelling), always tell the user to go to their Profile page instead of attempting it yourself.
4. If you don't know something, say so clearly.
5. Always respond in plain text after processing tool results — never expose raw JSON to the user.`;

/**
 * AI Chat Assistant (future.md §3.3) — Gemini-backed chat with tool-calling
 * for book search and order/rental status lookup.
 */
export const chat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!env.gemini.apiKey) {
    throw ApiError.badRequest("The AI assistant is not configured on this server.");
  }

  const { messages } = req.body as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    throw ApiError.badRequest("Please provide a messages array.");
  }
  if (messages.length > 20) {
    throw ApiError.badRequest("Message history is too long. Please start a new conversation.");
  }

  const systemPrompt = buildSystemPrompt(req.user.name);

  // Build Gemini contents array from the conversation history
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.gemini.apiKey}`;

  const geminiRes = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.warn(`[assistant] Gemini error ${geminiRes.status}: ${errText}`);
    throw ApiError.badRequest("The AI assistant is temporarily unavailable. Please try again shortly.");
  }

  const body = (await geminiRes.json()) as {
    candidates?: { content: { parts: { text: string }[] } }[];
  };
  let responseText = body.candidates?.[0]?.content.parts.map((p) => p.text).join("") ?? "";

  // Check for a tool call in the response and execute it
  const toolMatch = responseText.match(TOOL_CALL_RE);
  if (toolMatch) {
    try {
      const toolCall = JSON.parse(toolMatch[1]) as ToolCall;
      const toolResult = await executeToolCall(toolCall, req.user.id);

      // Feed the tool result back to Gemini for a final natural-language reply
      const followupContents = [
        ...contents,
        { role: "model", parts: [{ text: responseText }] },
        { role: "user", parts: [{ text: `Tool result for ${toolCall.name}:\n${toolResult}` }] },
      ];

      const followupRes = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: followupContents,
        }),
      });

      if (followupRes.ok) {
        const followupBody = (await followupRes.json()) as {
          candidates?: { content: { parts: { text: string }[] } }[];
        };
        responseText =
          followupBody.candidates?.[0]?.content.parts.map((p) => p.text).join("") ?? responseText;
      }
    } catch {
      // If tool execution fails, return the original response (it might still be useful)
    }
    // Strip the raw tool call block from the final user-facing response
    responseText = responseText.replace(TOOL_CALL_RE, "").trim();
  }

  return ApiResponse.ok(res, { message: responseText }, "Chat response generated");
});

/**
 * Streaming helper for chat() (future.md §3.3 #4) — async generator over
 * Gemini's `streamGenerateContent?alt=sse` output that yields text deltas.
 * Uses the readable stream's native async iterator (no manual read loop) and
 * carries partially-received SSE lines across network chunk boundaries —
 * dropping a split line used to truncate large tool-call JSON blobs.
 */
const streamGemini = async function* (
  model: string,
  body: Record<string, unknown>
): AsyncGenerator<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.warn(`[assistant] Gemini stream error ${res.status}: ${errText}`);
    throw ApiError.badRequest("The AI assistant is temporarily unavailable. Please try again shortly.");
  }

  const stream = res.body;
  if (!stream) return;

  let carry = "";
  for await (const raw of stream as unknown as AsyncIterable<Uint8Array>) {
    carry += new TextDecoder().decode(raw);
    const lines = carry.split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as { candidates?: { content: { parts: { text: string }[] } }[] };
        const delta = parsed.candidates?.[0]?.content.parts.map((p) => p.text).join("") ?? "";
        if (delta) yield delta;
      } catch {
        // skip malformed sse line
      }
    }
  }
};

const writeSse = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export const chatStream = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!env.gemini.apiKey) {
    throw ApiError.badRequest("The AI assistant is not configured on this server.");
  }

  const { messages } = req.body as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    throw ApiError.badRequest("Please provide a messages array.");
  }

  const systemPrompt = buildSystemPrompt(req.user.name);
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const requestBody = { system_instruction: { parts: [{ text: systemPrompt }] }, contents };

    // Single pass: consume Gemini's async generator, streaming every delta as
    // it arrives except the tool fence — suppressed until it closes, executed,
    // then followed up with a streamed natural-language reply.
    let earned = "";
    let emitted = 0;
    let handledTool = false;
    let followUpText = "";

    for await (const delta of streamGemini("gemini-2.5-flash", requestBody)) {
      earned += delta;

      const open = earned.indexOf(TOOL_OPEN, emitted);
      if (open === -1) {
        // No fence yet — stream everything except trailing chars that could
        // still become a fence opener on the next chunk.
        const hold = fenceHoldBack(earned.slice(emitted));
        const safeEnd = earned.length - hold;
        if (safeEnd > emitted) {
          writeSse(res, "delta", { text: earned.slice(emitted, safeEnd) });
          emitted = safeEnd;
        }
        continue;
      }

      // A complete tool opener formed at `open` — drop all pass-one text from
      // there on; the fence content must never surface.
      if (open > emitted) {
        writeSse(res, "delta", { text: earned.slice(emitted, open) });
      }
      emitted = open;

      const close = earned.indexOf(TOOL_CLOSE, open + TOOL_OPEN.length);
      if (close === -1) continue; // fence still streaming in

      emitted = close + TOOL_CLOSE.length;
      if (handledTool) break; // only ever execute the first tool call

      const region = earned.slice(open, close + TOOL_CLOSE.length);
      const match = TOOL_CALL_RE.exec(region);
      if (match) {
        try {
          const toolCall = JSON.parse(match[1]) as ToolCall;
          const toolResult = await executeToolCall(toolCall, req.user.id);
          writeSse(res, "tool", { name: toolCall.name, result: toolResult });
          handledTool = true;

          const followupContents = [
            ...contents,
            { role: "model", parts: [{ text: earned }] },
            { role: "user", parts: [{ text: `Tool result for ${toolCall.name}:\n${toolResult}` }] },
          ];
          for await (const fd of streamGemini("gemini-2.5-flash", {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: followupContents,
          })) {
            followUpText += fd;
            writeSse(res, "delta", { text: fd });
          }
        } catch {
          // Tool execution failed — the clean pass-one text already streamed
          // still displays.
        }
      }
      break; // post-fence pass-one commentary would duplicate the follow-up
    }

    // Anything fenceHoldBack held back can't be an opener now that the stream
    // ended — emit it, unless a tool path already produced the reply.
    if (!handledTool && emitted < earned.length) {
      const tail = earned.slice(emitted);
      if (!tail.includes(TOOL_OPEN)) {
        writeSse(res, "delta", { text: tail });
      }
    }

    writeSse(res, "done", { message: handledTool ? followUpText : cleanReply(earned) });
    res.end();
  } catch (err) {
    writeSse(res, "error", { message: err instanceof Error ? err.message : "Assistant failed." });
    res.end();
  }
});
