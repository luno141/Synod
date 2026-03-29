import OpenAI from "openai";

import { env } from "../../config/env.js";

function extractJsonBlock<T>(raw: string): T {
  const direct = raw.trim();

  try {
    return JSON.parse(direct) as T;
  } catch {
    const fenced = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]) as T;
    }

    const loose = direct.match(/\{[\s\S]*\}/);
    if (!loose) {
      throw new Error("No JSON object found in model response");
    }

    return JSON.parse(loose[0]) as T;
  }
}

class AIProvider {
  private readonly requestTimeoutMs = 8000;

  private readonly runtime = (() => {
    if (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY) {
      return {
        client: new OpenAI({ apiKey: env.OPENAI_API_KEY }),
        model: env.OPENAI_MODEL,
        providerLabel: "openai",
      };
    }

    if (env.AI_PROVIDER === "groq" && env.GROQ_API_KEY) {
      return {
        client: new OpenAI({
          apiKey: env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1",
        }),
        model: env.GROQ_MODEL,
        providerLabel: "groq",
      };
    }

    return null;
  })();

  async maybeRefine<T>({
    systemPrompt,
    userPrompt,
    fallback,
    modelOverride,
  }: {
    systemPrompt: string;
    userPrompt: string;
    fallback: T;
    modelOverride?: string;
  }): Promise<{ data: T; modelUsed: string }> {
    if (!this.runtime) {
      return {
        data: fallback,
        modelUsed: "mock-council",
      };
    }

    try {
      const model = modelOverride || this.runtime.model;
      const completion = await Promise.race([
        this.runtime.client.chat.completions.create(
          {
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `${systemPrompt}\nReturn valid JSON only.`,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
          },
          {
            timeout: this.requestTimeoutMs,
          },
        ),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`AI refinement timed out after ${this.requestTimeoutMs}ms`));
          }, this.requestTimeoutMs);
        }),
      ]);

      const content = completion.choices[0]?.message?.content ?? "";

      if (!content.trim()) {
        return {
          data: fallback,
          modelUsed: "mock-council",
        };
      }

      return {
        data: extractJsonBlock<T>(content),
        modelUsed: model,
      };
    } catch (error) {
      console.warn(
        `${this.runtime.providerLabel} refinement failed, falling back to deterministic output`,
      );
      console.warn(error);
      return {
        data: fallback,
        modelUsed: "mock-council",
      };
    }
  }
}

export const aiProvider = new AIProvider();
