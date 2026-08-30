import { env } from "../config/env";

const EMBED_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${env.gemini.apiKey}`;

/** Generates a single embedding vector for the given text via Gemini. */
export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  if (!env.gemini.apiKey) return null;

  try {
    const res = await fetch(EMBED_URL(env.gemini.embeddingModel), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: env.gemini.embeddingDimensions,
      }),
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[embeddings] Gemini request failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const body = (await res.json()) as { embedding?: { values: number[] } };
    return body.embedding?.values ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[embeddings] Failed to generate embedding:", err);
    return null;
  }
};

export const bookEmbeddingText = (book: {
  title: string;
  author: string;
  description: string;
  tags?: string[];
  category: string;
}) => `${book.title} by ${book.author}. Category: ${book.category}. ${book.description} Tags: ${(book.tags ?? []).join(", ")}`;

export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const averageVectors = (vectors: number[][]): number[] | null => {
  if (vectors.length === 0) return null;
  const length = vectors[0].length;
  const sum = new Array(length).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < length; i++) sum[i] += vec[i];
  }
  return sum.map((v) => v / vectors.length);
};
