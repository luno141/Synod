import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { SynodRequest } from "../../types/auth.js";
import { getCurrentUser, loginUser, registerUser } from "./service.js";

const router = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

router.post(
  "/register",
  asyncHandler(async (request, response) => {
    const payload = registerSchema.parse(request.body);
    response.status(201).json(await registerUser(payload));
  }),
);

router.post(
  "/login",
  asyncHandler(async (request, response) => {
    const payload = loginSchema.parse(request.body);
    response.json(await loginUser(payload));
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await getCurrentUser((request as SynodRequest).auth!.userId);
    response.json({ user });
  }),
);

export default router;
