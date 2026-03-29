import type { Prisma } from "@prisma/client";

import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/http.js";

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: {
        orderBy: [{ category: "asc" }, { weight: "desc" }],
      },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

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
    preferences: user.preferences.map((preference) => ({
      id: preference.id,
      category: preference.category,
      label: preference.label,
      weight: preference.weight,
      polarity: preference.polarity,
      evidence: preference.evidence,
      source: preference.source,
    })),
  };
}

export async function updateProfile(
  userId: string,
  input: {
    name?: string;
    personality_style?: string | null;
    interests?: string[];
    goals?: string[];
    constraints?: string[];
    budget_amount?: number | null;
    budget_currency?: string;
    preferences?: Array<{
      category: string;
      label: string;
      weight: number;
      polarity?: string;
      evidence?: string[];
    }>;
  },
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "User not found");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        personalityStyle: input.personality_style,
        interests: input.interests,
        goals: input.goals,
        constraints: input.constraints,
        budgetAmount: input.budget_amount,
        budgetCurrency: input.budget_currency,
      },
    });

    if (input.preferences) {
      await tx.userPreference.deleteMany({
        where: {
          userId,
          source: {
            in: ["profile", "manual"],
          },
        },
      });

      if (input.preferences.length > 0) {
        await tx.userPreference.createMany({
          data: input.preferences.map((preference) => ({
            userId,
            category: preference.category,
            label: preference.label,
            weight: preference.weight,
            polarity: preference.polarity ?? "positive",
            evidence: preference.evidence ?? [],
            source: "profile",
          })),
        });
      }
    }
  });

  return getProfile(userId);
}
