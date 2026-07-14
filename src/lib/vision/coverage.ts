/**
 * Identity Coverage (Milestone 18A) — the per-identity aggregate over its analyzed images.
 *
 * Answers "what does this identity's reference set cover, and what's missing?" — the basis for
 * automatic Hero/reference selection and request-aware selection (RESEARCH_02 §12). Pure +
 * deterministic; provider-neutral (it reads only normalized `IdentityMetadata`). No I/O.
 */
import type { IdentityCoverage, IdentityMetadata } from "./types";

const unique = (xs: (string | null)[]): string[] =>
  [...new Set(xs.filter((x): x is string => Boolean(x)))];

export function computeIdentityCoverage(
  metadatas: IdentityMetadata[],
  totalImages: number = metadatas.length,
): IdentityCoverage {
  const analyzedImages = metadatas.length;
  const usableImages = metadatas.filter((m) => m.quality.usable).length;

  const hasFrontFace = metadatas.some((m) => m.face.visible && m.face.orientation === "front");
  const hasProfile = metadatas.some((m) => m.face.orientation === "profile");
  const hasFullBody = metadatas.some((m) => m.body.framing === "full-body");
  const hasUpperBody = metadatas.some(
    (m) => m.body.framing === "half-body" || m.body.visibility === "upper",
  );

  const hairColors = unique(metadatas.map((m) => m.hair.color));
  const tattooLocations = unique(metadatas.flatMap((m) => m.tattoos.map((t) => t.location)));

  const averageQuality = analyzedImages
    ? Math.round(metadatas.reduce((sum, m) => sum + m.quality.overall, 0) / analyzedImages)
    : 0;

  const gaps: string[] = [];
  if (usableImages === 0) gaps.push("no usable reference images");
  if (!hasFrontFace) gaps.push("no clear front-facing reference");
  if (!hasFullBody) gaps.push("no full-body reference");
  if (!hasUpperBody) gaps.push("no upper-body reference");
  if (analyzedImages < totalImages) {
    gaps.push(`${totalImages - analyzedImages} image(s) not yet analyzed`);
  }

  return {
    totalImages,
    analyzedImages,
    usableImages,
    hasFrontFace,
    hasProfile,
    hasFullBody,
    hasUpperBody,
    hairColors,
    tattooLocations,
    averageQuality,
    gaps,
  };
}
