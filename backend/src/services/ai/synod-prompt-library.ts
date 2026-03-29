import { readFileSync } from "node:fs";
import path from "node:path";

import type { DirectAgentKey } from "../agents/types.js";

const promptFilePath = path.join(
  process.cwd(),
  "synod_multi_agent_system_prompts_for_groq_api.md",
);

const directAgentHeadings: Record<DirectAgentKey, string> = {
  planner: "Planner Agent Prompt",
  market: "Market Agent Prompt",
  venture_capitalist: "Venture Capitalist Agent Prompt",
  legal: "Legal Agent Prompt",
  engineer: "Engineer Agent Prompt",
  designer: "Designer Agent Prompt",
  synthesizer: "Synthesizer Agent Prompt",
};

interface ParsedPromptLibrary {
  sharedRules: string;
  agentPrompts: Record<DirectAgentKey, string>;
}

let cachedLibrary: ParsedPromptLibrary | null = null;

function extractFirstCodeBlock(markdown: string, anchor: RegExp): string {
  const anchorMatch = anchor.exec(markdown);
  if (!anchorMatch) {
    throw new Error(`Unable to locate prompt section for ${anchor}`);
  }

  const afterAnchor = markdown.slice(anchorMatch.index);
  const codeBlockMatch = afterAnchor.match(/```text\s*([\s\S]*?)```/i);
  if (!codeBlockMatch?.[1]) {
    throw new Error(`Unable to locate code block after ${anchor}`);
  }

  return codeBlockMatch[1].trim();
}

function parsePromptLibrary(): ParsedPromptLibrary {
  const markdown = readFileSync(promptFilePath, "utf8");
  const sharedRules = extractFirstCodeBlock(markdown, /^# Shared Global Rules.*$/im);

  const agentPrompts = Object.fromEntries(
    Object.entries(directAgentHeadings).map(([key, heading]) => [
      key,
      extractFirstCodeBlock(
        markdown,
        new RegExp(`^#\\s+\\d+\\.\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im"),
      ),
    ]),
  ) as Record<DirectAgentKey, string>;

  return {
    sharedRules,
    agentPrompts,
  };
}

function getPromptLibrary(): ParsedPromptLibrary {
  if (!cachedLibrary) {
    cachedLibrary = parsePromptLibrary();
  }

  return cachedLibrary;
}

export function loadDirectAgentPrompt(agentKey: DirectAgentKey): string {
  const library = getPromptLibrary();

  return `${library.sharedRules}\n\n${library.agentPrompts[agentKey]}`.trim();
}
