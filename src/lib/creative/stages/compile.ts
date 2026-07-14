/**
 * Stage 4 — Prompt Compilation.
 *
 * Assembles the final professional prompt from the STRUCTURED reasoning (scene → intent →
 * composition → quality), not from keyword matching. The user's own words come first; the
 * Director then layers scene context, the intent genre, the composition plan, and the quality
 * floor — de-duplicated, and never repeating something the user already wrote.
 */
import type {
  CompositionPlan,
  DepthOfField,
  IntentAnalysis,
  IntentType,
  Scene,
} from "../types";

/** Compiler-facing genre phrase per intent (kept short; the label is for humans/debug). */
const INTENT_PHRASE: Record<IntentType, string> = {
  portrait: "portrait photography",
  lifestyle: "lifestyle photography",
  "interior-design": "interior design photography",
  architecture: "architectural photography",
  automotive: "automotive photography",
  "food-photography": "food photography",
  "product-photography": "product photography",
  landscape: "landscape photography",
  wildlife: "wildlife photography",
  "concept-art": "epic concept art, digital painting",
  fashion: "fashion editorial photography",
  "still-life": "still life photography",
};

const DOF_PHRASE: Record<DepthOfField, string | null> = {
  shallow: "shallow depth of field",
  deep: "deep depth of field",
  medium: null,
};

/** Compose: idea first, then only new phrases (empties dropped, no repeats, nothing already said). */
function compose(idea: string, phrases: (string | null)[]): {
  prompt: string;
  applied: string[];
} {
  const ideaLower = idea.toLowerCase();
  const seen = new Set<string>([ideaLower]);
  const parts: string[] = [idea];
  const applied: string[] = [];

  for (const phrase of phrases) {
    if (!phrase) continue;
    const key = phrase.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    if (ideaLower.includes(key)) continue;
    seen.add(key);
    parts.push(phrase);
    applied.push(phrase);
  }
  return { prompt: parts.join(", "), applied };
}

export function compilePrompt(
  idea: string,
  scene: Scene,
  intent: IntentAnalysis,
  composition: CompositionPlan,
): { prompt: string; appliedModifiers: string[] } {
  const scenePhrases: (string | null)[] = [
    scene.setting,
    scene.environment !== "unknown" ? `${scene.environment} scene` : null,
    scene.location,
    scene.timeOfDay,
    scene.weather,
    ...scene.actions,
  ];

  const compositionPhrases: (string | null)[] = [
    composition.framing,
    composition.cameraAngle !== "eye-level" ? composition.cameraAngle : null,
    composition.composition,
    composition.perspective,
    DOF_PHRASE[composition.depthOfField],
    composition.lighting,
  ];

  const qualityPhrases: (string | null)[] = [
    composition.realism,
    ...composition.qualityFloor,
  ];

  // Priority order: Scene → Intent → Composition → Quality.
  const { prompt, applied } = compose(idea, [
    ...scenePhrases,
    INTENT_PHRASE[intent.type],
    ...compositionPhrases,
    ...qualityPhrases,
  ]);

  return { prompt, appliedModifiers: applied };
}
