import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_USER_EMAIL ?? "demo@synod.local";
  const password = process.env.DEMO_USER_PASSWORD ?? "SynodDemo123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Synod Demo",
      personalityStyle: "analytical but curious",
      interests: ["technology", "career growth", "efficient tools"],
      goals: ["make high-quality decisions faster", "avoid expensive mistakes"],
      constraints: ["prefers practical options", "limited tolerance for unclear tradeoffs"],
      budgetAmount: 80000,
      budgetCurrency: "INR",
    },
    create: {
      email,
      passwordHash,
      name: "Synod Demo",
      personalityStyle: "analytical but curious",
      interests: ["technology", "career growth", "efficient tools"],
      goals: ["make high-quality decisions faster", "avoid expensive mistakes"],
      constraints: ["prefers practical options", "limited tolerance for unclear tradeoffs"],
      budgetAmount: 80000,
      budgetCurrency: "INR",
    },
  });

  const existingPreferenceCount = await prisma.userPreference.count({
    where: { userId: user.id },
  });

  if (existingPreferenceCount === 0) {
    await prisma.userPreference.createMany({
      data: [
        {
          userId: user.id,
          category: "budget",
          label: "strong value sensitivity",
          weight: 0.82,
          polarity: "positive",
          source: "seed",
          evidence: ["Demo user default profile"],
        },
        {
          userId: user.id,
          category: "risk",
          label: "prefers justified downside analysis",
          weight: 0.76,
          polarity: "positive",
          source: "seed",
          evidence: ["Demo user default profile"],
        },
        {
          userId: user.id,
          category: "speed",
          label: "values fast payoff",
          weight: 0.64,
          polarity: "positive",
          source: "seed",
          evidence: ["Demo user default profile"],
        },
      ],
    });
  }

  console.log(`Seeded demo user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
