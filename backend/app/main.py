"""
Synod Backend — FastAPI Application Entry Point

Multi-Agent Decision Intelligence Platform.
This app orchestrates multiple AI expert agents to analyze decisions
and produce structured recommendations.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.mongo import connect as db_connect, disconnect as db_disconnect
from app.services.memory import init_pinecone
from app.routes.decisions import router as decisions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager:
    - Startup: Connect to MongoDB and Pinecone
    - Shutdown: Clean up connections
    """
    print("\n" + "="*50)
    print("  SYNOD — Multi-Agent Decision Intelligence")
    print("="*50)

    # Startup
    await db_connect()
    await init_pinecone()
    print("[App] Synod backend ready ✓\n")

    yield

    # Shutdown
    await db_disconnect()
    print("[App] Synod backend shutdown complete")


# ─── Create FastAPI App ───────────────────────────────────────────

app = FastAPI(
    title="Synod",
    description="Multi-Agent AI Decision Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS (allow frontend to connect) ────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mount Routes ─────────────────────────────────────────────────

app.include_router(decisions_router)


# ─── Health Check ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "synod"}
