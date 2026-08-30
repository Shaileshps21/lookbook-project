import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { env } from "../config/env";

/**
 * Voice Search (future.md §3.8) — an audio-to-text front door onto the
 * existing natural-language search. Transcriptions prefer Groq's hosted
 * Whisper-large-v3 when a GROQ_API_KEY is configured (future.md §0); otherwise
 * they fall back to Gemini's inline audio understanding so the feature still
 * works in this environment where the Groq key is currently invalid.
 */

interface GroqTranscriptionResponse {
  text: string;
}

/** Whisper via Groq (`/openai/v1/audio/transcriptions`) — a multipart upload. */
const transcribeWithGroq = async (mimetype: string, buffer: Buffer): Promise<string | null> => {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimetype });
  const ext = (mimetype.split("/")[1] || "webm").replace("x-wav", "wav");
  form.append("file", blob, `audio.${ext}`);
  form.append("model", env.groq.whisperModel);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.groq.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[voice] Groq transcription failed: ${res.status}`);
    return null;
  }
  const body = (await res.json()) as GroqTranscriptionResponse;
  return body.text?.trim() || null;
};

/** Gemini inline audio understanding (`gemini-2.5-flash`) as a fallback. */
const transcribeWithGemini = async (mimetype: string, buffer: Buffer): Promise<string | null> => {
  if (!env.gemini.apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: "Transcribe the speech in this audio clip to plain text. Output ONLY the transcribed text with no added commentary." },
            { inline_data: { mime_type: mimetype, data: buffer.toString("base64") } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[voice] Gemini transcription failed: ${res.status}`);
    return null;
  }
  const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
  return body.candidates?.[0]?.content.parts.map((p) => p.text).join("").trim() || null;
};

/**
 * POST /api/assistant/transcribe — multer audio (webm/wav/mp4/ogg/mpeg) →
 * transcribed text ready to feed into /books/ai-search.
 */
export const transcribeAudio = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const file = req.file;
  if (!file) throw ApiError.badRequest("No audio file provided.");

  const mimetype = file.mimetype || "audio/webm";

  // Primary: Groq Whisper. Fallback: Gemini inline audio.
  const text = env.groq.apiKey
    ? (await transcribeWithGroq(mimetype, file.buffer)) ?? (await transcribeWithGemini(mimetype, file.buffer))
    : await transcribeWithGemini(mimetype, file.buffer);

  if (!text) {
    throw ApiError.badRequest(
      "Couldn't transcribe that audio. Voice transcription isn't configured on this server, or the clip was unintelligible. Please try speaking again or type your search."
    );
  }

  return ApiResponse.ok(res, { text }, "Audio transcribed");
});