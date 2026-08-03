"use server";

/**
 * Selection debug action (Milestone 20 transparency tool) — run the FULL Smart Reference Selection
 * pipeline on an ad-hoc prompt + a handful of uploaded images, with NO persistence: prompt →
 * Creative Director → Prompt Requirements → analyze each image (Vision) → match → package
 * optimization → reasons + warnings. No Prisma, no Blob, no generation. Auth-gated. See /debug/selection.
 */
import { requireUserId } from "@/lib/auth/session";
import { directCreative } from "@/lib/creative";
import {
  buildReferencePackage,
  matchImage,
  extractPromptRequirements,
  type SelectionCandidate,
} from "@/lib/selection";
import {
  isVisionConfigured,
  normalizeToIdentityMetadata,
  routeVisionProvider,
  scoreIdentityImage,
} from "@/lib/vision";

export type SelectionDebugResult = {
  requirements: string[];
  ranked: {
    mediaId: string;
    baseScore: number;
    perRequirement: { id: string; score: number }[];
  }[];
  package: { mediaId: string; role: string; reason: string; satisfies: string[]; matchScore: number }[];
  warnings: string[];
  orderedReferenceUrls: string[];
};

export async function analyzeSelectionDebug(
  prompt: string,
  dataUrls: string[],
): Promise<SelectionDebugResult> {
  await requireUserId(); // gate — never an open Gemini proxy
  if (!prompt.trim()) throw new Error("Enter a prompt.");
  if (!dataUrls.length) throw new Error("Add at least one image.");
  if (!isVisionConfigured()) {
    throw new Error("No vision provider configured. Set GEMINI_API_KEY and restart the dev server.");
  }

  const directive = directCreative({ idea: prompt.trim() });
  const requirements = extractPromptRequirements(directive);
  const { provider } = routeVisionProvider({ needs: ["attributes", "quality"] });

  // Analyze each uploaded image → a selection candidate (no persistence).
  const candidates: SelectionCandidate[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const observation = await provider.analyzeImage({ imageUrl: dataUrls[i] });
    const metadata = normalizeToIdentityMetadata(observation);
    candidates.push({
      mediaId: `image-${i + 1}`,
      url: dataUrls[i],
      metadata,
      score: scoreIdentityImage(metadata),
    });
  }

  const selection = buildReferencePackage(directive, candidates);

  return {
    requirements: requirements.active.map((r) => r.label),
    ranked: selection.ranked.map((m) => ({
      mediaId: m.mediaId,
      baseScore: m.baseScore,
      perRequirement: requirements.active.map((r) => ({
        id: r.label,
        score: matchImage(m.candidate, requirements).perRequirement[r.id] ?? 0,
      })),
    })),
    package: selection.package.map((p) => ({
      mediaId: p.mediaId,
      role: p.role,
      reason: p.reason,
      satisfies: p.satisfies,
      matchScore: p.matchScore,
    })),
    warnings: selection.warnings,
    orderedReferenceUrls: selection.orderedReferenceUrls,
  };
}
