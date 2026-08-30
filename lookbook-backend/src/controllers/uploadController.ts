import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { cloudinary, cloudinaryConfigured } from "../config/cloudinary";

interface CoverQualityResult {
  clear: boolean;
  reason: string;
}

/**
 * Checks whether an uploaded image is a usable book cover (future.md §3.7).
 * Runs before Cloudinary upload to reject blurry/unrelated photos early,
 * saving storage space and improving the seller experience.
 * Returns null if AI is unavailable — defaults to accepting the upload.
 */
const checkCoverQuality = async (dataUri: string): Promise<CoverQualityResult | null> => {
  try {
    // Convert data URI to a temporary public URL isn't possible here, so
    // we pass the base64 data directly. generateVisionJson fetches from a URL,
    // so for the quality check we use a direct Gemini call with inline data.
    const { env } = await import("../config/env");
    if (!env.gemini.apiKey) return null;

    const base64Match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) return null;
    const [, mimeType, base64Data] = base64Match;

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.gemini.apiKey}`;
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Is this a clear, in-focus photo of a book cover or a book\'s spine? Answer with ONLY valid JSON, no markdown fences:\n{"clear": boolean, "reason": string (one short sentence explaining why)}',
              },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
    const text = body.candidates?.[0]?.content.parts.map((p) => p.text).join("");
    if (!text) return null;
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as CoverQualityResult;
  } catch {
    return null;
  }
};

/**
 * Routes user-uploaded imagery (book covers, listing photos) through
 * Cloudinary for optimization, responsive delivery, and CDN caching.
 * Includes an AI cover quality check (§3.7) — poor-quality images are
 * rejected before upload with the model's stated reason shown to the user.
 */
export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!cloudinaryConfigured) {
    throw ApiError.badRequest(
      "Image uploads aren't available right now. The admin needs to configure Cloudinary credentials. " +
      "You can still submit the listing without photos."
    );
  }

  const file = req.file;
  if (!file) throw ApiError.badRequest("No image file provided.");

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  // AI Cover Quality Check (§3.7) — runs before upload to catch bad images early
  const skipQualityCheck = req.query.skipQualityCheck === "true";
  if (!skipQualityCheck) {
    const quality = await checkCoverQuality(dataUri);
    if (quality && !quality.clear) {
      throw ApiError.badRequest(
        `Photo quality check failed: ${quality.reason} Please upload a clearer, in-focus photo of the book cover.`
      );
    }
  }

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "lookbook",
    resource_type: "image",
    transformation: [{ width: 1200, height: 1200, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
  });

  return ApiResponse.created(res, { url: result.secure_url }, "Image uploaded");
});
