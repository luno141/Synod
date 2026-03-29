import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { attachAuthContext } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./modules/auth/routes.js";
import profileRoutes from "./modules/profile/routes.js";
import recommendationRoutes from "./modules/recommendations/routes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(attachAuthContext);

  app.get("/health", (_request, response) => {
    response.json({
      status: "healthy",
      service: "synod-backend",
      ai_provider: env.AI_PROVIDER,
      embedding_provider: env.EMBEDDING_PROVIDER,
      guest_mode: env.ENABLE_GUEST_MODE,
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api", recommendationRoutes);

  app.use(errorHandler);

  return app;
}
