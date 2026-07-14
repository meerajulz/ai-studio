/**
 * Creative Director — the deterministic enrichment engine (Milestone 12 MVP).
 *
 * `directCreative(brief)` turns a plain creative idea into a professional, provider-neutral
 * prompt. It is PURE and DETERMINISTIC (same brief → same directive; no I/O, no provider SDKs,
 * no AI). This is the ONLY place in the app that enriches prompts — everything else passes the
 * user's words straight through to here.
 *
 * It is intentionally a small rules engine so it can be swapped for an LLM later WITHOUT
 * changing callers: the contract is `CreativeBrief → CreativeDirective`. See docs/CREATIVE_DIRECTOR.md.
 */
import {
  CREATIVE_DIRECTOR_VERSION,
  DEFAULT_FOCUS,
  DEFAULT_STYLE,
  type CreativeBrief,
  type CreativeDirective,
  type CreativeFocus,
  type CreativeStyle,
  type SubjectCategory,
} from "./types";

/** A style preset: how the Director phrases a look, its lighting, and quality floor. */
type StylePreset = {
  descriptor: string;
  lighting: string;
  /** Always-applied "professional" quality terms — the baseline that lifts image quality. */
  quality: string[];
};

const STYLE_PRESETS: Record<CreativeStyle, StylePreset> = {
  realistic: {
    descriptor: "photorealistic",
    lighting: "natural soft lighting",
    quality: [
      "highly detailed",
      "sharp focus",
      "professional photography",
      "high resolution",
    ],
  },
  cinematic: {
    descriptor: "cinematic film still",
    lighting: "dramatic cinematic lighting",
    quality: [
      "shallow depth of field",
      "color graded",
      "highly detailed",
      "8k",
    ],
  },
  illustration: {
    descriptor: "digital illustration",
    lighting: "soft studio lighting",
    quality: [
      "clean linework",
      "vibrant colors",
      "highly detailed",
      "concept art",
    ],
  },
  fantasy: {
    descriptor: "epic fantasy art",
    lighting: "ethereal atmospheric lighting",
    quality: [
      "intricate detail",
      "dramatic atmosphere",
      "concept art",
      "highly detailed",
    ],
  },
};

/** Framing: how a subject is composed + what detail it prioritizes. */
type Framing = {
  focus: Exclude<CreativeFocus, "auto">;
  composition: string; // "" = no framing hint (never forces a shot type)
  modifiers: string[];
};

/**
 * Per-category framing. This is the fix for the "everything becomes a portrait" bug: only
 * `person`/`animal` use portrait/eye framing; every other category — and the neutral `object`
 * fallback — stays free of people-biasing tokens.
 */
const CATEGORY_FRAMING: Record<SubjectCategory, Framing> = {
  person: {
    focus: "face",
    composition: "portrait",
    modifiers: ["detailed skin texture", "catchlight in the eyes"],
  },
  animal: {
    focus: "face",
    composition: "portrait",
    modifiers: ["detailed fur", "expressive eyes"],
  },
  interior: {
    focus: "environment",
    composition: "wide-angle interior shot",
    modifiers: ["natural light", "architectural detail"],
  },
  place: {
    focus: "environment",
    composition: "wide establishing shot",
    modifiers: ["atmospheric depth", "rich detail"],
  },
  food: {
    focus: "product",
    composition: "close-up food photography",
    modifiers: ["appetizing detail", "fresh"],
  },
  vehicle: {
    focus: "product",
    composition: "three-quarter view",
    modifiers: ["glossy reflections", "detailed bodywork"],
  },
  product: {
    focus: "product",
    composition: "centered product shot",
    modifiers: ["soft reflections", "clean background"],
  },
  // NEUTRAL fallback: no portrait, no eyes, no forced shot type. Just the subject + style floor.
  object: {
    focus: "product",
    composition: "",
    modifiers: [],
  },
};

/**
 * Explicit-focus framing (when the user answers the optional "What matters most?" question).
 * Overrides auto-detection. Kept separate from category detection.
 */
const FOCUS_FRAMING: Record<Exclude<CreativeFocus, "auto">, Framing> = {
  face: CATEGORY_FRAMING.person,
  environment: CATEGORY_FRAMING.place,
  product: CATEGORY_FRAMING.product,
  action: {
    focus: "action",
    composition: "dynamic action shot",
    modifiers: ["sense of motion", "energetic composition"],
  },
};

/**
 * Category detection — maps keywords in the idea to a subject category. Deterministic and
 * order-sensitive (first match wins). Unknown → `object` (neutral). This is the "understanding"
 * an LLM would later replace.
 */
const CATEGORY_RULES: ReadonlyArray<{ category: SubjectCategory; test: RegExp }> = [
  {
    category: "person",
    test: /\b(man|men|woman|women|person|people|boy|girl|kid|child|portrait|face|model|lady|guy|selfie|headshot)\b/i,
  },
  {
    category: "animal",
    test: /\b(dog|puppy|cat|kitten|pet|animal|horse|bird|fox|wolf|lion|tiger|rabbit|bear|deer)\b/i,
  },
  {
    category: "interior",
    test: /\b(kitchen|bathroom|bedroom|living room|dining room|office|interior|hallway|room|loft|apartment|lobby)\b/i,
  },
  {
    category: "food",
    test: /\b(food|dish|meal|cake|coffee|drink|burger|pizza|dessert|sushi|salad|breakfast|sandwich)\b/i,
  },
  {
    category: "vehicle",
    test: /\b(car|vehicle|motorcycle|bike|truck|plane|boat|bus|van)\b/i,
  },
  {
    category: "product",
    test: /\b(product|bottle|watch|shoe|sneaker|phone|packaging|cosmetic|gadget|jewelry|laptop|camera)\b/i,
  },
  {
    category: "place",
    test: /\b(landscape|mountain|forest|beach|city|sunset|ocean|sea|lake|valley|sky|nature|desert|street|park|garden|skyline|field)\b/i,
  },
];

/**
 * Detects when the idea explicitly EXCLUDES people ("no person", "without people", "empty",
 * "no one", "nobody"). Used so a negated people keyword does NOT force a portrait — the exact
 * bug behind `modern living room … no person on it` → a man.
 */
const PEOPLE_NEGATION =
  /\b(no|without|not|zero)\s+(?:\w+\s+){0,2}(person|people|man|men|woman|women|human|humans|one|figure|subject|character)\b|\bno one\b|\bnobody\b|\bunoccupied\b/i;

/** Classify the idea into a subject category (the Director's intent). */
function detectCategory(idea: string): SubjectCategory {
  const peopleNegated = PEOPLE_NEGATION.test(idea);
  for (const rule of CATEGORY_RULES) {
    if (!rule.test.test(idea)) continue;
    // A negated people mention (e.g. "no person") must not be read as a person subject.
    if (rule.category === "person" && peopleNegated) continue;
    return rule.category;
  }
  return "object"; // neutral fallback — never biases toward a person/portrait
}

/**
 * Compose the final prompt: the user's idea first, then only NEW phrases (deduped, empties
 * dropped, and never repeating something the user already said). Returns the prompt + added terms.
 */
function compose(idea: string, phrases: string[]): { prompt: string; applied: string[] } {
  const ideaLower = idea.toLowerCase();
  const seen = new Set<string>([ideaLower]);
  const parts: string[] = [idea];
  const applied: string[] = [];

  for (const phrase of phrases) {
    const key = phrase.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    if (ideaLower.includes(key)) continue; // the user already expressed this
    seen.add(key);
    parts.push(phrase);
    applied.push(phrase);
  }

  return { prompt: parts.join(", "), applied };
}

/**
 * Transform a creative brief into a professional prompt. The single public entry point of the
 * Creative Director. Pure + deterministic.
 */
export function directCreative(brief: CreativeBrief): CreativeDirective {
  const idea = brief.idea.trim();
  const style: CreativeStyle = brief.style ?? DEFAULT_STYLE;
  const requestedFocus: CreativeFocus = brief.focus ?? DEFAULT_FOCUS;

  const category = detectCategory(idea);
  // Auto → the category's natural framing; an explicit focus answer overrides it.
  const framing: Framing =
    requestedFocus === "auto"
      ? CATEGORY_FRAMING[category]
      : FOCUS_FRAMING[requestedFocus];

  const stylePreset = STYLE_PRESETS[style];

  // Order matters: subject detail → framing → look → lighting → quality floor.
  const { prompt, applied } = compose(idea, [
    ...framing.modifiers,
    framing.composition,
    stylePreset.descriptor,
    stylePreset.lighting,
    ...stylePreset.quality,
  ]);

  return {
    prompt,
    params: {}, // reserved (aspect ratio / quality tier) — future
    meta: {
      version: CREATIVE_DIRECTOR_VERSION,
      idea,
      style,
      category,
      focus: framing.focus,
      appliedModifiers: applied,
      identityAware: Boolean(brief.identityId),
    },
  };
}
