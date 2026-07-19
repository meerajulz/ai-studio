/**
 * Identity Engine (Milestone 22) — Identity Artifacts read-model. Owner-scoped, server-side.
 *
 * `IdentityArtifact` is the generic, versioned store for generated identity RESOURCES — LoRAs,
 * embeddings, adapter files, ID vectors — not only media. This read-model surfaces them for future
 * engines (a PuLID module reads its embedding here). Empty today; no writes in this milestone.
 */
import { prisma } from "@/lib/db";

export type IdentityArtifactRecord = {
  id: string;
  kind: string; // "lora" | "embedding" | "id-vector" | "adapter" | …
  engine: string | null;
  version: number;
  ref: string;
  metadata: unknown;
  createdAt: Date;
};

/** List an identity's artifacts (owner-scoped). Optionally filter by `kind`. */
export async function getIdentityArtifacts(
  userId: string,
  identityId: string,
  opts: { kind?: string } = {},
): Promise<IdentityArtifactRecord[]> {
  const rows = await prisma.identityArtifact.findMany({
    where: { identityId, userId, ...(opts.kind ? { kind: opts.kind } : {}) },
    orderBy: [{ kind: "asc" }, { version: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    engine: r.engine,
    version: r.version,
    ref: r.ref,
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));
}
