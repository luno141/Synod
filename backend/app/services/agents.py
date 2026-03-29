"""
Agent Orchestration Service — the heart of Synod.

This is NOT a ChatGPT wrapper. This module:
1. Loads separate expert prompts for each agent persona
2. Runs all agents IN PARALLEL via asyncio.gather
3. Each agent independently analyzes the same prompt
4. Historical context from Pinecone is injected into prompts
5. Results are collected and passed to the Synthesizer

This parallel multi-agent architecture is what makes Synod
fundamentally different from a single-prompt wrapper.
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, List, Optional

from app.services.llm import generate_json
from app.models.schemas import AgentOutput

# ─── Agent Registry ───────────────────────────────────────────────
# Each agent has a name, role description, and prompt file.

AGENTS = {
    "vc": {
        "name": "VC Agent",
        "role": "Venture Capital Investor",
        "prompt_file": "vc.txt",
    },
    "engineer": {
        "name": "Engineer Agent",
        "role": "Principal Software Engineer",
        "prompt_file": "engineer.txt",
    },
    "marketing": {
        "name": "Marketing Agent",
        "role": "VP of Marketing",
        "prompt_file": "marketing.txt",
    },
    "product_manager": {
        "name": "Product Manager Agent",
        "role": "Senior Product Manager",
        "prompt_file": "product_manager.txt",
    },
}

# Path to prompt files
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    """Load a system prompt from the prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    return prompt_path.read_text(encoding="utf-8")


def _build_user_prompt(
    user_query: str,
    past_decisions: Optional[List[Dict]] = None,
) -> str:
    """
    Build the user-facing prompt that includes:
    1. The user's actual question
    2. Historical context from similar past decisions (if available)

    This context injection is what enables Synod's feedback loop —
    past outcomes influence future recommendations.
    """
    parts = [f"## Decision to Analyze\n\n{user_query}"]

    if past_decisions:
        parts.append("\n\n## Relevant Past Decisions\n")
        parts.append("The following similar decisions were made previously. "
                      "Consider their outcomes when forming your analysis:\n")
        for i, decision in enumerate(past_decisions, 1):
            feedback_str = ""
            if decision.get("feedback"):
                feedback_str = f" (Outcome: {decision['feedback']})"
            parts.append(
                f"\n### Past Decision {i} (Similarity: {decision.get('similarity', 'N/A')}){feedback_str}\n"
                f"**Question:** {decision['prompt']}\n"
                f"**Verdict:** {decision['verdict']}\n"
                f"**Confidence:** {decision['confidence']}%"
            )

    return "\n".join(parts)


async def _run_single_agent(
    agent_key: str,
    agent_config: dict,
    user_prompt: str,
) -> tuple[str, AgentOutput]:
    """
    Run a single agent: load its prompt, call the LLM, parse the response.
    Returns a tuple of (agent_key, AgentOutput).
    """
    system_prompt = _load_prompt(agent_config["prompt_file"])

    try:
        result = await generate_json(system_prompt, user_prompt)

        output = AgentOutput(
            agent_name=agent_config["name"],
            role=agent_config["role"],
            analysis=result.get("analysis", "Analysis not available."),
            score=min(100, max(0, int(result.get("score", 50)))),
            key_points=result.get("key_points", []),
        )
        print(f"[Agent] {agent_config['name']} completed (score: {output.score})")
        return agent_key, output

    except Exception as e:
        # On failure, return a degraded output rather than crashing
        print(f"[Agent] {agent_config['name']} failed: {e}")
        return agent_key, AgentOutput(
            agent_name=agent_config["name"],
            role=agent_config["role"],
            analysis=f"Agent analysis unavailable due to an error: {str(e)}",
            score=50,
            key_points=["Analysis could not be completed"],
        )


async def run_all_agents(
    user_query: str,
    past_decisions: Optional[List[Dict]] = None,
) -> Dict[str, AgentOutput]:
    """
    Run ALL expert agents in parallel using asyncio.gather.

    This is the core multi-agent orchestration:
    - Each agent gets the same user query + historical context
    - They run simultaneously (not sequentially)
    - Each produces an independent analysis
    - Results are collected into a dict keyed by agent name

    Returns: Dict mapping agent_key -> AgentOutput
    """
    user_prompt = _build_user_prompt(user_query, past_decisions)

    # Launch all agents concurrently — this is where Synod's
    # multi-agent architecture shines vs. a single-prompt wrapper
    tasks = [
        _run_single_agent(key, config, user_prompt)
        for key, config in AGENTS.items()
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    agent_outputs = {}
    for result in results:
        if isinstance(result, Exception):
            print(f"[Agent] Unexpected error in gather: {result}")
            continue
        key, output = result
        agent_outputs[key] = output

    print(f"[Orchestrator] {len(agent_outputs)}/{len(AGENTS)} agents completed ✓")
    return agent_outputs
