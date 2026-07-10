/**
 * Prisma 7 runtime client (singleton).
 *
 * Prisma 7 no longer reads the connection URL from `schema.prisma`; the runtime
 * client connects through a **driver adapter**. Here we use `@prisma/adapter-neon`
 * (Neon serverless driver over WebSockets).
 *
 * The singleton pattern prevents new `PrismaClient` instances from piling up during
 * Next.js hot-reload in development (which would exhaust database connections).
 *
 * Import the shared instance via the barrel: `import { prisma } from "@/lib/db"`.
 */
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add your Neon connection string to .env.",
  );
}

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

// Reuse the instance across hot reloads in dev by stashing it on globalThis.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientSingleton;
};

export const prisma: PrismaClientSingleton =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
