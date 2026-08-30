import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Loader2, BookOpen } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../services/apiClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/** Streams the assistant reply over SSE, yielding incremental text chunks. */
const streamChat = async (
  history: { role: "user" | "assistant"; content: string }[],
  onDelta: (text: string) => void
): Promise<string> => {
  const res = await fetch(`${API_URL}/assistant/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ messages: history }),
  });
  if (!res.ok || !res.body) {
    throw new Error("Couldn't start the AI response.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { message?: string; text?: string };
      if (parsed.text) {
        full += parsed.text;
        onDelta(parsed.text);
      } else if (parsed.message && !full) {
        // Some providers/backends emit the complete reply only in the final
        // "done" event — surface it if nothing has been streamed yet.
        full += parsed.message;
        onDelta(parsed.message);
      }
    } catch {
      // ignore malformed sse line
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const split = buffer.split("\n");
    buffer = split.pop() ?? "";
    for (const line of split) handleLine(line);
  }
  if (buffer) handleLine(buffer);
  return full;
};

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
);

const SUGGESTED_PROMPTS = [
  "What are my active rentals?",
  "Find me a mystery book under ₹200",
  "Show my recent orders",
  "Recommend a good book",
];

const ChatAssistant = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounterRef = useRef(1);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    setInput("");
    setError("");

    const userMessage: Message = {
      id: String(idCounterRef.current++),
      role: "user",
      content: messageText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Build conversation history (welcome message isn't stored in state)
      const history = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

      const assistantId = String(idCounterRef.current++);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      await streamChat(history, (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
        );
      });
    } catch {
      setError("Couldn't get a response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Only show for logged-in users
  if (!user) return null;

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        id="chat-assistant-trigger"
        aria-label="Open AI Chat Assistant"
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageCircle size={22} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="chat-assistant-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl shadow-slate-900/15 border border-amber-100 flex flex-col overflow-hidden"
            style={{ maxHeight: "min(600px, calc(100vh - 7rem))" }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">LookBook Assistant</p>
                <p className="text-white/80 text-xs">AI-powered · Always here to help</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFFDF8]">
              {messages.length === 0 && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-amber-600" />
                  </div>
                  <div
                    className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-white text-slate-700 border border-amber-100 shadow-sm rounded-bl-md"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {`Hi ${user?.name?.split(" ")[0] ?? "there"}! 👋 I'm your LookBook Assistant. I can help you find books, check your rentals and orders, or answer questions about the platform. What can I help you with?`}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} className="text-amber-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-amber-500 text-white rounded-br-md"
                        : "bg-white text-slate-700 border border-amber-100 shadow-sm rounded-bl-md"
                    }`}
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-slate-600" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-amber-600" />
                  </div>
                  <div className="bg-white border border-amber-100 shadow-sm rounded-2xl rounded-bl-md">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-500 text-center py-1">{error}</p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts (only when no conversation yet) */}
            {messages.length === 0 && !loading && (
              <div className="px-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1.5 hover:bg-amber-100 transition whitespace-nowrap"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-amber-100 p-3 bg-white">
              <div className="flex gap-2 items-center bg-slate-50 rounded-2xl border border-slate-200 px-4 py-2 focus-within:border-amber-400 focus-within:bg-white transition-all">
                <input
                  ref={inputRef}
                  id="chat-assistant-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about books, rentals..."
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 text-white flex items-center justify-center transition-colors shrink-0"
                  aria-label="Send message"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatAssistant;
