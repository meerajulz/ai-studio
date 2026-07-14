"use server";

/**
 * Vision debug action (Milestone 19 verification tool) — run the FULL vision pipeline on one image
 * and return everything, with NO persistence: image bytes (a data URL) → provider → raw JSON →
 * normalize → IdentityMetadata → ImageScore → coverage contribution. No Prisma, no Blob, no identity
 * package, no generation. Auth-gated so it isn't an open Gemini proxy. See /debug/vision.
 */
import { requireUserId } from "@/lib/auth/session";
import {
  analyzeIdentityCoverage,
  isVisionConfigured,
  normalizeToIdentityMetadata,
  routeVisionProvider,
  scoreIdentityImage,
  type CoverageReport,
  type IdentityImageScore,
  type IdentityMetadata,
  type VisionObservation,
} from "@/lib/vision";

export type VisionDebugResult = {
  provider: string;
  model: string;
  durationMs: number;
  raw: unknown; // full provider response (incl. usage metadata)
  observation: VisionObservation;
  metadata: IdentityMetadata;
  score: IdentityImageScore;
  coverage: CoverageReport; // single-image coverage contribution
  tokenUsage: { prompt: number | null; candidates: number | null; total: number | null } | null;
  warnings: string[];
};

function extractTokenUsage(raw: unknown): VisionDebugResult["tokenUsage"] {
  const meta =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).usageMetadata
      : null;
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    prompt: num(m.promptTokenCount),
    candidates: num(m.candidatesTokenCount),
    total: num(m.totalTokenCount),
  };
}

function buildWarnings(metadata: IdentityMetadata): string[] {
  const w: string[] = [];
  if (!metadata.face.visible) w.push("Face not detected in this image.");
  if (metadata.face.orientation === "unknown") w.push("Face orientation is unknown.");
  if (metadata.tattoos.length === 0) w.push("No tattoos detected.");
  if (!metadata.quality.usable) {
    w.push(`Image flagged NOT usable${metadata.quality.issues.length ? ": " + metadata.quality.issues.join(", ") : ""}.`);
  }
  for (const [attr, conf] of Object.entries(metadata.attributeConfidence)) {
    if (conf < 0.5) w.push(`Low confidence: ${attr} (${Math.round(conf * 100)}%).`);
  }
  for (const t of metadata.tattoos) {
    if (t.confidence < 0.5) w.push(`Low-confidence tattoo: ${t.location} (${Math.round(t.confidence * 100)}%).`);
  }
  return w;
}

export async function analyzeVisionDebug(dataUrl: string): Promise<VisionDebugResult> {
  await requireUserId(); // gate — never an open Gemini proxy
  if (!dataUrl.startsWith("data:")) throw new Error("Expected an image data URL.");
  if (!isVisionConfigured()) {
    throw new Error("No vision provider is configured. Set GEMINI_API_KEY and restart the dev server.");
  }

  const { provider } = routeVisionProvider({ needs: ["attributes", "quality"] });

  const start = Date.now();
  const observation = await provider.analyzeImage({ imageUrl: dataUrl });
  const durationMs = Date.now() - start;

  const metadata = normalizeToIdentityMetadata(observation);
  const score = scoreIdentityImage(metadata);
  const coverage = analyzeIdentityCoverage([metadata]);

  return {
    provider: observation.provider,
    model: observation.model,
    durationMs,
    raw: observation.raw ?? null,
    observation,
    metadata,
    score,
    coverage,
    tokenUsage: extractTokenUsage(observation.raw),
    warnings: buildWarnings(metadata),
  };
}
