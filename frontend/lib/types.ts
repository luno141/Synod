export type AgentKey =
  | "planner"
  | "market"
  | "venture_capitalist"
  | "legal"
  | "engineer"
  | "designer"
  | "synthesizer";

export type DirectAgentKey = AgentKey;
export type PanelAgentKey = AgentKey;

export interface AgentPanel {
  key: PanelAgentKey;
  agent_name: string;
  mission: string;
  role: string;
  understanding: string;
  missing_information: string[];
  internal_reasoning_summary: string;
  final_output: string;
  model_used: string;
}

export type AgentOutput = AgentPanel;

export interface AgentRun<T> {
  key: AgentKey;
  role: string;
  mission: string;
  modelUsed: string;
  summary: string;
  keyPoints: string[];
  content: T;
  panel: AgentPanel;
}

export interface SearchEvidence {
  title: string;
  url: string;
  snippet: string;
}

export interface MemorySnippet {
  vectorId: string;
  content: string;
  similarity: number;
  sourceType: string;
  feedbackResult?: string;
}

export interface CandidateOption {
  title: string;
  description: string;
  baseScore: number;
  score: number;
  pros: string[];
  cons: string[];
  risks: string[];
  tags: string[];
  evidence: string[];
  reasoning: string;
  selected?: boolean;
}

export interface DecisionOption {
  rank: number;
  title: string;
  description: string;
  score: number;
  selected: boolean;
  pros: string[];
  cons: string[];
  risks: string[];
  evidence: string[];
}

export type AnalysisMode = "council" | "specialist";

export interface DecisionResponse {
  id: string;
  mode: AnalysisMode;
  resolved_target_agent: AgentKey | null;
  prompt: string;
  summary: string;
  agents: Record<string, AgentPanel>;
  agent_panels: AgentPanel[];
  pros: string[];
  cons: string[];
  risks: string[];
  disagreements: string[];
  verdict: string;
  alternatives: string[];
  follow_up_questions: string[];
  retention: {
    needs_follow_up: boolean;
    fallback_strategy?: string;
    learning_message: string;
  };
  options: DecisionOption[];
  created_at: string;
}

export interface HistoryItem {
  id: string;
  prompt: string;
  verdict: string;
  feedback: { result: string; given_at: string } | null;
  created_at: string;
}

export interface FeedbackRequest {
  decision_id: string;
  result: "worked" | "didnt_work";
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  target_agent?: AgentKey | "all";
}

export interface AgentMeta {
  key: AgentKey;
  name: string;
  role: string;
  icon: string;
  gradient: string;
  delay: number;
}

export interface AgentSelectorOption {
  key: AgentKey | "all";
  label: string;
}

export const ALL_AGENT_CONFIG: AgentMeta[] = [
  {
    key: "planner",
    name: "Planner Agent",
    role: "Strategic Architect",
    icon: "🧭",
    gradient: "from-cyan-500/20 to-sky-950/30",
    delay: 0,
  },
  {
    key: "market",
    name: "Market Agent",
    role: "Market Strategist",
    icon: "📈",
    gradient: "from-sky-500/20 to-cyan-950/30",
    delay: 0.12,
  },
  {
    key: "venture_capitalist",
    name: "VC Agent",
    role: "Investor Lens",
    icon: "💼",
    gradient: "from-lime-500/20 to-emerald-950/30",
    delay: 0.2,
  },
  {
    key: "legal",
    name: "Legal Agent",
    role: "Compliance Analyst",
    icon: "⚖️",
    gradient: "from-red-500/20 to-rose-950/30",
    delay: 0.28,
  },
  {
    key: "engineer",
    name: "Engineer Agent",
    role: "Technical Architect",
    icon: "⚙️",
    gradient: "from-slate-500/20 to-zinc-950/30",
    delay: 0.36,
  },
  {
    key: "designer",
    name: "Designer Agent",
    role: "Experience Designer",
    icon: "🎨",
    gradient: "from-pink-500/20 to-fuchsia-950/30",
    delay: 0.44,
  },
  {
    key: "synthesizer",
    name: "Synthesizer Agent",
    role: "Council Speaker",
    icon: "☀️",
    gradient: "from-violet-500/20 to-purple-950/30",
    delay: 0.52,
  },
];

export const AGENT_CONFIG_BY_KEY = Object.fromEntries(
  ALL_AGENT_CONFIG.map((agent) => [agent.key, agent]),
) as Record<AgentKey, AgentMeta>;

export const COUNCIL_AGENT_ORDER: AgentKey[] = [
  "planner",
  "market",
  "venture_capitalist",
  "legal",
  "engineer",
  "designer",
];

export const AGENT_SELECTOR_OPTIONS: AgentSelectorOption[] = [
  { key: "all", label: "Full Council" },
  { key: "planner", label: "Planner" },
  { key: "market", label: "Market" },
  { key: "venture_capitalist", label: "VC" },
  { key: "legal", label: "Legal" },
  { key: "engineer", label: "Engineer" },
  { key: "designer", label: "Designer" },
];

export const VISIBLE_COUNCIL_AGENT_ORDER: AgentKey[] = COUNCIL_AGENT_ORDER;
