/**
 * Stage 0 — Identity Context (Milestone 14).
 *
 * The FIRST reasoning stage. When an identity is selected, it weaves a subject reference (name +
 * description) into the idea so every downstream stage (scene → spatial → intent → composition →
 * compile) reasons about the identity as the subject — without any stage knowing what an
 * "identity" is. Pure + deterministic. Identity is PASSIVE: this stage only reads the context the
 * generation layer already loaded; it never fetches data and never touches a provider.
 *
 * This foundation deliberately uses only name + description (provider artifacts like LoRA are
 * reserved for a later milestone). It proves the architecture and UX, not image quality.
 */
import type { IdentityContext, IdentityReasoning } from "../types";

const EMPTY: IdentityReasoning = {
  present: false,
  name: null,
  referencePhrase: null,
  signals: { hasDescription: false, hasHeroImage: false, trainingMediaCount: 0 },
};

export function resolveIdentity(
  idea: string,
  identity?: IdentityContext | null,
): { effectiveIdea: string; reasoning: IdentityReasoning } {
  if (!identity) return { effectiveIdea: idea, reasoning: EMPTY };

  const description = identity.description?.trim() || null;
  // The subject reference the downstream pipeline reasons over. Description carries the visual
  // traits a provider can actually use; the name is provenance the user recognizes.
  const referencePhrase = description
    ? `${identity.name}, ${description}`
    : identity.name;

  // Weave the identity in as the subject, then the user's idea. The user's original idea is still
  // stored verbatim on the Generation record (the generation layer keeps `brief.idea` untouched).
  const effectiveIdea = idea ? `${referencePhrase}, ${idea}` : referencePhrase;

  return {
    effectiveIdea,
    reasoning: {
      present: true,
      name: identity.name,
      referencePhrase,
      signals: {
        hasDescription: description !== null,
        hasHeroImage: identity.hasHeroImage,
        trainingMediaCount: identity.trainingMediaCount,
      },
    },
  };
}
