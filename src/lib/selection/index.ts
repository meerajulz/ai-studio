/**
 * Smart Reference Selection (Milestone 20) — the "Reference Selector" layer.
 *
 * Consumes the Creative Director's output + an identity's persisted Vision knowledge and returns an
 * ordered, explained package of reference images optimized FOR THIS REQUEST. Pure, deterministic,
 * provider-neutral — providers receive `orderedReferenceUrls` and never know how they were chosen.
 * See docs/SMART_REFERENCE_SELECTION.md.
 */
import type { CreativeDirective } from "@/lib/creative/types";
import { extractPromptRequirements } from "./requirements";
import { selectReferencePackage } from "./select";
import type { SelectionCandidate, SelectionResult } from "./types";

/** Directive + identity candidates → the selected reference package. The single entry point. */
export function buildReferencePackage(
  directive: CreativeDirective,
  candidates: SelectionCandidate[],
  opts: { max?: number } = {},
): SelectionResult {
  const requirements = extractPromptRequirements(directive);
  return selectReferencePackage(candidates, requirements, opts);
}

export { extractPromptRequirements } from "./requirements";
export { matchImage } from "./match";
export { selectReferencePackage } from "./select";
export { pickIdentityAnchor } from "./anchor";
export {
  allowedExposureForPrompt,
  filterCandidatesByExposure,
  type ExposureFilterResult,
} from "./exposure";
export type {
  ImageMatch,
  PromptRequirements,
  ReferenceRole,
  Requirement,
  RequirementId,
  SelectedReference,
  SelectionCandidate,
  SelectionResult,
} from "./types";
