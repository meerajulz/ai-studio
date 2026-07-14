/**
 * Vision provider capabilities (Milestone 18A — architecture only).
 *
 * Mirrors the image-provider capability system (Decision 007/036): the rest of AI Studio depends on
 * CAPABILITIES, never on a vision vendor's name. A vision provider advertises what it can observe;
 * feature code + the router reason over those capabilities. See docs/research/RESEARCH_02_VISION.md §1.
 */
export type VisionCapability =
  | "caption" // structured/dense description of an image
  | "attributes" // identity attributes (orientation, hair, tattoos visible, expression, …)
  | "detect" // object/region detection (people, clothing, pets, objects, landmarks)
  | "segment" // pixel masks (background, subject, garment)
  | "pose" // body/hand/face landmarks
  | "faceEmbed" // face embedding for identity SIMILARITY (never identification)
  | "embed" // whole-image embedding (similarity, dedup, ranking, search)
  | "quality" // technical quality (blur/exposure/occlusion/crop) + aesthetic score
  | "sceneRecognition"; // place / environment / time-of-day / weather

export type VisionCapabilities = ReadonlySet<VisionCapability>;

export function visionCapabilities(...caps: VisionCapability[]): VisionCapabilities {
  return new Set(caps);
}

export function hasVisionCapability(
  caps: VisionCapabilities,
  cap: VisionCapability,
): boolean {
  return caps.has(cap);
}

export function hasAllVision(
  caps: VisionCapabilities,
  needs: readonly VisionCapability[],
): boolean {
  return needs.every((c) => caps.has(c));
}
