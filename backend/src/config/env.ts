import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  AI_PROVIDER: z.enum(["mock", "openai", "groq"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),
  EMBEDDING_PROVIDER: z.enum(["local", "openai"]).default("local"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  CHROMA_URL: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  CHROMA_COLLECTION: z.string().default("synod-memory"),
  SERPER_API_KEY: z.string().optional(),
  ENABLE_GUEST_MODE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  DEMO_USER_EMAIL: z.email().default("demo@synod.local"),
  DEMO_USER_PASSWORD: z.string().default("SynodDemo123!"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid backend environment configuration");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
