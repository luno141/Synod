import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { SynodRequest } from "../../types/auth.js";
import { getProfile, updateProfile } from "./service.js";

const router = Router();

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  personality_style: z.string().nullable().optional(),
  interests: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  budget_amount: z.number().int().nullable().optional(),
  budget_currency: z.string().optional(),
  preferences: z
    .array(
      z.object({
        category: z.string().min(1),
        label: z.string().min(1),
        weight: z.number().min(0).max(1),
        polarity: z.string().optional(),
        evidence: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    const profile = await getProfile((request as SynodRequest).auth!.userId);
    response.json({ profile });
  }),
);

router.put(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    const profile = await updateProfile(
      (request as SynodRequest).auth!.userId,
      profileSchema.parse(request.body),
    );
    response.json({ profile });
  }),
);

export default router;
