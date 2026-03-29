"""
MongoDB connection and CRUD operations using Motor (async driver).
Handles connection lifecycle and all database interactions for decisions.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from typing import Optional, List

from app.config import settings

# Module-level client reference — initialized in lifespan
_client: Optional[AsyncIOMotorClient] = None
_db = None


async def connect():
    """Initialize MongoDB connection. Called during app startup."""
    global _client, _db
    try:
        _client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=3000,
        )
        # Force a connection attempt to verify connectivity
        await _client.admin.command("ping")
        _db = _client[settings.MONGODB_DB]
        # Ensure indexes
        await _db.decisions.create_index("created_at", background=True)
        print(f"[DB] Connected to MongoDB: {settings.MONGODB_DB}")
    except Exception as e:
        print(f"[DB] MongoDB unavailable: {e}")
        print("[DB] Running in degraded mode — database features disabled")
        _client = None
        _db = None


async def disconnect():
    """Close MongoDB connection. Called during app shutdown."""
    global _client
    if _client:
        _client.close()
        print("[DB] MongoDB disconnected")


def get_db():
    """Get the database reference."""
    return _db


async def insert_decision(decision_data: dict) -> str:
    """
    Insert a new decision document into MongoDB.
    Returns the inserted document's string ID.
    """
    if _db is None:
        import uuid
        return str(uuid.uuid4())
    decision_data["created_at"] = datetime.utcnow()
    result = await _db.decisions.insert_one(decision_data)
    return str(result.inserted_id)


async def get_decision(decision_id: str) -> Optional[dict]:
    """Retrieve a single decision by its ObjectId."""
    if _db is None:
        return None
    try:
        doc = await _db.decisions.find_one({"_id": ObjectId(decision_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc
    except Exception:
        return None


async def update_feedback(decision_id: str, result: str) -> bool:
    """
    Update a decision with user feedback (worked / didnt_work).
    Returns True if the document was found and updated.
    """
    if _db is None:
        return False
    try:
        res = await _db.decisions.update_one(
            {"_id": ObjectId(decision_id)},
            {"$set": {
                "feedback": {
                    "result": result,
                    "given_at": datetime.utcnow()
                }
            }}
        )
        return res.modified_count > 0
    except Exception:
        return False


async def get_history(limit: int = 50) -> List[dict]:
    """
    Retrieve recent decisions, newest first.
    Returns lightweight history items (no full agent analyses).
    """
    if _db is None:
        return []
    cursor = _db.decisions.find(
        {},
        {
            "prompt": 1,
            "synthesis.verdict": 1,
            "synthesis.confidence": 1,
            "feedback": 1,
            "created_at": 1,
        }
    ).sort("created_at", -1).limit(limit)

    results = []
    async for doc in cursor:
        results.append({
            "id": str(doc["_id"]),
            "prompt": doc["prompt"],
            "verdict": doc.get("synthesis", {}).get("verdict", ""),
            "confidence": doc.get("synthesis", {}).get("confidence", 0),
            "feedback": doc.get("feedback"),
            "created_at": doc.get("created_at", datetime.utcnow()).isoformat(),
        })
    return results
