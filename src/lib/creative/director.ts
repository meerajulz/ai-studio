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

/** How each focus emphasis frames the shot + what detail it prioritizes. */
const FOCUS_PRESETS: Record<
  Exclude<CreativeFocus, "auto">,
  { composition: string; modifiers: string[] }
> = {
  face: {
    composition: "portrait, close-up",
    modifiers: ["expressive eyes", "shallow depth of field"],
  },
  environment: {
    composition: "wide establishing shot",
    modifiers: ["atmospheric depth", "expansive vista"],
  },
  product: {
    composition: "centered product shot",
    modifiers: ["studio background", "crisp detail"],
  },
  action: {
    composition: "dynamic action shot",
    modifiers: ["sense of motion", "energetic composition"],
  },
};

/**
 * Subject detection — maps keywords in the idea to a default emphasis and subject-specific
 * detail. Deterministic and order-sensitive (first match wins). This is the "understanding"
 * an LLM would later replace.
 */
const SUBJECT_RULES: ReadonlyArray<{
  test: RegExp;
  focus: Exclude<CreativeFocus, "auto">;
  modifiers: string[];
}> = [
  {
    test: /\b(dog|puppy|cat|kitten|pet|animal|horse|bird|fox|wolf|lion|tiger|rabbit)\b/i,
    focus: "face",
    modifiers: ["detailed fur", "expressive eyes"],
  },
  {
    test: /\b(man|woman|person|people|boy|girl|portrait|face|model|lady|guy)\b/i,
    focus: "face",
    modifiers: ["detailed skin texture", "catchlight in the eyes"],
  },
  {
    test: /\b(food|dish|meal|cake|coffee|drink|burger|pizza|dessert)\b/i,
    focus: "product",
    modifiers: ["appetizing detail", "fresh"],
  },
  {
    test: /\b(product|bottle|watch|shoe|sneaker|phone|packaging|cosmetic|gadget|jewelry)\b/i,
    focus: "product",
    modifiers: ["soft reflections", "clean background"],
  },
  {
    test: /\b(car|vehicle|motorcycle|bike|truck|plane|boat)\b/i,
    focus: "product",
    modifiers: ["glossy reflections", "detailed bodywork"],
  },
  {
    test: /\b(landscape|mountain|forest|beach|city|sunset|ocean|sea|lake|valley|sky|nature|desert|street)\b/i,
    focus: "environment",
    modifiers: ["rich detail", "atmospheric depth"],
  },
];

/** Detect emphasis + subject detail from the idea. Falls back to a portrait-ish default. */
function detectSubject(idea: string): {
  focus: Exclude<CreativeFocus, "auto">;
  modifiers: string[];
} {
  for (const rule of SUBJECT_RULES) {
    if (rule.test.test(idea)) {
      return { focus: rule.focus, modifiers: rule.modifiers };
    }
  }
  // Unknown subject: a safe, flattering default that still lifts quality.
  return { focus: "face", modifiers: [] };
}

/**
 * Compose the final prompt: the user's idea first, then only NEW phrases (deduped, and never
 * repeating something the user already said). Returns the prompt and the list of added terms.
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

  const subject = detectSubject(idea);
  const resolvedFocus: Exclude<CreativeFocus, "auto"> =
    requestedFocus === "auto" ? subject.focus : requestedFocus;

  const stylePreset = STYLE_PRESETS[style];
  const focusPreset = FOCUS_PRESETS[resolvedFocus];

  // Order matters: subject detail → framing → look → lighting → quality floor.
  const { prompt, applied } = compose(idea, [
    ...subject.modifiers,
    focusPreset.composition,
    stylePreset.descriptor,
    stylePreset.lighting,
    ...stylePreset.quality,
    ...focusPreset.modifiers,
  ]);

  return {
    prompt,
    params: {}, // reserved (aspect ratio / quality tier) — future
    meta: {
      version: CREATIVE_DIRECTOR_VERSION,
      idea,
      style,
      focus: resolvedFocus,
      appliedModifiers: applied,
      identityAware: Boolean(brief.identityId),
    },
  };
}
