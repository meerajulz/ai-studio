/**
 * Transformation Planner (Milestone 25.1) — pure, deterministic.
 *
 * Given a known character (identity Vision knowledge) and the analyzed request, produce an explicit
 * preserve-vs-change instruction for the edit model. This is the first step of "Transformation
 * Intelligence" (Decision 062): decide what to hold constant vs vary BEFORE the model is called.
 *
 * Grounded, not hardcoded: `preserve` reflects what the character actually has (tattoos/piercings/
 * facial hair are only listed when present); `change` reflects what the prompt actually introduces
 * (setting/pose/outfit/hair/expression/lighting), read from the already-computed Scene + the idea.
 * Never invents change targets — over-instructing an edit model degrades it.
 */
import type { CreativeDirective } from "@/lib/creative";
import type { IdentityMetadata } from "@/lib/vision";

import type { TransformationPlan } from "./types";

// Idea-level cues for facets the analyzed Scene doesn't structure (outfit/hair/expression/lighting).
const OUTFIT = /\b(bikini|swimsuit|swimwear|lingerie|dress|gown|suit|tuxedo|outfit|clothes|clothing|wearing|jacket|coat|uniform|costume|armou?r|robe|shirt|jeans|skirt|hoodie|sweater|blouse|top|shorts|leather|kimono)\b/i;
const HAIR = /\b(hair|hairstyle|haircut|ponytail|braid|bun|bangs|fringe|curls?|curly|straightened|dyed|blonde|brunette|redhead|updo|bald|shaved head|pixie|bob)\b/i;
const EXPRESSION = /\b(smil\w*|laugh\w*|grin\w*|serious|angry|sad|surpris\w*|frown\w*|cry\w*|wink\w*|expression|pout\w*|scowl\w*)\b/i;
const LIGHTING = /\b(lighting|neon|sunset|sunrise|golden hour|backlit|candlelit|moonlight|studio light|spotlight|dramatic light)\b/i;

const PIERCING = /(piercing|gauge|septum|nostril|stud|labret|helix|industrial|eyebrow ring|nose ring)/i;

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** Does any analyzed image show tattoos / piercings / facial hair? (grounds the preserve list). */
function characterTraits(metadatas: IdentityMetadata[]) {
  const hasTattoos = metadatas.some((m) => (m.tattoos?.length ?? 0) > 0);
  const accessories = metadatas.flatMap((m) => m.accessories ?? []);
  const hasPiercings = accessories.some((a) => PIERCING.test(a));
  const hasFacialHair = metadatas.some((m) => Boolean(m.facialHair));
  return { hasTattoos, hasPiercings, hasFacialHair };
}

/**
 * Plan the transformation. `applies` is true only on the real edit path — an identity WITH references
 * AND grounded knowledge — so the no-identity / text-to-image path is byte-for-byte unchanged.
 */
export function planTransformation(input: {
  hasIdentity: boolean;
  hasReferences: boolean;
  metadatas: IdentityMetadata[];
  directive: CreativeDirective;
}): TransformationPlan {
  const empty: TransformationPlan = {
    applies: false,
    preserve: [],
    change: [],
    instruction: "",
    negativePrompt: null,
  };

  // Only a KNOWN character being edited into a new context is a transformation. Without analyzed
  // knowledge we can't ground "preserve", so we stay out of the way (current behavior).
  if (!input.hasIdentity || !input.hasReferences || input.metadatas.length === 0) return empty;

  const { hasTattoos, hasPiercings, hasFacialHair } = characterTraits(input.metadatas);
  const idea = input.directive.meta.idea.toLowerCase();
  const scene = input.directive.meta.scene;

  // PRESERVE — identity-defining traits, only what the character actually has.
  const preserve = uniq([
    "facial identity",
    "facial features (eyes, nose, mouth)",
    "skin tone",
    "body proportions",
    "age",
    hasTattoos ? "all tattoos (exact placement and style)" : "",
    hasPiercings ? "piercings" : "",
    hasFacialHair ? "facial hair" : "",
  ]);

  // CHANGE — only facets the request actually introduces (never fabricate).
  const changingHair = HAIR.test(idea);
  const change = uniq([
    scene.setting || scene.location || scene.environment !== "unknown" ? "the setting and background" : "",
    scene.actions.length ? "pose" : "",
    OUTFIT.test(idea) ? "outfit" : "",
    changingHair ? "hairstyle" : "",
    EXPRESSION.test(idea) ? "expression" : "",
    scene.timeOfDay || scene.weather || LIGHTING.test(idea) ? "lighting" : "",
  ]);
  // A transformation always at least re-scenes the subject; guarantee one change target.
  if (change.length === 0) change.push("the setting and background");

  const instruction =
    `Preserve this person's identity exactly. Keep unchanged: ${preserve.join(", ")}. ` +
    `Change only: ${change.join(", ")}.`;

  return {
    applies: true,
    preserve,
    change,
    instruction,
    negativePrompt: buildNegativePrompt({ hasTattoos, hasPiercings }),
  };
}

/** Reinforce preservation on models that support a negative prompt (not sent yet — see types.ts). */
function buildNegativePrompt(t: { hasTattoos: boolean; hasPiercings: boolean }): string {
  return uniq([
    "different person",
    "different face",
    "altered facial features",
    "changed identity",
    t.hasTattoos ? "altered tattoos" : "",
    t.hasTattoos ? "added or removed tattoos" : "",
    t.hasTattoos ? "wrong tattoo placement" : "",
    t.hasPiercings ? "added or removed piercings" : "",
    "different body proportions",
    "distorted anatomy",
  ]).join(", ");
}

/** Prepend the preserve-vs-change instruction to the scene prompt (the imperative leads the description). */
export function composeTransformationPrompt(basePrompt: string, plan: TransformationPlan): string {
  if (!plan.applies) return basePrompt;
  return `${plan.instruction} ${basePrompt}`;
}

/**
 * Channel arbitration (Milestone 25.2 Phase C): which appearance FACETS the transformation is changing,
 * so Generation can drop them from the appearance text (a changed facet must be defined once, by the
 * transformation instruction — not contradicted by the old value). Returns `IdentityFacet` strings.
 * See docs/REFERENCE_INTELLIGENCE.md.
 */
export function facetsChangedBy(change: string[]): string[] {
  const text = change.join(" ").toLowerCase();
  const facets: string[] = [];
  if (/hair|hairstyle|haircut|bangs|fringe/.test(text)) facets.push("hair");
  if (/tattoo/.test(text)) facets.push("tattoos");
  if (/piercing/.test(text)) facets.push("piercings");
  return facets;
}
