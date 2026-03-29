import {
  AgentOutput,
  DecisionResponse,
  ConversationMessage,
  AgentKey,
  FeedbackRequest,
  HistoryItem,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response.json();
}

export async function analyzePrompt(
  prompt: string,
  targetAgent?: AgentKey | "all",
  conversation?: ConversationMessage[],
): Promise<DecisionResponse> {
  return apiCall<DecisionResponse>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      target_agent: targetAgent && targetAgent !== "all" ? targetAgent : undefined,
      conversation,
    }),
  });
}

export async function streamAnalyzePrompt(
  prompt: string,
  targetAgent?: AgentKey | "all",
  conversation?: ConversationMessage[],
  handlers: {
    onPanel?: (panel: AgentOutput) => void;
    onFinal?: (result: DecisionResponse) => void;
  } = {},
): Promise<DecisionResponse> {
  const response = await fetch(`${API_BASE}/api/analyze/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      target_agent: targetAgent && targetAgent !== "all" ? targetAgent : undefined,
      conversation,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error("Streaming is not available in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: DecisionResponse | null = null;

  const handleEvent = (chunk: string) => {
    const lines = chunk.split(/\r?\n/);
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    const parsed = JSON.parse(dataLines.join("\n")) as
      | AgentOutput
      | DecisionResponse
      | { error: string };

    if (eventName === "panel") {
      handlers.onPanel?.(parsed as AgentOutput);
      return;
    }

    if (eventName === "final") {
      finalPayload = parsed as DecisionResponse;
      handlers.onFinal?.(finalPayload);
      return;
    }

    if (eventName === "error") {
      throw new Error((parsed as { error: string }).error || "Streaming request failed.");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const chunk = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);
      if (chunk) {
        handleEvent(chunk);
      }
      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }

  if (!finalPayload) {
    throw new Error("The council stream ended before a final recommendation arrived.");
  }

  return finalPayload;
}

export async function submitFeedback(
  request: FeedbackRequest,
): Promise<{ status: string }> {
  return apiCall<{ status: string }>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getHistory(): Promise<{ decisions: HistoryItem[] }> {
  return apiCall<{ decisions: HistoryItem[] }>("/api/history");
}
