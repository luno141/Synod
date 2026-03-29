import { ChromaClient } from "chromadb";

import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import type { MemorySnippet } from "../agents/types.js";

let collectionPromise:
  | Promise<Awaited<ReturnType<ChromaClient["getOrCreateCollection"]>>>
  | null = null;
let chromaAvailable = false;

async function getCollection() {
  if (!env.CHROMA_URL) {
    throw new Error("Chroma URL not configured");
  }

  if (!collectionPromise) {
    const client = new ChromaClient({
      path: env.CHROMA_URL,
    });

    collectionPromise = client.getOrCreateCollection({
      name: env.CHROMA_COLLECTION,
      metadata: {
        "hnsw:space": "cosine",
      },
    });
  }

  return collectionPromise;
}

function safeMetadataValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return JSON.stringify(value);
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export async function initializeMemoryStore() {
  if (!env.CHROMA_URL) {
    console.log("[Memory] Postgres-backed semantic memory enabled");
    return;
  }

  try {
    await getCollection();
    chromaAvailable = true;
    console.log(`[Memory] Chroma ready at ${env.CHROMA_URL}`);
  } catch (error) {
    chromaAvailable = false;
    console.warn("[Memory] Chroma unavailable, continuing with Postgres-backed semantic memory");
  }
}

export async function upsertMemoryRecord({
  vectorId,
  content,
  embedding,
  metadata,
}: {
  vectorId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}) {
  if (!chromaAvailable) {
    return;
  }

  try {
    const collection = await getCollection();
    await collection.upsert({
      ids: [vectorId],
      documents: [content],
      embeddings: [embedding],
      metadatas: [
        Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, safeMetadataValue(value)]),
        ),
      ],
    });
  } catch (error) {
    console.warn("[Memory] Failed to mirror semantic memory into Chroma");
  }
}

export async function queryRelevantMemories({
  userId,
  embedding,
  limit = 4,
}: {
  userId: string;
  embedding: number[];
  limit?: number;
}): Promise<MemorySnippet[]> {
  const records = await prisma.memoryEmbedding.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      vectorId: true,
      content: true,
      sourceType: true,
      metadata: true,
    },
  });

  const ranked = records
    .map((record) => {
      const metadata = (record.metadata ?? {}) as Record<string, unknown>;
      const storedEmbedding = Array.isArray(metadata.embedding)
        ? metadata.embedding
            .map((value) => (typeof value === "number" ? value : Number(value)))
            .filter((value) => Number.isFinite(value))
        : [];
      const similarity = Number(
        cosineSimilarity(storedEmbedding, embedding).toFixed(3),
      );

      return {
        vectorId: record.vectorId,
        content: record.content,
        similarity,
        sourceType: record.sourceType,
        feedbackResult:
          metadata.feedback_result === undefined
            ? undefined
            : String(metadata.feedback_result),
      };
    })
    .filter((record) => record.similarity > 0.18)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);

  if (ranked.length > 0 || !chromaAvailable) {
    return ranked;
  }

  try {
    const collection = await getCollection();
    const result = await collection.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      where: {
        user_id: userId,
      },
    });

    const ids = result.ids[0] ?? [];
    const documents = result.documents[0] ?? [];
    const metadatas = result.metadatas?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];

    return ids.map((vectorId, index) => {
      const distance = typeof distances[index] === "number" ? distances[index] : 1;
      const similarity = Number((1 - distance).toFixed(3));
      const metadata = (metadatas[index] ?? {}) as Record<string, unknown>;

      return {
        vectorId,
        content: documents[index] ?? "",
        similarity,
        sourceType: String(metadata.source_type ?? "session"),
        feedbackResult:
          metadata.feedback_result === "" ? undefined : String(metadata.feedback_result),
      };
    });
  } catch (error) {
    console.warn("[Memory] Failed to query Chroma mirror");
    return [];
  }
}
