/**
 * Public entry point for the database layer.
 *
 * Consumers should import from `@/lib/db` — never from `@/generated/prisma`
 * directly — so the underlying client/ORM can evolve without touching callers.
 *
 *   import { prisma } from "@/lib/db";
 *   import type { User, Generation } from "@/lib/db";
 *   import { Prisma } from "@/lib/db"; // enums, input types, etc.
 *
 * Repositories/query helpers will be added under this folder later and re-exported
 * here (see README.md).
 */
export { prisma } from "./client";

// Model types, enums, and the `Prisma` namespace from the generated client.
export * from "@/generated/prisma/client";
