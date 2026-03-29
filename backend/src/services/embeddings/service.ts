import OpenAI from "openai";

import { env } from "../../config/env.js";

const openAiClient =
  env.EMBEDDING_PROVIDER === "openai" && env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function hashToken(token: string, dimension: number): number {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }

  return hash % dimension;
}

function localEmbedding(text: string, dimension = 128): number[] {
  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const bucket = hashToken(token, dimension);
    vector[bucket] += Math.min(3, token.length / 4);
  }

  return normalizeVector(vector);
}

export async function embedText(text: string): Promise<number[]> {
  if (!openAiClient) {
    return localEmbedding(text);
  }

  try {
    const response = await openAiClient.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0]?.embedding ?? localEmbedding(text);
  } catch (error) {
    console.warn("OpenAI embeddings failed, falling back to local embeddings");
    console.warn(error);
    return localEmbedding(text);
  }
}
