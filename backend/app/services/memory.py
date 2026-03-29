"""
Pinecone Vector Memory Service.

Stores and retrieves decision embeddings for context-aware recommendations.
When a user asks a new question, we find similar past decisions and inject
their outcomes into agent prompts — creating a feedback-driven learning loop.

Gracefully degrades if Pinecone is not configured.
"""

from typing import List, Optional, Dict
from app.config import settings
from app.services.embeddings import generate_embedding

# Module-level index reference
_index = None


async def init_pinecone():
    """Initialize Pinecone connection. Called during app startup."""
    global _index
    if not settings.PINECONE_API_KEY:
        print("[Memory] Pinecone API key not configured — memory disabled")
        return

    try:
        from pinecone import Pinecone

        pc = Pinecone(api_key=settings.PINECONE_API_KEY)

        # Check if the index exists; if not, create it
        existing = [idx.name for idx in pc.list_indexes()]
        if settings.PINECONE_INDEX not in existing:
            from pinecone import ServerlessSpec
            pc.create_index(
                name=settings.PINECONE_INDEX,
                dimension=1024,  # Jina v3 default dimension
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            print(f"[Memory] Created Pinecone index: {settings.PINECONE_INDEX}")

        _index = pc.Index(settings.PINECONE_INDEX)
        print(f"[Memory] Connected to Pinecone index: {settings.PINECONE_INDEX} ✓")
    except Exception as e:
        print(f"[Memory] Failed to initialize Pinecone: {e}")
        _index = None


async def store_decision(
    decision_id: str,
    prompt: str,
    verdict: str,
    confidence: int,
    feedback: Optional[str] = None,
) -> bool:
    """
    Store a decision's embedding in Pinecone for future retrieval.

    Metadata includes the prompt, verdict, confidence, and feedback status,
    enabling rich context injection into agent prompts.
    """
    if _index is None:
        return False

    embedding = await generate_embedding(prompt)
    if embedding is None:
        return False

    try:
        metadata = {
            "prompt": prompt[:500],  # Pinecone metadata size limit
            "verdict": verdict[:500],
            "confidence": confidence,
        }
        if feedback:
            metadata["feedback"] = feedback

        _index.upsert(vectors=[{
            "id": decision_id,
            "values": embedding,
            "metadata": metadata,
        }])
        print(f"[Memory] Stored decision {decision_id} in Pinecone ✓")
        return True
    except Exception as e:
        print(f"[Memory] Failed to store decision: {e}")
        return False


async def find_similar_decisions(
    prompt: str,
    top_k: int = 3,
) -> List[Dict]:
    """
    Find past decisions similar to the given prompt.

    Returns a list of metadata dicts from the most similar decisions,
    which can be injected into agent prompts as historical context.
    """
    if _index is None:
        return []

    embedding = await generate_embedding(prompt)
    if embedding is None:
        return []

    try:
        results = _index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
        )

        similar = []
        for match in results.get("matches", []):
            if match["score"] > 0.7:  # Only include reasonably similar matches
                similar.append({
                    "prompt": match["metadata"].get("prompt", ""),
                    "verdict": match["metadata"].get("verdict", ""),
                    "confidence": match["metadata"].get("confidence", 0),
                    "feedback": match["metadata"].get("feedback"),
                    "similarity": round(match["score"], 3),
                })

        print(f"[Memory] Found {len(similar)} similar past decisions")
        return similar
    except Exception as e:
        print(f"[Memory] Failed to query similar decisions: {e}")
        return []
