import { type Response, Router } from "express";
import { z } from "zod";

import { AppError, asyncHandler } from "../../lib/http.js";
import type { SynodRequest } from "../../types/auth.js";
import {
  analyzeDecision,
  getAnalytics,
  getHistory,
  getRecommendationSession,
  submitFeedback,
} from "./service.js";

const router = Router();

function writeSseEvent(response: Response, event: string, data: unknown) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

const analyzeSchema = z.object({
  prompt: z.string().min(5).max(2000),
  saved: z.boolean().optional(),
  target_agent: z.string().optional(),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
        target_agent: z.string().optional(),
      }),
    )
    .optional(),
});

const feedbackSchema = z.object({
  decision_id: z.string().min(1),
  result: z.enum(["worked", "didnt_work"]),
  reason: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  outcome_notes: z.string().optional(),
});

router.post(
  "/analyze",
  asyncHandler(async (request, response) => {
    response.json(
      await analyzeDecision(request as SynodRequest, analyzeSchema.parse(request.body)),
    );
  }),
);

router.post("/analyze/stream", async (request, response) => {
  let streamClosed = false;

  response.on("close", () => {
    streamClosed = true;
  });
  request.on("aborted", () => {
    streamClosed = true;
  });

  try {
    const payload = analyzeSchema.parse(request.body);

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    writeSseEvent(response, "ready", { status: "streaming" });

    const result = await analyzeDecision(request as SynodRequest, payload, {
      onAgentPanel: async (panel) => {
        if (streamClosed) {
          return;
        }

        writeSseEvent(response, "panel", panel);
      },
    });

    if (!streamClosed) {
      writeSseEvent(response, "final", result);
      response.end();
    }
  } catch (error) {
    const statusCode =
      error instanceof z.ZodError
        ? 400
        : error instanceof AppError
          ? error.statusCode
          : 500;
    const message =
      error instanceof Error ? error.message : "Unexpected streaming error";

    if (!response.headersSent) {
      response.status(statusCode).json({ error: message });
      return;
    }

    if (!streamClosed) {
      writeSseEvent(response, "error", { error: message, status: statusCode });
      response.end();
    }
  }
});

router.post(
  "/recommendations",
  asyncHandler(async (request, response) => {
    response.json(
      await analyzeDecision(request as SynodRequest, analyzeSchema.parse(request.body)),
    );
  }),
);

router.get(
  "/history",
  asyncHandler(async (request, response) => {
    response.json(await getHistory(request as SynodRequest));
  }),
);

router.post(
  "/feedback",
  asyncHandler(async (request, response) => {
    response.json(
      await submitFeedback(request as SynodRequest, feedbackSchema.parse(request.body)),
    );
  }),
);

router.get(
  "/recommendations/:sessionId",
  asyncHandler(async (request, response) => {
    response.json(
      await getRecommendationSession(
        request as SynodRequest,
        z.string().min(1).parse(request.params.sessionId),
      ),
    );
  }),
);

router.post(
  "/recommendations/:sessionId/feedback",
  asyncHandler(async (request, response) => {
    const payload = feedbackSchema.parse({
      ...request.body,
      decision_id: request.params.sessionId,
    });

    response.json(await submitFeedback(request as SynodRequest, payload));
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (request, response) => {
    response.json(await getAnalytics(request as SynodRequest));
  }),
);

export default router;
