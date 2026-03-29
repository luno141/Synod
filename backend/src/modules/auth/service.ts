import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/http.js";
import { signToken } from "../../lib/jwt.js";
import { comparePassword, hashPassword } from "../../lib/password.js";
import { env } from "../../config/env.js";

export async function ensureDemoUser() {
  const passwordHash = await hashPassword(env.DEMO_USER_PASSWORD);

  return prisma.user.upsert({
    where: { email: env.DEMO_USER_EMAIL },
    update: {
      name: "Synod Demo",
      personalityStyle: "analytical but curious",
      interests: ["technology", "career growth", "good tradeoffs"],
      goals: ["make sharper decisions", "avoid avoidable downside"],
      constraints: ["price matters", "needs clear reasoning"],
      budgetAmount: 80000,
      budgetCurrency: "INR",
    },
    create: {
      email: env.DEMO_USER_EMAIL,
      passwordHash,
      name: "Synod Demo",
      personalityStyle: "analytical but curious",
      interests: ["technology", "career growth", "good tradeoffs"],
      goals: ["make sharper decisions", "avoid avoidable downside"],
      constraints: ["price matters", "needs clear reasoning"],
      budgetAmount: 80000,
      budgetCurrency: "INR",
    },
  });
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  personalityStyle: string | null;
  interests: string[];
  goals: string[];
  constraints: string[];
  budgetAmount: number | null;
  budgetCurrency: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    personality_style: user.personalityStyle,
    interests: user.interests,
    goals: user.goals,
    constraints: user.constraints,
    budget_amount: user.budgetAmount,
    budget_currency: user.budgetCurrency,
  };
}

export async function resolveUserId(authUserId?: string): Promise<string> {
  if (authUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(401, "Authenticated user no longer exists");
    }

    return existing.id;
  }

  if (!env.ENABLE_GUEST_MODE) {
    throw new AppError(401, "Authentication required");
  }

  const demoUser = await ensureDemoUser();
  return demoUser.id;
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(409, "An account with that email already exists");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
    },
  });

  return {
    token: signToken({ userId: user.id, email: user.email }),
    user: serializeUser(user),
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user?.passwordHash) {
    throw new AppError(401, "Invalid email or password");
  }

  const isValid = await comparePassword(input.password, user.passwordHash);

  if (!isValid) {
    throw new AppError(401, "Invalid email or password");
  }

  return {
    token: signToken({ userId: user.id, email: user.email }),
    user: serializeUser(user),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return serializeUser(user);
}
