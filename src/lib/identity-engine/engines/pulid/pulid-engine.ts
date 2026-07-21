/**
 * PuLID Engine (Milestone 22 architecture · Milestone 24.5 enabled).
 *
 * A `faceId` adapter: PuLID-Flux (`fal-ai/flux-pulid`) generates from a SINGLE face image + prompt —
 * zero-shot (no training, no precomputed embedding). It is face-only (no tattoo/body preservation) and
 * mutually exclusive with LoRA/Kontext in one hosted call, so the engine treats it as a PRIMARY
 * technique, not additive. Availability = the identity has analyzed images (a face reference exists);
 * `contribute` picks the strongest frontal face (the Identity Anchor) via the existing selection layer.
 */
import { filterCandidatesByExposure, pickIdentityAnchor } from "@/lib/selection";
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContext,
  ConditioningContribution,
  ConditioningRequest,
  ModuleAvailability,
} from "../../types";

export const pulidEngine: IdentityModule = {
  id: "pulid",
  label: "PuLID Engine",
  kind: "adapter",
  priority: 70,
  enabled: true, // Milestone 24.5 — zero-shot; available as soon as the library is analyzed
  autoSelect: false, // face-only trade-off (no tattoos/scene) → opt-in via the strategy benchmark, not auto

  async availability(ctx: ConditioningContext): Promise<ModuleAvailability> {
    if (!ctx.hasAnalyzedCandidates) {
      return { available: false, reason: "no analyzed images — analyze the library to enable PuLID" };
    }
    return { available: true, reason: "PuLID face conditioning available (zero-shot)" };
  },

  async contribute(
    _ctx: ConditioningContext,
    req: ConditioningRequest,
  ): Promise<ConditioningContribution> {
    // Pick the strongest frontal face, exposure-filtered (never send a nude/lingerie face reference).
    const safe = filterCandidatesByExposure(req.directive, req.candidates ?? []).safe;
    const face = safe.length ? pickIdentityAnchor(safe) : null;
    if (!face) {
      return { part: "pulid", reason: "no suitable frontal face for PuLID" };
    }
    return {
      part: "pulid",
      pulidReferenceUrl: face.url,
      pulidIdWeight: 1,
      adapterInputs: { pulid: { referenceUrl: face.url, idWeight: 1 } },
      reason: "conditioning identity with PuLID (face reference)",
    };
  },
};
