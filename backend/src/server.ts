import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createApp } from "./app.js";
import { ensureDemoUser } from "./modules/auth/service.js";
import { initializeMemoryStore } from "./services/memory/chroma.js";

async function bootstrap() {
  await prisma.$connect();
  await initializeMemoryStore();

  if (env.ENABLE_GUEST_MODE) {
    await ensureDemoUser();
  }

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`Synod backend listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error("Failed to start Synod backend");
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
