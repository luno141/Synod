import type { User, UserPreference } from "@prisma/client";

import { env } from "../../config/env.js";
import { clamp } from "../../lib/http.js";
import { loadDirectAgentPrompt } from "../ai/synod-prompt-library.js";
import { aiProvider } from "../ai/provider.js";
import type { AgentPanel, DirectAgentKey, MemorySnippet, PanelAgentKey } from "./types.js";

interface DirectSpecialistInput {
  prompt: string;
  user: User;
  preferences: UserPreference[];
  memories: MemorySnippet[];
  targetAgent: PanelAgentKey;
  conversation?: Array<{
    role: "user" | "assistant";
    content: string;
    target_agent?: string;
  }>;
}

export const directAgentDefinitions: Record<
  PanelAgentKey,
  { name: string; role: string; mission: string; groqModel: string }
> = {
  planner: {
    name: "Planner Agent",
    role: "Execution Strategist",
    mission: "Understand the user's real goal and produce the execution roadmap.",
    groqModel: "llama-3.3-70b-versatile",
  },
  market: {
    name: "Market Agent",
    role: "Market Strategist",
    mission: "Analyze target users, demand, positioning, and go-to-market fit.",
    groqModel: "llama-3.3-70b-versatile",
  },
  venture_capitalist: {
    name: "Venture Capitalist Agent",
    role: "Investor Lens",
    mission: "Evaluate whether the idea is investable, scalable, and fundable.",
    groqModel: "llama-3.3-70b-versatile",
  },
  legal: {
    name: "Legal Agent",
    role: "Risk and Compliance Analyst",
    mission: "Identify legal, privacy, regulatory, compliance, and IP issues.",
    groqModel: "llama-3.3-70b-versatile",
  },
  engineer: {
    name: "Engineer Agent",
    role: "Technical Architect",
    mission: "Design the technical stack, architecture, risks, and MVP plan.",
    groqModel: "llama-3.3-70b-versatile",
  },
  designer: {
    name: "Designer Agent",
    role: "Product Experience Designer",
    mission: "Shape the UX, flows, interface, and product feel.",
    groqModel: "llama-3.1-8b-instant",
  },
  synthesizer: {
    name: "Synthesizer Agent",
    role: "Council Integrator",
    mission: "Combine the strongest insights into one final recommendation and roadmap.",
    groqModel: "llama-3.3-70b-versatile",
  },
};

const agentKeywordMap: Record<PanelAgentKey, string[]> = {
  planner: [
    "planner agent",
    "planning agent",
    "execution plan",
    "planning part",
    "roadmap",
    "agent assignments",
  ],
  synthesizer: [
    "synthesizer agent",
    "final summary",
    "final recommendation",
    "combine all",
    "priority roadmap",
  ],
  market: [
    "market agent",
    "market demand",
    "target audience",
    "competitors",
    "positioning",
    "go to market",
    "gtm",
  ],
  venture_capitalist: [
    "venture capitalist",
    "vc agent",
    "investable",
    "funding",
    "raise money",
    "moat",
    "business model",
  ],
  legal: [
    "legal agent",
    "legal risks",
    "privacy",
    "compliance",
    "ip",
    "copyright",
    "licensing",
    "regulatory",
  ],
  engineer: [
    "engineer agent",
    "technical architecture",
    "tech stack",
    "system architecture",
    "backend",
    "frontend",
    "database",
    "mvp roadmap",
  ],
  designer: [
    "designer agent",
    "user flow",
    "user experience",
    "visual style",
    "key screens",
    "layout",
    "design roadmap",
  ],
};

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

const agentMentionMap: Record<PanelAgentKey, string[]> = {
  planner: ["planner agent", "planning agent"],
  synthesizer: ["synthesizer agent"],
  market: ["market agent"],
  venture_capitalist: ["venture capitalist agent", "venture capitalist", "vc agent"],
  legal: ["legal agent"],
  engineer: ["engineer agent"],
  designer: ["designer agent"],
};

export function detectDirectAgentFromPrompt(prompt: string): PanelAgentKey | null {
  const normalized = normalizePrompt(prompt);

  for (const [agentKey, keywords] of Object.entries(agentMentionMap) as Array<
    [PanelAgentKey, string[]]
  >) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return agentKey;
    }
  }

  for (const [agentKey, keywords] of Object.entries(agentKeywordMap) as Array<
    [PanelAgentKey, string[]]
  >) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return agentKey;
    }
  }

  return null;
}

function buildDirectFallbackPanel({
  prompt,
  user,
  preferences,
  memories,
  targetAgent,
}: DirectSpecialistInput): Omit<AgentPanel, "model_used"> {
  const definition = directAgentDefinitions[targetAgent];
  const memoryCue = memories[0]?.content
    ? `Synod also found memory from a prior session: ${memories[0].content.slice(0, 120)}.`
    : "No prior memory cues were found for this exact request.";
  const knownPriorities = preferences
    .slice(0, 3)
    .map((preference) => preference.label)
    .join(", ");
  const missingInfo =
    prompt.length < 50
      ? ["Add one or two concrete constraints so this agent can produce a sharper answer."]
      : [];
  const confidence = clamp(
    64 + Math.min(20, prompt.length / 12) + Math.min(8, memories.length * 2),
    55,
    88,
  );

  const sharedContext = [
    `Prompt focus: ${prompt}`,
    user.goals.length > 0 ? `Known goals: ${user.goals.join(", ")}` : "Known goals: not specified in profile.",
    knownPriorities ? `Preference signals: ${knownPriorities}` : "Preference signals: none saved yet.",
    memoryCue,
  ].join("\n");

  const byAgent: Record<PanelAgentKey, string> = {
    planner: [
      "[UNDERSTANDING]",
      "The user wants a plan before execution, not a final recommendation.",
      "",
      "[MISSING INFORMATION]",
      missingInfo.length > 0 ? missingInfo.join("\n") : "No additional clarification is strictly required for a first planning pass.",
      "",
      "[EXECUTION PLAN]",
      "1. Clarify the real goal and hard constraints.",
      "2. Break the request into solvable workstreams.",
      "3. Assign the right specialist lens to each workstream.",
      "4. Sequence immediate, short-term, and long-term actions.",
      "",
      "[AGENT ASSIGNMENTS]",
      "- Planner Agent: define scope and roadmap.",
      "- Specialist agents: deepen the parts that need market, legal, technical, design, or synthesis analysis.",
      "",
      "[ROADMAP]",
      sharedContext,
      "",
      "[CONFIDENCE]",
      String(confidence),
    ].join("\n"),
    market: [
      "[UNDERSTANDING]",
      "The user wants a market-oriented answer, including audience, competitors, and positioning.",
      "",
      "[TARGET AUDIENCE]",
      "Start with the segment most affected by the problem described in the prompt.",
      "",
      "[MARKET DEMAND]",
      "Validate whether this pain is repeated, urgent, and expensive enough for users to care.",
      "",
      "[COMPETITORS]",
      "Map the closest substitutes, including tools, habits, and manual workflows.",
      "",
      "[GAPS IN THE MARKET]",
      sharedContext,
      "",
      "[POSITIONING]",
      "Differentiate on one sharp wedge rather than broad feature coverage.",
      "",
      "[GO TO MARKET ROADMAP]",
      "Interview likely buyers, test a narrow positioning message, and measure early pull before scaling.",
      "",
      "[CONFIDENCE]",
      String(confidence),
    ].join("\n"),
    venture_capitalist: [
      "[UNDERSTANDING]",
      "The user wants an investor-style evaluation of the opportunity.",
      "",
      "[IS THIS INVESTABLE]",
      "Too Early",
      "",
      "[WHY]",
      "Investability depends on proving real demand, willingness to pay, and some edge in distribution or product.",
      "",
      "[SCALABILITY]",
      "Favor a repeatable distribution path and a business model that improves as more customers arrive.",
      "",
      "[BUSINESS MODEL]",
      "Clarify who pays, when they pay, and why the economics improve over time.",
      "",
      "[MOAT / DEFENSIBILITY]",
      sharedContext,
      "",
      "[MAJOR RISKS]",
      "Lack of evidence for demand, weak differentiation, and unclear retention.",
      "",
      "[WHAT MUST HAPPEN BEFORE FUNDING]",
      "Prove a narrow wedge, early user pull, and a credible path to repeatable growth.",
      "",
      "[CONFIDENCE]",
      String(confidence),
    ].join("\n"),
    legal: [
      "[UNDERSTANDING]",
      "The user wants the legal and compliance surface mapped before moving forward.",
      "",
      "[LEGAL RISKS]",
      "Check contracts, platform terms, jurisdiction-specific rules, and liability exposure.",
      "",
      "[PRIVACY / DATA ISSUES]",
      "Identify what data is collected, stored, shared, or used for training.",
      "",
      "[IP / COPYRIGHT ISSUES]",
      "Review licensing, trademarks, ownership of generated outputs, and any scraped or third-party content.",
      "",
      "[COMPLIANCE REQUIREMENTS]",
      sharedContext,
      "",
      "[WHAT SHOULD BE REVIEWED BY A LAWYER]",
      "Anything involving user data, regulated industries, cross-border rules, or unclear IP ownership.",
      "",
      "[CONFIDENCE]",
      String(confidence),
    ].join("\n"),
    engineer: [
      "[UNDERSTANDING]",
      "The user wants a technical architecture and MVP implementation path.",
      "",
      "[TECH STACK]",
      "Choose the stack that minimizes complexity while matching the product and scale profile.",
      "",
      "[SYSTEM ARCHITECTURE]",
      "Separate input flow, orchestration, persistence, and delivery so the MVP can evolve safely.",
      "",
      "[KEY COMPONENTS]",
      "Frontend, backend APIs, database, AI orchestration, observability, and deployment pipeline.",
      "",
      "[TECHNICAL RISKS]",
      "Model latency, vendor coupling, weak data contracts, and over-engineering too early.",
      "",
      "[MVP ROADMAP]",
      sharedContext,
      "",
      "[SCALING ROADMAP]",
      "Add queueing, caching, analytics, and better retrieval only after usage proves the need.",
      "",
      "[CONFIDENCE]",
      String(confidence),
    ].join("\n"),
    designer: [
      "[UNDERSTANDING]",
      "The user wants the product experience, flows, and feel shaped intentionally.",
      "",
      "[USER EXPERIENCE GOAL]",
      "Define the emotion the user should feel when moving from confusion to clarity.",
      "",
      "[KEY SCREENS]",
      "Map the minimal set of screens that create trust, momentum, and clear next actions.",
      "",
      "[USER FLOW]",
      "Reduce friction between asking, seeing reasoning, and acting on the answer.",
      "",
      "[VISUAL STYLE]",
      sharedContext,
      "",
      "[UNIQUE EXPERIENCE]",
      "Make the interaction feel differentiated through layout, motion, and information hierarchy.",
      "",
      "[DESIGN ROADMAP]",
      "Design the core path first, then deepen delight and polish once the workflow is proven.",
      "",
      "[CONFIDENCE]",
      String(confidence),
    ].join("\n"),
    synthesizer: [
      "[FINAL SUMMARY]",
      "The user wants the strongest combined recommendation or direction rather than one narrow specialist lens.",
      "",
      "[KEY INSIGHTS FROM EACH AGENT]",
      "Combine planning, market, legal, technical, design, and investor tradeoffs into one decision frame.",
      "",
      "[FINAL RECOMMENDATION]",
      sharedContext,
      "",
      "[BIGGEST RISKS]",
      "Low evidence, unclear tradeoffs, and missing decision criteria can still distort the answer.",
      "",
      "[PRIORITY ROADMAP]",
      "Phase 1: Clarify the sharpest decision criteria.",
      "Phase 2: Validate the strongest assumptions quickly.",
      "Phase 3: Commit to the path with the best balance of upside and downside protection.",
      "",
      "[FINAL CONFIDENCE]",
      String(confidence),
    ].join("\n"),
  };

  return {
    key: targetAgent,
    agent_name: definition.name,
    mission: definition.mission,
    role: definition.role,
    understanding: `Synod routed this prompt directly to ${definition.name} because the user asked for that specialist lens or strongly implied it.`,
    missing_information: missingInfo,
    internal_reasoning_summary: `${definition.name} is answering this request directly using the standalone Synod prompt library.`,
    final_output: byAgent[targetAgent],
    confidence,
  };
}

export async function runDirectSpecialistPrompt(
  input: DirectSpecialistInput,
): Promise<AgentPanel> {
  const definition = directAgentDefinitions[input.targetAgent];
  const fallbackPanel = buildDirectFallbackPanel(input);
  const { data, modelUsed } = await aiProvider.maybeRefine<{
    understanding: string;
    missing_information: string[];
    internal_reasoning_summary: string;
    final_output: string;
    confidence: number;
  }>({
    systemPrompt: `${loadDirectAgentPrompt(input.targetAgent as DirectAgentKey)}

Return valid JSON only with these exact keys:
{
  "understanding": string,
  "missing_information": string[],
  "internal_reasoning_summary": string,
  "final_output": string,
  "confidence": number
}`,
    userPrompt: JSON.stringify(
      {
        prompt: input.prompt,
        conversation_context: input.conversation ?? [],
        user_profile: {
          interests: input.user.interests,
          goals: input.user.goals,
          constraints: input.user.constraints,
          budget_amount: input.user.budgetAmount,
          budget_currency: input.user.budgetCurrency,
          personality_style: input.user.personalityStyle,
        },
        saved_preferences: input.preferences.map((preference) => ({
          category: preference.category,
          label: preference.label,
          weight: preference.weight,
          polarity: preference.polarity,
        })),
        relevant_memory_cues: input.memories.map((memory) => ({
          source_type: memory.sourceType,
          similarity: Number(memory.similarity.toFixed(3)),
          content: memory.content,
        })),
      },
      null,
      2,
    ),
    fallback: {
      understanding: fallbackPanel.understanding,
      missing_information: fallbackPanel.missing_information,
      internal_reasoning_summary: fallbackPanel.internal_reasoning_summary,
      final_output: fallbackPanel.final_output,
      confidence: fallbackPanel.confidence,
    },
    modelOverride: env.AI_PROVIDER === "groq" ? definition.groqModel : undefined,
  });

  return {
    key: input.targetAgent,
    agent_name: definition.name,
    mission: definition.mission,
    role: definition.role,
    understanding: data.understanding || fallbackPanel.understanding,
    missing_information:
      data.missing_information?.filter(Boolean).length > 0
        ? data.missing_information.filter(Boolean)
        : fallbackPanel.missing_information,
    internal_reasoning_summary:
      data.internal_reasoning_summary || fallbackPanel.internal_reasoning_summary,
    final_output: data.final_output || fallbackPanel.final_output,
    confidence: clamp(Number(data.confidence ?? fallbackPanel.confidence), 0, 100),
    model_used: modelUsed,
  };
}
