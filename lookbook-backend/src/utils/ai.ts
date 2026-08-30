import { env } from "../config/env";

// future.md §0 designates Groq for chat/vision text tasks. The configured
// GROQ_API_KEY currently returns 401 (invalid) from Groq's own API — that's
// a credential issue only the user can fix (regenerate at console.groq.com).
// Every AI feature below runs on Gemini instead so it actually works today;
// swapping back once Groq is fixed only means changing generateText/
// generateVisionJson's implementation, not any of their call sites.
const GEMINI_TEXT_MODEL = env.gemini.textModel;

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.gemini.apiKey}`;

/** Plain text-in, text-out generation. */
export const generateText = async (prompt: string): Promise<string | null> => {
  if (!env.gemini.apiKey) return null;
  try {
    const res = await fetch(GEMINI_URL(GEMINI_TEXT_MODEL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[ai] generateText failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
    return body.candidates?.[0]?.content.parts.map((p) => p.text).join("") ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ai] generateText error:", err);
    return null;
  }
};

/** Prompts for strict JSON and parses it. `schemaHint` is just prompt text describing the expected shape. */
export const generateJson = async <T>(prompt: string, schemaHint: string): Promise<T | null> => {
  const text = await generateText(
    `${prompt}\n\nRespond with ONLY valid JSON matching this shape, no markdown fences, no commentary:\n${schemaHint}`
  );
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
};

/** Vision input (image URL + prompt) → parsed JSON response. */
export const generateVisionJson = async <T>(imageUrl: string, prompt: string, schemaHint: string): Promise<T | null> => {
  if (!env.gemini.apiKey) return null;
  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return null;
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const mimeType = imageRes.headers.get("content-type") ?? "image/jpeg";

    const res = await fetch(GEMINI_URL(GEMINI_TEXT_MODEL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${prompt}\n\nRespond with ONLY valid JSON matching this shape, no markdown fences:\n${schemaHint}` },
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[ai] generateVisionJson failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
    const text = body.candidates?.[0]?.content.parts.map((p) => p.text).join("");
    if (!text) return null;
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ai] generateVisionJson error:", err);
    return null;
  }
};
