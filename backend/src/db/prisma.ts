import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __synodPrisma__: PrismaClient | undefined;
}

export const prisma =
  global.__synodPrisma__ ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__synodPrisma__ = prisma;
}
