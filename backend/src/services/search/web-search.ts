import { env } from "../../config/env.js";

import type { SearchEvidence } from "../agents/types.js";

export async function searchWeb(query: string): Promise<SearchEvidence[]> {
  if (!env.SERPER_API_KEY) {
    return [];
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": env.SERPER_API_KEY,
      },
      body: JSON.stringify({
        q: query,
        gl: "in",
        num: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      organic?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
    };

    return (payload.organic ?? [])
      .filter((entry) => entry.title && entry.link)
      .slice(0, 5)
      .map((entry) => ({
        title: entry.title ?? "Untitled result",
        url: entry.link ?? "",
        snippet: entry.snippet ?? "",
      }));
  } catch (error) {
    console.warn("[Search] Optional web search failed");
    console.warn(error);
    return [];
  }
}
