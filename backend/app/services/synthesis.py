"""
Synthesis Service — combines all agent analyses into a unified recommendation.

The Synthesizer is a meta-agent that reads all expert outputs and produces:
- Executive summary
- Pros, cons, risks
- Key disagreements between agents
- Final verdict with confidence score

This layer is what turns multiple opinions into decision intelligence.
"""

from typing import Dict
from pathlib import Path

from app.services.llm import generate_json
from app.models.schemas import AgentOutput, SynthesisOutput

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _build_synthesis_prompt(
    user_query: str,
    agent_outputs: Dict[str, AgentOutput],
) -> str:
    """
    Build the user prompt for the Synthesizer agent.
    Includes the original question and all expert analyses formatted
    for easy consumption by the synthesis LLM.
    """
    parts = [
        f"## Original Question\n\n{user_query}\n",
        "## Expert Analyses\n",
    ]

    for key, output in agent_outputs.items():
        parts.append(
            f"### {output.agent_name} ({output.role}) — Score: {output.score}/100\n\n"
            f"{output.analysis}\n\n"
            f"**Key Points:**\n" +
            "\n".join(f"- {point}" for point in output.key_points) +
            "\n"
        )

    return "\n".join(parts)


async def synthesize(
    user_query: str,
    agent_outputs: Dict[str, AgentOutput],
) -> SynthesisOutput:
    """
    Run the Synthesizer agent to produce a unified recommendation.

    Takes all agent outputs, formats them into a comprehensive prompt,
    and asks the Synthesizer LLM to find consensus, surface disagreements,
    and produce a final verdict.
    """
    system_prompt = (PROMPTS_DIR / "synthesizer.txt").read_text(encoding="utf-8")
    user_prompt = _build_synthesis_prompt(user_query, agent_outputs)

    try:
        result = await generate_json(system_prompt, user_prompt)

        synthesis = SynthesisOutput(
            summary=result.get("summary", "Summary not available."),
            pros=result.get("pros", []),
            cons=result.get("cons", []),
            risks=result.get("risks", []),
            disagreements=result.get("disagreements", []),
            verdict=result.get("verdict", "Verdict not available."),
            confidence=min(100, max(0, int(result.get("confidence", 50)))),
        )
        print(f"[Synthesis] Completed with {synthesis.confidence}% confidence ✓")
        return synthesis

    except Exception as e:
        print(f"[Synthesis] Failed: {e}")
        # Return a degraded synthesis rather than crashing
        scores = [o.score for o in agent_outputs.values()]
        avg_score = sum(scores) // len(scores) if scores else 50

        return SynthesisOutput(
            summary=f"Synthesis could not be fully completed due to an error: {str(e)}. "
                    f"Individual agent scores averaged {avg_score}/100.",
            pros=["Individual agent analyses are available for review"],
            cons=["Automated synthesis was not fully completed"],
            risks=["Manual review of individual analyses recommended"],
            disagreements=[],
            verdict="Please review individual agent analyses for guidance.",
            confidence=avg_score,
        )
