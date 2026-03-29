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
  confidence?: number;
  model_used: string;
}

export interface AgentRun<T> {
  key: AgentKey;
  role: string;
  mission: string;
  confidence?: number;
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
