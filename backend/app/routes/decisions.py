"""
API Routes — the three core endpoints of Synod.

POST /api/analyze   — Run multi-agent analysis on a prompt
POST /api/feedback  — Submit feedback on a past decision
GET  /api/history   — Retrieve past decisions
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.models.schemas import (
    AnalyzeRequest,
    FeedbackRequest,
    DecisionResponse,
    HistoryItem,
)
from app.services.agents import run_all_agents
from app.services.synthesis import synthesize
from app.services.memory import find_similar_decisions, store_decision
from app.db.mongo import insert_decision, get_decision, update_feedback, get_history

router = APIRouter(prefix="/api")


@router.post("/analyze", response_model=DecisionResponse)
async def analyze(request: AnalyzeRequest):
    """
    Main analysis endpoint — the full Synod pipeline:

    1. Retrieve similar past decisions from Pinecone (context)
    2. Run 4 expert agents in parallel via asyncio.gather
    3. Feed all outputs to the Synthesizer
    4. Store the complete result in MongoDB
    5. Index the decision in Pinecone for future retrieval
    6. Return the structured recommendation
    """
    prompt = request.prompt
    print(f"\n{'='*60}")
    print(f"[API] New analysis request: {prompt[:80]}...")
    print(f"{'='*60}")

    # Step 1: Find similar past decisions for context injection
    past_decisions = await find_similar_decisions(prompt)
    if past_decisions:
        print(f"[API] Found {len(past_decisions)} similar past decisions for context")

    # Step 2: Run all expert agents in parallel
    print("[API] Launching agents...")
    agent_outputs = await run_all_agents(prompt, past_decisions)

    # Step 3: Synthesize all agent outputs into a final recommendation
    print("[API] Synthesizing verdict...")
    synthesis = await synthesize(prompt, agent_outputs)

    # Step 4: Store the complete decision in MongoDB
    decision_data = {
        "prompt": prompt,
        "agents": {
            key: output.model_dump() for key, output in agent_outputs.items()
        },
        "synthesis": synthesis.model_dump(),
        "feedback": None,
    }
    decision_id = await insert_decision(decision_data)
    print(f"[API] Decision stored: {decision_id}")

    # Step 5: Index in Pinecone for future retrieval
    await store_decision(
        decision_id=decision_id,
        prompt=prompt,
        verdict=synthesis.verdict,
        confidence=synthesis.confidence,
    )

    # Step 6: Return the structured response
    return DecisionResponse(
        id=decision_id,
        prompt=prompt,
        summary=synthesis.summary,
        agents={
            key: output.model_dump() for key, output in agent_outputs.items()
        },
        pros=synthesis.pros,
        cons=synthesis.cons,
        risks=synthesis.risks,
        disagreements=synthesis.disagreements,
        verdict=synthesis.verdict,
        confidence=synthesis.confidence,
        created_at=datetime.utcnow().isoformat(),
    )


@router.post("/feedback")
async def feedback(request: FeedbackRequest):
    """
    Submit feedback on a past decision.

    This closes the feedback loop:
    - The feedback is stored in MongoDB
    - The Pinecone record is updated with the outcome
    - Future queries retrieve this outcome for context-aware recommendations
    """
    decision = await get_decision(request.decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Update MongoDB
    success = await update_feedback(request.decision_id, request.result)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to store feedback")

    # Update Pinecone record with feedback
    await store_decision(
        decision_id=request.decision_id,
        prompt=decision["prompt"],
        verdict=decision.get("synthesis", {}).get("verdict", ""),
        confidence=decision.get("synthesis", {}).get("confidence", 0),
        feedback=request.result,
    )

    print(f"[API] Feedback recorded: {request.decision_id} → {request.result}")
    return {"status": "ok", "decision_id": request.decision_id}


@router.get("/history")
async def history():
    """
    Return recent decisions for the history sidebar.
    Lightweight response — just prompts, verdicts, and scores.
    """
    items = await get_history(limit=50)
    return {"decisions": items}
