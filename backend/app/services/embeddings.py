"""
Jina AI Embeddings Service.

Generates vector embeddings for text using Jina's embedding API.
These embeddings are used for semantic search in Pinecone to find
similar past decisions and inject context into agent prompts.

Gracefully degrades if no API key is configured.
"""

import httpx
from typing import List, Optional

from app.config import settings

JINA_EMBED_URL = "https://api.jina.ai/v1/embeddings"
JINA_MODEL = "jina-embeddings-v3"


async def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate a vector embedding for the given text using Jina AI.

    Returns None if the Jina API key is not configured or the request fails,
    allowing the system to operate without vector search.
    """
    if not settings.JINA_API_KEY:
        print("[Embeddings] Jina API key not configured — skipping embedding")
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                JINA_EMBED_URL,
                headers={
                    "Authorization": f"Bearer {settings.JINA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": JINA_MODEL,
                    "input": [text],
                    "task": "retrieval.query",
                },
            )
            response.raise_for_status()
            data = response.json()
            embedding = data["data"][0]["embedding"]
            print(f"[Embeddings] Generated {len(embedding)}-dim vector ✓")
            return embedding
    except Exception as e:
        print(f"[Embeddings] Failed to generate embedding: {e}")
        return None


async def generate_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    Generate embeddings for multiple texts in a single API call.
    Returns a list of embeddings (or None for failures).
    """
    if not settings.JINA_API_KEY:
        return [None] * len(texts)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                JINA_EMBED_URL,
                headers={
                    "Authorization": f"Bearer {settings.JINA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": JINA_MODEL,
                    "input": texts,
                    "task": "retrieval.document",
                },
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]
    except Exception as e:
        print(f"[Embeddings] Batch embedding failed: {e}")
        return [None] * len(texts)
