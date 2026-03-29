"""
Pydantic models for request/response schemas.
These define the data contracts for the API and internal services.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ─── Request Models ───────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Input from the user — a question, idea, or decision to analyze."""
    prompt: str = Field(..., min_length=5, max_length=2000)


class FeedbackRequest(BaseModel):
    """User feedback on a past decision."""
    decision_id: str
    result: str = Field(..., pattern="^(worked|didnt_work)$")


# ─── Agent Output ─────────────────────────────────────────────────

class AgentOutput(BaseModel):
    """Structured output from a single expert agent."""
    agent_name: str
    role: str
    analysis: str
    score: int = Field(ge=0, le=100)
    key_points: List[str] = []


# ─── Synthesis Output ─────────────────────────────────────────────

class SynthesisOutput(BaseModel):
    """The synthesizer's structured recommendation combining all agents."""
    summary: str
    pros: List[str]
    cons: List[str]
    risks: List[str]
    disagreements: List[str]
    verdict: str
    confidence: int = Field(ge=0, le=100)


# ─── Decision (full stored document) ─────────────────────────────

class Decision(BaseModel):
    """Complete decision record stored in MongoDB."""
    id: Optional[str] = Field(None, alias="_id")
    prompt: str
    agents: dict[str, AgentOutput]
    synthesis: SynthesisOutput
    feedback: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}


# ─── API Response ─────────────────────────────────────────────────

class DecisionResponse(BaseModel):
    """Public API response for a decision analysis."""
    id: str
    prompt: str
    summary: str
    agents: dict[str, dict]
    pros: List[str]
    cons: List[str]
    risks: List[str]
    disagreements: List[str]
    verdict: str
    confidence: int
    created_at: str


class HistoryItem(BaseModel):
    """Lightweight item for history listing."""
    id: str
    prompt: str
    verdict: str
    confidence: int
    feedback: Optional[dict] = None
    created_at: str
