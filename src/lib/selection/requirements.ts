/**
 * Prompt Requirements extraction (Milestone 20, Step 1) — DETERMINISTIC, no LLM.
 *
 * Turns the Creative Director's reasoning (`directive.meta`: scene, intent, composition) + a keyword
 * scan of the user's idea into structured `PromptRequirements` — "what must the reference package
 * show for THIS request?". Pure; provider-neutral; identity-independent (it reads the PROMPT, not the
 * identity). Matching against a specific identity happens later in match.ts.
 */
import type { CreativeDirective } from "@/lib/creative/types";
import type { PromptRequirements, Requirement, RequirementId } from "./types";

const LABELS: Record<RequirementId, string> = {
  face: "face",
  frontFace: "front face",
  profile: "profile",
  backView: "back view",
  smile: "smile",
  expression: "expression",
  visibleEyes: "visible eyes",
  fullBody: "full body",
  upperBody: "upper body",
  hands: "hands",
  feet: "feet",
  hair: "hair",
  chestTattoos: "chest tattoos",
  armTattoos: "arm tattoos",
  backTattoos: "back tattoos",
  legTattoos: "leg tattoos",
  indoor: "indoor setting",
  outdoor: "outdoor setting",
  elegantClothing: "elegant clothing",
  swimwear: "swimwear",
  businessWear: "business wear",
  action: "action",
};

const WEIGHTS: Record<RequirementId, number> = {
  face: 3,
  frontFace: 3,
  profile: 2,
  backView: 2.5,
  smile: 1.5,
  expression: 1.5,
  visibleEyes: 1,
  fullBody: 2.5,
  upperBody: 1.5,
  hands: 1,
  feet: 0.8,
  hair: 1.2,
  chestTattoos: 2,
  armTattoos: 2,
  backTattoos: 2,
  legTattoos: 2,
  indoor: 0.6,
  outdoor: 0.6,
  elegantClothing: 1,
  swimwear: 1,
  businessWear: 1,
  action: 1,
};

/**
 * Body/clothing/scene-dependent prompts (a bikini beach shot, a full-length fashion pose) should
 * optimize for the requested SCENE, not just the strongest face. When `bodyDependent`, body-family
 * requirements outweigh the face — the face stays present + high (never dropped; it's still an active
 * requirement, always covered), just no longer overwhelming. Requested by real drift testing.
 */
const BODY_DEPENDENT_WEIGHTS: Partial<Record<RequirementId, number>> = {
  fullBody: 3.5,
  upperBody: 2,
  legTattoos: 2.5,
  armTattoos: 2.5,
  chestTattoos: 2.5,
  feet: 1,
  swimwear: 2,
  elegantClothing: 1.5,
  businessWear: 1.5,
  outdoor: 1,
  face: 2, // softened (was 3) so a strong body/scene reference can lead
  frontFace: 2,
};

const has = (s: string, ...needles: string[]): boolean => needles.some((n) => s.includes(n));

/** Extract structured requirements from the Director's directive. Deterministic. */
export function extractPromptRequirements(directive: CreativeDirective): PromptRequirements {
  const idea = directive.meta.idea.toLowerCase();
  const { scene, intent, composition } = directive.meta;
  const actions = scene.actions.map((a) => a.toLowerCase()).join(" ");
  const text = `${idea} ${actions}`;
  const cam = composition.cameraDistance;

  // ── clothing / exposure ──────────────────────────────────────────────────
  const swimwear = has(text, "bikini", "swimsuit", "swimwear", "swimming", "in the pool");
  const businessWear = has(text, "business", "office", "suit", "corporate", "professional", "formal");
  const elegantClothing = has(text, "gown", "elegant", "evening dress", "gala", "red carpet", "cocktail dress");
  // Skin/limb exposure → prefer references that render those limbs accurately (incl. their tattoos).
  const legsExposed = swimwear || has(text, "shorts", "skirt", "mini", "beach", "dress");
  const armsExposed = swimwear || has(text, "sleeveless", "tank top", "t-shirt", "short sleeve", "beach");

  // ── view / framing ───────────────────────────────────────────────────────
  const backView = has(text, "back view", "from behind", "back of", "rear view", "seen from behind");
  const profile = has(text, "profile", "side view", "side profile");
  const wide = cam === "wide" || cam === "panoramic";
  const close = cam === "close-up";
  const fullBody =
    wide ||
    intent.type === "fashion" ||
    has(text, "full body", "full-length", "head to toe", "standing", "walking", "dancing", "yacht", "runway") ||
    swimwear ||
    elegantClothing;
  const upperBody = close || cam === "medium" || intent.type === "portrait" || businessWear;

  // ── explicit tattoo mentions (HARD) vs exposure-implied (SOFT) ────────────
  const anyTattoo = has(text, "tattoo", "tattoos", "ink", "inked");
  const legTattoosHard = has(text, "leg tattoo", "thigh tattoo", "calf tattoo");
  const armTattoosHard = has(text, "arm tattoo", "sleeve tattoo", "sleeve");
  const chestTattoosHard = has(text, "chest tattoo");
  const backTattoosHard = has(text, "back tattoo") || (backView && anyTattoo);

  const flags: Record<RequirementId, boolean> = {
    face: !backView,
    // upperBody already covers close-up / medium / portrait / business framings.
    frontFace: !backView && !profile && upperBody,
    profile,
    backView,
    smile: has(text, "smil", "happy", "cheerful", "grinning"),
    expression: has(text, "smil", "laugh", "serious", "angry", "surprised", "expression", "emotion"),
    visibleEyes: !backView,
    fullBody,
    upperBody: upperBody && !fullBody,
    hands: has(text, "holding", "hand", "waving", "gesture", "pointing", "raising"),
    feet: has(text, "feet", "barefoot", "foot", "toes") || (fullBody && (swimwear || has(text, "beach"))),
    hair: true, // hair is identity-defining; low weight
    // Exposure implies a SOFT interest in tattoos there — prefer refs that render the visible limb
    // accurately (incl. its tattoos) IF the identity has any; never warns when she doesn't.
    chestTattoos: chestTattoosHard || swimwear,
    armTattoos: armTattoosHard || armsExposed,
    backTattoos: backTattoosHard,
    legTattoos: legTattoosHard || legsExposed,
    indoor: scene.environment === "indoor" || has(text, "office", "room", "indoors", "studio", "cafe"),
    outdoor:
      scene.environment === "outdoor" ||
      has(text, "beach", "yacht", "park", "street", "outdoors", "outside", "mountain", "city", "garden"),
    elegantClothing,
    swimwear,
    businessWear,
    action: has(text, "running", "jumping", "dancing", "swimming", "walking", "riding", "playing"),
  };

  // Requirements whose tattoo interest is only IMPLIED by exposure are SOFT (no warning if the
  // identity happens to have no tattoo there). Explicit prompt mentions are HARD.
  const softTattoo: Partial<Record<RequirementId, boolean>> = {
    chestTattoos: !chestTattoosHard,
    armTattoos: !armTattoosHard,
    legTattoos: !legTattoosHard,
    backTattoos: !backTattoosHard,
  };

  // Scene-aware weighting: body/clothing/action prompts favor body-family references over a bare face.
  const bodyDependent =
    swimwear || fullBody || elegantClothing || flags.action || intent.type === "fashion";
  const weightFor = (id: RequirementId): number =>
    bodyDependent && BODY_DEPENDENT_WEIGHTS[id] !== undefined
      ? (BODY_DEPENDENT_WEIGHTS[id] as number)
      : WEIGHTS[id];

  const active: Requirement[] = (Object.keys(flags) as RequirementId[])
    .filter((id) => flags[id])
    .map((id) => ({ id, label: LABELS[id], weight: weightFor(id), soft: Boolean(softTattoo[id]) }));

  return { flags, active };
}
