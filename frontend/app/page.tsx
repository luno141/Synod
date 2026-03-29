"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import AgentCard from "@/components/AgentCard";
import DecisionInput from "@/components/DecisionInput";
import FeedbackButtons from "@/components/FeedbackButtons";
import FinalVerdict from "@/components/FinalVerdict";
import HistorySidebar, { type SidebarThread } from "@/components/HistorySidebar";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { streamAnalyzePrompt } from "@/lib/api";
import {
  AGENT_CONFIG_BY_KEY,
  type AgentKey,
  type AgentOutput,
  type ConversationMessage,
  type DecisionResponse,
  VISIBLE_COUNCIL_AGENT_ORDER,
} from "@/lib/types";

type ThreadTurn = {
  id: string;
  prompt: string;
  targetAgent: AgentKey | "all";
  decision: DecisionResponse;
};

const PANEL_ORDER: AgentKey[] = [
  "planner",
  "market",
  "venture_capitalist",
  "legal",
  "engineer",
  "designer",
  "synthesizer",
];

function sortPanels(panels: AgentOutput[]) {
  return [...panels].sort(
    (left, right) =>
      PANEL_ORDER.indexOf(left.key) - PANEL_ORDER.indexOf(right.key),
  );
}

function buildConversationContext(turns: ThreadTurn[]): ConversationMessage[] {
  return turns
    .flatMap((turn) => [
      {
        role: "user" as const,
        content: turn.prompt,
        target_agent: turn.targetAgent,
      },
      {
        role: "assistant" as const,
        content: `${turn.decision.summary}\n${turn.decision.verdict}`,
        target_agent: turn.decision.resolved_target_agent ?? undefined,
      },
    ])
    .slice(-12);
}

function buildFocusedConversationContext(
  turns: ThreadTurn[],
  activeDecision: DecisionResponse | null,
  targetAgent: AgentKey | "all",
): ConversationMessage[] {
  const messages = buildConversationContext(turns);

  if (!activeDecision || targetAgent === "all") {
    return messages;
  }

  const focusedPanel =
    activeDecision.agent_panels.find((panel) => panel.key === targetAgent) ??
    activeDecision.agents[targetAgent];

  if (!focusedPanel) {
    return messages;
  }

  messages.push({
    role: "assistant",
    target_agent: targetAgent,
    content: [
      "[UNDERSTANDING]",
      focusedPanel.understanding,
      "",
      "[MISSING INFORMATION]",
      focusedPanel.missing_information.length > 0
        ? focusedPanel.missing_information.join("\n")
        : "None",
      "",
      "[THINKING]",
      focusedPanel.internal_reasoning_summary,
      "",
      "[FINAL OUTPUT]",
      focusedPanel.final_output,
    ].join("\n"),
  });

  return messages.slice(-12);
}

function selectDefaultPanel(decision: DecisionResponse) {
  return (
    decision.resolved_target_agent ??
    decision.agent_panels[0]?.key ??
    decision.agent_panels.at(-1)?.key ??
    null
  );
}

const VISIBLE_COUNCIL_PROGRESS_ORDER = VISIBLE_COUNCIL_AGENT_ORDER;

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [threadTurns, setThreadTurns] = useState<ThreadTurn[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [streamedPanels, setStreamedPanels] = useState<AgentOutput[]>([]);
  const [activePrompt, setActivePrompt] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentKey | "all">("all");
  const [selectedPanelKey, setSelectedPanelKey] = useState<AgentKey | null>(null);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const activeTurn = useMemo(() => {
    if (threadTurns.length === 0) {
      return null;
    }

    return (
      threadTurns.find((turn) => turn.id === activeTurnId) ??
      threadTurns[threadTurns.length - 1]
    );
  }, [activeTurnId, threadTurns]);

  const sidebarThreads: SidebarThread[] = useMemo(() => {
    return threadTurns.map((turn) => ({
      id: turn.id,
      prompt: turn.prompt,
      mode: turn.decision.mode,
      agentLabel:
        turn.targetAgent === "all"
          ? "Full Council"
          : AGENT_CONFIG_BY_KEY[turn.targetAgent]?.name ?? "Specialist",
    }));
  }, [threadTurns]);

  const activeDecision = decision ?? activeTurn?.decision ?? null;
  const displayedDecision = isLoading ? null : activeDecision;
  const loadingShowsCouncil = selectedAgent === "all";

  const visiblePanels = isLoading
    ? loadingShowsCouncil
      ? sortPanels(streamedPanels.filter((panel) => panel.key !== "synthesizer"))
      : streamedPanels
    : activeDecision?.agent_panels?.length
      ? sortPanels(
          activeDecision.mode === "council"
            ? activeDecision.agent_panels.filter(
                (panel) => showSynthesisPanel || panel.key !== "synthesizer",
              )
            : activeDecision.agent_panels,
        )
      : [];

  const activeThinkingKeys = useMemo(() => {
    if (isLoading) {
      return loadingShowsCouncil ? VISIBLE_COUNCIL_PROGRESS_ORDER : [selectedAgent as AgentKey];
    }

    if (!activeDecision) {
      return VISIBLE_COUNCIL_PROGRESS_ORDER;
    }

    if (activeDecision.mode === "specialist" && activeDecision.resolved_target_agent) {
      return [activeDecision.resolved_target_agent];
    }

    return VISIBLE_COUNCIL_PROGRESS_ORDER;
  }, [activeDecision, isLoading, loadingShowsCouncil, selectedAgent]);

  const submitAnalysis = useCallback(
    async (submittedPrompt: string, targetAgent: AgentKey | "all" = selectedAgent) => {
      const turnId = crypto.randomUUID();
      const conversation = buildFocusedConversationContext(threadTurns, activeDecision, targetAgent);

      setSelectedAgent(targetAgent);
      setIsLoading(true);
      setDecision(null);
      setStreamedPanels([]);
      setActivePrompt(submittedPrompt);
      setActiveTurnId(null);
      setSelectedPanelKey(targetAgent === "all" ? null : targetAgent);
      setShowSynthesisPanel(false);
      setError(null);

      try {
        await streamAnalyzePrompt(submittedPrompt, targetAgent, conversation, {
          onPanel: (panel) => {
            setStreamedPanels((current) =>
              sortPanels([
                ...current.filter((existing) => existing.key !== panel.key),
                panel,
              ]),
            );
          },
          onFinal: (result) => {
            const effectiveTargetAgent = result.resolved_target_agent ?? targetAgent;

            setDecision(result);
            setSelectedPanelKey(selectDefaultPanel(result));
            setStreamedPanels(sortPanels(result.agent_panels || Object.values(result.agents)));
            setSelectedAgent(effectiveTargetAgent);
            setShowSynthesisPanel(false);
            setThreadTurns((current) => [
              ...current,
              {
                id: turnId,
                prompt: submittedPrompt,
                targetAgent: effectiveTargetAgent,
                decision: result,
              },
            ]);
            setActiveTurnId(turnId);
            setPrompt("");
          },
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeDecision, selectedAgent, threadTurns],
  );

  const handleAnalyze = useCallback(
    async (submittedPrompt: string) => {
      await submitAnalysis(submittedPrompt);
    },
    [submitAnalysis],
  );

  const handleAgentPrompt = useCallback(
    async (agent: AgentKey, submittedPrompt: string) => {
      await submitAnalysis(submittedPrompt, agent);
    },
    [submitAnalysis],
  );

  const handleNewChat = () => {
    setPrompt("");
    setDecision(null);
    setThreadTurns([]);
    setActiveTurnId(null);
    setStreamedPanels([]);
    setActivePrompt("");
    setSelectedAgent("all");
    setSelectedPanelKey(null);
    setShowSynthesisPanel(false);
    setError(null);
  };

  const handleNewAnalysis = () => {
    setPrompt("");
    setError(null);
    setSelectedPanelKey(null);
    setShowSynthesisPanel(false);
  };

  const handleSelectTurn = (turn: ThreadTurn) => {
    setActiveTurnId(turn.id);
    setDecision(turn.decision);
    setActivePrompt(turn.prompt);
    setSelectedAgent(turn.targetAgent);
    setPrompt(turn.prompt);
    setSelectedPanelKey(selectDefaultPanel(turn.decision));
    setShowSynthesisPanel(false);
  };

  const handleSelectSidebarThread = (threadId: string) => {
    const turn = threadTurns.find((t) => t.id === threadId);
    if (turn) handleSelectTurn(turn);
  };

  return (
    <div className="flex h-screen">
      <HistorySidebar
        threads={sidebarThreads}
        activeThreadId={activeTurnId}
        onSelectThread={handleSelectSidebarThread}
        onNewChat={handleNewChat}
      />

      <main className="ml-[260px] flex-1 overflow-y-auto min-h-screen">
        <div className="flex min-h-full flex-col items-center justify-start px-4 py-10 md:px-6 md:py-14">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-[#1B6AC9] to-[#1558a8] bg-clip-text text-transparent">
                Synod
              </span>
            </h1>
          </motion.div>

          <div className="w-full">
            <DecisionInput
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              selectedAgent={selectedAgent}
              onTargetChange={setSelectedAgent}
            />
          </div>

          {(isLoading || displayedDecision || error) && activePrompt ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 mt-10 w-full max-w-6xl text-center"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.3em] text-[#8b8fa3]">
                {displayedDecision?.mode === "specialist" || selectedAgent !== "all"
                  ? "Direct Specialist Session"
                  : "Council Session"}
              </p>
              <h2 className="mx-auto max-w-4xl text-xl font-semibold text-[#1a1a2e] md:text-2xl">
                &ldquo;{activePrompt}&rdquo;
              </h2>
            </motion.div>
          ) : null}

          <AnimatePresence>
            {isLoading ? (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-2 w-full max-w-7xl"
              >
                <ThinkingAnimation
                  completedKeys={streamedPanels
                    .filter((panel) => panel.key !== "synthesizer")
                    .map((panel) => panel.key)}
                  activeKeys={activeThinkingKeys}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8 w-full max-w-2xl"
              >
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                  <p className="mb-4 text-sm text-red-600">{error}</p>
                  <button
                    onClick={handleNewAnalysis}
                    className="rounded-lg border border-[#d4d9e0] bg-white px-4 py-2 text-sm text-[#4a4e69] transition-colors hover:bg-[#f0f2f5]"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {threadTurns.length > 0 ? (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-10 w-full max-w-[1400px] space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#8b8fa3]">
                    Conversation Thread
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[#1a1a2e]">
                    Past turns stay editable in the same chat
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {threadTurns.map((turn) => {
                  const selected = activeTurnId === turn.id;
                  const label =
                    turn.targetAgent === "all"
                      ? "Full Council"
                      : AGENT_CONFIG_BY_KEY[turn.targetAgent]?.name ?? "Specialist";

                  return (
                    <button
                      key={turn.id}
                      type="button"
                      onClick={() => handleSelectTurn(turn)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? "border-[#1B6AC9]/30 bg-[#1B6AC9]/5 text-[#1a1a2e]"
                          : "border-[#d4d9e0] bg-white text-[#4a4e69] hover:border-[#1B6AC9]/30 hover:bg-[#1B6AC9]/5"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-[#8b8fa3]">
                          {label}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-[#8b8fa3]">
                          {turn.decision.mode}
                        </span>
                      </div>
                      <p
                        style={{ maxHeight: "3rem", overflow: "hidden" }}
                        className="text-sm leading-relaxed"
                      >
                        {turn.prompt}
                      </p>
                      <div className="mt-3 text-xs text-[#8b8fa3]">
                        Same-thread reply preserved
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          ) : null}

          {visiblePanels.length > 0 ? (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-10 w-full max-w-[1400px] space-y-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#8b8fa3]">
                    Agent Panels
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[#1a1a2e]">
                    Compact cards, hover only enlarges the card you touch
                  </h3>
                </div>
                <p className="text-sm text-[#8b8fa3]">
                  Tap any card to pin it open and ask that agent a follow-up directly.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visiblePanels.map((panel, index) => (
                  <AgentCard
                    key={panel.key}
                    output={panel}
                    meta={AGENT_CONFIG_BY_KEY[panel.key]}
                    index={index}
                    isExpanded={selectedPanelKey === panel.key}
                    onToggle={() =>
                      setSelectedPanelKey((current) =>
                        current === panel.key ? null : panel.key,
                      )
                    }
                    onAskAgent={handleAgentPrompt}
                  />
                ))}
              </div>

              {activeDecision?.mode === "council" && !showSynthesisPanel ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSynthesisPanel(true);
                      setSelectedPanelKey("synthesizer");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#1B6AC9]/20 bg-[#1B6AC9]/10 px-5 py-3 text-sm font-medium text-[#1B6AC9] transition-colors hover:bg-[#1B6AC9]/20"
                  >
                    Synthesize Output
                  </button>
                </div>
              ) : null}
            </motion.section>
          ) : null}

          <AnimatePresence>
            {displayedDecision ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-10 w-full max-w-6xl space-y-8"
              >
                {displayedDecision.mode === "council" ? (
                  showSynthesisPanel ? (
                    <>
                      <div className="flex items-center gap-4 py-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d4d9e0] to-transparent" />
                        <span className="text-xs uppercase tracking-wider text-[#8b8fa3]">
                          Final Verdict
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d4d9e0] to-transparent" />
                      </div>

                      <FinalVerdict decision={displayedDecision} />
                      <FeedbackButtons decisionId={displayedDecision.id} />
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mx-auto w-full max-w-4xl rounded-2xl border border-[#1B6AC9]/15 bg-[#1B6AC9]/5 p-6 text-center"
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-[#8b8fa3]">
                        Synthesis Locked
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[#1a1a2e]">
                        The council has finished debating.
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-[#4a4e69]">
                        Click <span className="text-[#1B6AC9] font-medium">Synthesize Output</span> to merge all agent panels into one structured recommendation.
                      </p>
                    </motion.div>
                  )
                ) : (
                  <>
                    <div className="flex items-center gap-4 py-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d4d9e0] to-transparent" />
                      <span className="text-xs uppercase tracking-wider text-[#8b8fa3]">
                        Final Verdict
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d4d9e0] to-transparent" />
                    </div>

                    <FinalVerdict decision={displayedDecision} />
                    <FeedbackButtons decisionId={displayedDecision.id} />
                  </>
                )}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center pb-12 pt-2"
                >
                  <button
                    id="new-analysis"
                    onClick={handleNewAnalysis}
                    className="rounded-xl border border-[#d4d9e0] bg-white px-6 py-3 text-sm text-[#4a4e69] transition-all duration-200 hover:bg-[#e8ecf1] hover:text-[#1a1a2e] shadow-sm"
                  >
                    Clear Input
                  </button>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
