import type { Prisma, RecommendationOption, RecommendationSession } from "@prisma/client";
import { FeedbackResult } from "@prisma/client";

import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/http.js";
import type { SynodRequest } from "../../types/auth.js";
import { resolveUserId } from "../auth/service.js";
import type {
  AgentPanel,
  DirectAgentKey,
  PanelAgentKey,
} from "../../services/agents/types.js";
import {
  detectDirectAgentFromPrompt,
  runDirectSpecialistPrompt,
} from "../../services/agents/direct-specialist.js";
import { embedText } from "../../services/embeddings/service.js";
import { queryRelevantMemories, upsertMemoryRecord } from "../../services/memory/chroma.js";
import { runCouncil } from "../../services/agents/pipeline.js";

function normalizeAgentKey(value: string): PanelAgentKey {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "planner" ||
    normalized === "synthesizer" ||
    normalized === "market" ||
    normalized === "venture_capitalist" ||
    normalized === "legal" ||
    normalized === "engineer" ||
    normalized === "designer"
  ) {
    return normalized;
  }

  return "planner";
}

function serializeAgentRun(message: { panel: AgentPanel }): AgentPanel {
  return message.panel;
}

function buildAgentsRecord(panels: AgentPanel[]) {
  return Object.fromEntries(panels.map((panel) => [panel.key, panel]));
}

function resolveAnalysisTarget(
  prompt: string,
  explicitTarget?: string,
): PanelAgentKey | null {
  const normalizedTarget = explicitTarget?.trim().toLowerCase();
  if (
    normalizedTarget &&
    normalizedTarget !== "all" &&
    (normalizedTarget === "planner" ||
      normalizedTarget === "market" ||
      normalizedTarget === "venture_capitalist" ||
      normalizedTarget === "legal" ||
      normalizedTarget === "engineer" ||
      normalizedTarget === "designer" ||
      normalizedTarget === "synthesizer")
  ) {
    return normalizedTarget as PanelAgentKey;
  }

  return detectDirectAgentFromPrompt(prompt);
}

function agentMessageToApi(
  message: {
    summary: string;
    confidence?: number | null;
    content: Prisma.JsonValue;
    agent: string;
    modelUsed?: string | null;
  },
) : AgentPanel {
  const typedContent = (message.content ?? {}) as Record<string, unknown>;
  const panelContent =
    typedContent.panel && typeof typedContent.panel === "object"
      ? (typedContent.panel as Partial<AgentPanel>)
      : null;
  const key = normalizeAgentKey(panelContent?.key ?? message.agent);
  const keyPoints = Array.isArray(typedContent.keyPoints)
    ? typedContent.keyPoints.filter((item): item is string => typeof item === "string")
    : Array.isArray((typedContent as { key_points?: unknown }).key_points)
      ? ((typedContent as { key_points: string[] }).key_points ?? [])
      : [];

  return {
    key,
    agent_name: panelContent?.agent_name ?? `${key.charAt(0).toUpperCase()}${key.slice(1)} Agent`,
    mission:
      panelContent?.mission ??
      "Legacy agent record detected. Mission metadata was not stored for this session.",
    role: panelContent?.role ?? key,
    understanding: panelContent?.understanding ?? message.summary,
    missing_information:
      panelContent?.missing_information?.filter(Boolean) ??
      (keyPoints.length > 0 ? [keyPoints[0]] : []),
    internal_reasoning_summary: panelContent?.internal_reasoning_summary ?? message.summary,
    final_output:
      panelContent?.final_output ??
      (keyPoints.length > 0 ? keyPoints.join("\n") : message.summary),
    confidence: Number(panelContent?.confidence ?? message.confidence ?? 50),
    model_used: panelContent?.model_used ?? message.modelUsed ?? "unknown",
  };
}

function latestFeedback(
  session: {
    feedbackEntries?: Array<{
      result: FeedbackResult;
      createdAt: Date;
      learningSummary: string | null;
    }>;
  },
) {
  const feedback = session.feedbackEntries?.[0];
  if (!feedback) {
    return null;
  }

  return {
    result:
      feedback.result === FeedbackResult.ACCEPTED
        ? "worked"
        : feedback.result === FeedbackResult.REJECTED
          ? "didnt_work"
          : "retry_requested",
    given_at: feedback.createdAt.toISOString(),
    learning_summary: feedback.learningSummary,
  };
}

function riskLevel(confidence: number) {
  if (confidence >= 78) {
    return "low";
  }
  if (confidence >= 60) {
    return "moderate";
  }
  return "high";
}

export async function analyzeDecision(
  request: SynodRequest,
  input: {
    prompt: string;
    saved?: boolean;
    target_agent?: string;
    conversation?: Array<{
      role: "user" | "assistant";
      content: string;
      target_agent?: string;
    }>;
  },
  options: {
    onAgentPanel?: (panel: AgentPanel) => Promise<void> | void;
  } = {},
) {
  const userId = await resolveUserId(request.auth?.userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const queryEmbedding = await embedText(input.prompt);
  const memories = await queryRelevantMemories({
    userId,
    embedding: queryEmbedding,
  });

  const resolvedTargetAgent = resolveAnalysisTarget(input.prompt, input.target_agent);

  if (resolvedTargetAgent) {
    const directPanel = await runDirectSpecialistPrompt({
      prompt: input.prompt,
      user,
      preferences: user.preferences,
      memories,
      conversation: input.conversation,
      targetAgent: resolvedTargetAgent,
    });

    await options.onAgentPanel?.(directPanel);

    const session = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdSession = await tx.recommendationSession.create({
        data: {
          userId,
          prompt: input.prompt,
          normalizedPrompt: input.prompt.trim().toLowerCase(),
          domain: resolvedTargetAgent,
          status: directPanel.missing_information.length > 0 ? "NEEDS_FOLLOWUP" : "COMPLETED",
          planningNotes:
            resolvedTargetAgent === "planner" ? directPanel.final_output : undefined,
          summary: directPanel.internal_reasoning_summary,
          finalRecommendation: directPanel.final_output,
          confidenceScore: directPanel.confidence,
          riskLevel: riskLevel(directPanel.confidence),
          followUpQuestions: directPanel.missing_information,
          retentionSummary: directPanel.internal_reasoning_summary,
          memoryInsights: memories.map(
            (memory) =>
              `${memory.sourceType} memory (${Math.round(memory.similarity * 100)}%): ${memory.content.slice(0, 120)}`,
          ),
          saved: input.saved ?? false,
        },
      });

      await tx.agentMessage.create({
        data: {
          sessionId: createdSession.id,
          agent: resolvedTargetAgent,
          stage: resolvedTargetAgent,
          summary: directPanel.internal_reasoning_summary,
          content: {
            panel: directPanel,
            structured_output: {
              prompt: input.prompt,
              direct_target_agent: resolvedTargetAgent,
            },
          } as unknown as Prisma.InputJsonValue,
          confidence: directPanel.confidence,
          modelUsed: directPanel.model_used,
        },
      });

      await tx.memoryEmbedding.create({
        data: {
          userId,
          sessionId: createdSession.id,
          vectorId: `${createdSession.id}-summary`,
          collection: "synod-memory",
          sourceType: "session_summary",
          content: `Prompt: ${input.prompt}\nAgent: ${directPanel.agent_name}\nSummary: ${directPanel.internal_reasoning_summary}\nConfidence: ${directPanel.confidence}`,
          metadata: {
            domain: resolvedTargetAgent,
            confidence: directPanel.confidence,
            embedding: queryEmbedding,
          } as Prisma.InputJsonValue,
        },
      });

      return createdSession;
    });

    await upsertMemoryRecord({
      vectorId: `${session.id}-summary`,
      content: `Prompt: ${input.prompt}\nAgent: ${directPanel.agent_name}\nSummary: ${directPanel.internal_reasoning_summary}\nConfidence: ${directPanel.confidence}`,
      embedding: queryEmbedding,
      metadata: {
        user_id: userId,
        session_id: session.id,
        source_type: "session_summary",
        domain: resolvedTargetAgent,
        feedback_result: "",
      },
    });

    return {
      id: session.id,
      mode: "specialist",
      resolved_target_agent: resolvedTargetAgent,
      prompt: input.prompt,
      summary: directPanel.internal_reasoning_summary,
      agents: buildAgentsRecord([directPanel]),
      agent_panels: [directPanel],
      pros: [],
      cons: [],
      risks: directPanel.missing_information,
      disagreements: [],
      verdict: directPanel.final_output,
      confidence: directPanel.confidence,
      alternatives: [],
      follow_up_questions: directPanel.missing_information,
      retention: {
        needs_follow_up: directPanel.missing_information.length > 0,
        learning_message: `${directPanel.agent_name} answered directly from the specialist prompt library.`,
      },
      options: [],
      created_at: session.createdAt.toISOString(),
    };
  }

  const council = await runCouncil({
    prompt: input.prompt,
    user,
    preferences: user.preferences,
    memories,
    conversation: input.conversation,
  }, {
    onAgentComplete: async (agentRun) => {
      await options.onAgentPanel?.(serializeAgentRun(agentRun));
    },
  });
  const agentRuns = [
    council.planner,
    council.market,
    council.venture_capitalist,
    council.legal,
    council.engineer,
    council.designer,
    council.synthesizer,
  ];
  const agentPanels = agentRuns.map((agentRun) => serializeAgentRun(agentRun));

  const memoryContent = [
    `Prompt: ${input.prompt}`,
    `Recommendation: ${council.synthesizer.content.selectedOptionTitle}`,
    `Summary: ${council.synthesizer.content.summary}`,
    `Confidence: ${council.synthesizer.content.confidence}`,
  ].join("\n");

  const session = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdSession = await tx.recommendationSession.create({
      data: {
        userId,
        prompt: input.prompt,
        normalizedPrompt: input.prompt.trim().toLowerCase(),
        domain: council.planner.content.domain,
        status:
          council.synthesizer.content.confidence < 70 ||
          council.synthesizer.content.followUpQuestions.length > 0
            ? "NEEDS_FOLLOWUP"
            : "COMPLETED",
        planningNotes: council.planner.content.notes,
        summary: council.synthesizer.content.summary,
        finalRecommendation: council.synthesizer.content.verdict,
        confidenceScore: council.synthesizer.content.confidence,
        riskLevel: riskLevel(council.synthesizer.content.confidence),
        whySelected: council.synthesizer.content.whySelected,
        followUpQuestions: council.synthesizer.content.followUpQuestions,
        alternativeTitles: council.synthesizer.content.alternatives,
        memoryInsights: memories.map(
          (memory) =>
            `${memory.sourceType} memory (${Math.round(memory.similarity * 100)}%): ${memory.content.slice(0, 120)}`,
        ),
        retentionSummary: council.synthesizer.content.learningMessage,
        saved: input.saved ?? false,
      },
    });

    await tx.recommendationOption.createMany({
      data: council.options.map((option, index) => ({
        sessionId: createdSession.id,
        title: option.title,
        description: option.description,
        score: option.score,
        rank: index + 1,
        selected: option.title === council.synthesizer.content.selectedOptionTitle,
        pros: option.pros,
        cons: option.cons,
        risks: option.risks,
        tags: option.tags,
        evidence: option.evidence,
        reasoning: option.reasoning,
      })),
    });

    await tx.agentMessage.createMany({
      data: agentRuns.map((message) => ({
        sessionId: createdSession.id,
        agent: message.key,
        stage: message.key,
        summary: message.summary,
        content: {
          structured_output: (message.content as unknown as Record<string, unknown>) ?? {},
          keyPoints: message.keyPoints,
          panel: message.panel,
        } as unknown as Prisma.InputJsonValue,
        confidence: message.confidence,
        modelUsed: message.modelUsed,
      })),
    });

    await tx.memoryEmbedding.create({
      data: {
        userId,
        sessionId: createdSession.id,
        vectorId: `${createdSession.id}-summary`,
        collection: "synod-memory",
        sourceType: "session_summary",
        content: memoryContent,
        metadata: {
          domain: council.planner.content.domain,
          confidence: council.synthesizer.content.confidence,
          embedding: queryEmbedding,
        } as Prisma.InputJsonValue,
      },
    });

    return createdSession;
  });

  await upsertMemoryRecord({
    vectorId: `${session.id}-summary`,
    content: memoryContent,
    embedding: queryEmbedding,
    metadata: {
      user_id: userId,
      session_id: session.id,
      source_type: "session_summary",
      domain: council.planner.content.domain,
      feedback_result: "",
    },
  });

  return {
    id: session.id,
    mode: "council",
    resolved_target_agent: null,
    prompt: input.prompt,
    summary: council.synthesizer.content.summary,
    agents: buildAgentsRecord(agentPanels),
    agent_panels: agentPanels,
    pros: council.synthesizer.content.pros,
    cons: council.synthesizer.content.cons,
    risks: council.synthesizer.content.risks,
    disagreements: council.synthesizer.content.disagreements,
    verdict: council.synthesizer.content.verdict,
    confidence: council.synthesizer.content.confidence,
    alternatives: council.synthesizer.content.alternatives,
    follow_up_questions: council.synthesizer.content.followUpQuestions,
    retention: {
      needs_follow_up:
        council.synthesizer.content.confidence < 70 ||
        council.synthesizer.content.followUpQuestions.length > 0,
      fallback_strategy:
        council.synthesizer.content.confidence < 70
          ? "Re-run with a narrower target, tighter constraints, or a different specialist lens."
          : "Continue learning from this successful recommendation pattern.",
      learning_message: council.synthesizer.content.learningMessage,
    },
    options: council.options.map((option, index) => ({
      rank: index + 1,
      title: option.title,
      description: option.description,
      score: Math.round(option.score),
      selected: option.title === council.synthesizer.content.selectedOptionTitle,
      pros: option.pros,
      cons: option.cons,
      risks: option.risks,
      evidence: option.evidence,
    })),
    created_at: session.createdAt.toISOString(),
  };
}

export async function getHistory(request: SynodRequest) {
  const userId = await resolveUserId(request.auth?.userId);
  const sessions = await prisma.recommendationSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      feedbackEntries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return {
      decisions: sessions.map((session) => ({
        id: session.id,
      prompt: session.prompt,
      verdict: session.finalRecommendation ?? "",
      confidence: session.confidenceScore,
      feedback: latestFeedback(session),
      created_at: session.createdAt.toISOString(),
    })),
  };
}

function reasonToPreferenceLabel(reason: string | undefined | null) {
  if (!reason) {
    return "feedback signal";
  }

  const normalized = reason.toLowerCase();
  if (normalized.includes("expensive") || normalized.includes("budget")) {
    return "strong budget sensitivity";
  }
  if (normalized.includes("risk") || normalized.includes("safe")) {
    return "prefers downside protection";
  }
  if (normalized.includes("slow") || normalized.includes("time")) {
    return "values faster payoff";
  }
  if (normalized.includes("boring") || normalized.includes("different")) {
    return "prefers novelty";
  }

  return reason.slice(0, 80);
}

async function updateLearnedPreference(
  tx: Prisma.TransactionClient,
  userId: string,
  label: string,
  delta: number,
) {
  const existing = await tx.userPreference.findFirst({
    where: {
      userId,
      label,
      source: "feedback",
    },
  });

  if (existing) {
    await tx.userPreference.update({
      where: { id: existing.id },
      data: {
        weight: Math.max(0.15, Math.min(0.95, existing.weight + delta)),
      },
    });
    return;
  }

  await tx.userPreference.create({
    data: {
      userId,
      category: "feedback",
      label,
      weight: Math.max(0.25, Math.min(0.9, 0.5 + delta)),
      polarity: delta >= 0 ? "positive" : "negative",
      evidence: ["Derived from recommendation feedback"],
      source: "feedback",
    },
  });
}

export async function submitFeedback(
  request: SynodRequest,
  input: {
    decision_id: string;
    result: "worked" | "didnt_work";
    reason?: string;
    rating?: number;
    outcome_notes?: string;
  },
) {
  const userId = await resolveUserId(request.auth?.userId);
  const session = await prisma.recommendationSession.findFirst({
    where: {
      id: input.decision_id,
      userId,
    },
    include: {
      options: {
        orderBy: { rank: "asc" },
      },
    },
  });

  if (!session) {
    throw new AppError(404, "Recommendation session not found");
  }

  const selectedOption =
    session.options.find((option) => option.selected) ?? session.options[0] ?? null;

  const feedbackResult =
    input.result === "worked" ? FeedbackResult.ACCEPTED : FeedbackResult.REJECTED;
  const learnedLabel =
    input.result === "worked"
      ? selectedOption?.tags[0] ?? "successful recommendation pattern"
      : reasonToPreferenceLabel(input.reason);
  const weightDelta = input.result === "worked" ? 0.08 : 0.1;

  const learningSummary =
    input.result === "worked"
      ? `Synod reinforced the preference signal around "${learnedLabel}" because the selected option worked.`
      : `Synod recorded the rejection and will bias future recommendations away from "${learnedLabel}".`;
  const feedbackContent = `${session.prompt}\nFeedback: ${input.result}\nReason: ${input.reason ?? "not provided"}`;
  const feedbackEmbedding = await embedText(feedbackContent);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.feedback.create({
      data: {
        sessionId: session.id,
        userId,
        result: feedbackResult,
        reason: input.reason,
        rating: input.rating,
        outcomeNotes: input.outcome_notes,
        learningSummary,
        preferenceDeltas: {
          label: learnedLabel,
          delta: input.result === "worked" ? weightDelta : -weightDelta,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.recommendationSession.update({
      where: { id: session.id },
      data: {
        status: input.result === "worked" ? "COMPLETED" : "NEEDS_FOLLOWUP",
        retentionSummary: learningSummary,
      },
    });

    await updateLearnedPreference(
      tx,
      userId,
      learnedLabel,
      input.result === "worked" ? weightDelta : -weightDelta,
    );

    await tx.memoryEmbedding.upsert({
      where: { vectorId: `${session.id}-feedback` },
      create: {
        userId,
        sessionId: session.id,
        vectorId: `${session.id}-feedback`,
        collection: "synod-memory",
        sourceType: "feedback",
        content: feedbackContent,
        metadata: {
          feedback_result: feedbackResult,
          label: learnedLabel,
          embedding: feedbackEmbedding,
        } as Prisma.InputJsonValue,
      },
      update: {
        content: feedbackContent,
        metadata: {
          feedback_result: feedbackResult,
          label: learnedLabel,
          embedding: feedbackEmbedding,
        } as Prisma.InputJsonValue,
      },
    });
  });

  await upsertMemoryRecord({
    vectorId: `${session.id}-feedback`,
    content: feedbackContent,
    embedding: feedbackEmbedding,
    metadata: {
      user_id: userId,
      session_id: session.id,
      source_type: "feedback",
      feedback_result: feedbackResult,
      label: learnedLabel,
    },
  });

  return {
    status: "ok",
    decision_id: session.id,
    learning_summary: learningSummary,
    updated_preference: learnedLabel,
  };
}

export async function getRecommendationSession(
  request: SynodRequest,
  sessionId: string,
) {
  const userId = await resolveUserId(request.auth?.userId);
  const session = await prisma.recommendationSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      options: {
        orderBy: { rank: "asc" },
      },
      agentMessages: {
        orderBy: { createdAt: "asc" },
      },
      feedbackEntries: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!session) {
    throw new AppError(404, "Recommendation session not found");
  }

  return serializeRecommendationSession(session, session.options);
}

function serializeRecommendationSession(
  session: RecommendationSession & {
    agentMessages: Array<{
      agent: string;
      summary: string;
      confidence: number | null;
      content: Prisma.JsonValue;
      modelUsed: string | null;
    }>;
    feedbackEntries: Array<{
      result: FeedbackResult;
      createdAt: Date;
      learningSummary: string | null;
    }>;
  },
  options: RecommendationOption[],
) {
  const agentPanels = session.agentMessages.map((message) => agentMessageToApi(message));
  const agents = buildAgentsRecord(agentPanels);
  const mode = agentPanels.length === 1 ? "specialist" : "council";
  const resolvedTargetAgent = mode === "specialist" ? agentPanels[0]?.key ?? null : null;

  const selectedOption = options.find((option) => option.selected) ?? options[0] ?? null;

  return {
    id: session.id,
    mode,
    resolved_target_agent: resolvedTargetAgent,
    prompt: session.prompt,
    summary: session.summary ?? "",
    agents,
    agent_panels: agentPanels,
    pros: selectedOption?.pros ?? [],
    cons: selectedOption?.cons ?? [],
    risks: selectedOption?.risks ?? [],
    disagreements: [],
    verdict: session.finalRecommendation ?? "",
    confidence: session.confidenceScore,
    alternatives: session.alternativeTitles,
    follow_up_questions: session.followUpQuestions,
    retention: {
      needs_follow_up: session.status === "NEEDS_FOLLOWUP",
      learning_message: session.retentionSummary,
    },
    feedback: latestFeedback(session),
    created_at: session.createdAt.toISOString(),
  };
}

export async function getAnalytics(request: SynodRequest) {
  const userId = await resolveUserId(request.auth?.userId);

  const [sessions, preferences] = await Promise.all([
    prisma.recommendationSession.findMany({
      where: { userId },
      include: {
        feedbackEntries: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.userPreference.findMany({
      where: { userId },
      orderBy: { weight: "desc" },
      take: 12,
    }),
  ]);

  const feedbacks = sessions.flatMap((session) => session.feedbackEntries);
  const successCount = feedbacks.filter((feedback) => feedback.result === FeedbackResult.ACCEPTED).length;
  const rejectionCount = feedbacks.filter((feedback) => feedback.result === FeedbackResult.REJECTED).length;
  const totalFeedback = feedbacks.length;
  const avgConfidence =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((sum, session) => sum + session.confidenceScore, 0) / sessions.length,
        )
      : 0;

  return {
    total_sessions: sessions.length,
    average_confidence: avgConfidence,
    success_rate: totalFeedback > 0 ? Number((successCount / totalFeedback).toFixed(2)) : null,
    retention_trends: {
      accepted: successCount,
      rejected: rejectionCount,
      needs_follow_up: sessions.filter((session) => session.status === "NEEDS_FOLLOWUP").length,
    },
    top_preferences: preferences.map((preference) => ({
      category: preference.category,
      label: preference.label,
      weight: preference.weight,
      source: preference.source,
    })),
  };
}
