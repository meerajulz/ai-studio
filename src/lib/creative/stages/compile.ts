/**
 * Stage 4 — Prompt Compilation (v4.1: preserve user intent, then enrich).
 *
 * **The user's prompt is the source of truth.** The Creative Director ENRICHES it — it never
 * rebuilds or compresses it. The full idea (with the identity reference woven in by Stage 0) leads
 * the compiled prompt VERBATIM, so every clothing item, prop, action, interaction and location the
 * user wrote survives. The Director then APPENDS what the user didn't specify — genre, camera,
 * composition, perspective, depth of field, lighting, realism and the quality floor — de-duplicated
 * so nothing already stated is repeated.
 *
 * The scene graph still drives reasoning (anchor, intent, composition) and the Debug panel, but it
 * is NEVER allowed to replace the user's words. (Regression fix — Decision 039: the previous
 * "compile from the graph" approach silently dropped unrecognized words like "bikini"/"Chihuahua".)
 */
import type {
  CompiledStructure,
  CompositionPlan,
  DepthOfField,
  IdentityReasoning,
  IntentAnalysis,
  IntentType,
  Scene,
  SceneGraph,
  SceneNode,
} from "../types";

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

const CONFIDENCE_THRESHOLD = 0.6;

const label = (node: SceneNode | undefined): string =>
  node ? (node.descriptor ? `${node.descriptor} ${node.token}` : node.token) : "";

/**
 * Base first (the user's full prompt — never altered), then only NEW enrichment phrases: empties
 * dropped, no repeats, and nothing the user already said (case-insensitive substring).
 */
function enrich(base: string, phrases: (string | null)[]): {
  prompt: string;
  applied: string[];
} {
  const baseLower = base.toLowerCase();
  const seen = new Set<string>([baseLower]);
  const parts: string[] = [base];
  const applied: string[] = [];
  for (const phrase of phrases) {
    if (!phrase) continue;
    const key = phrase.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    if (baseLower.includes(key)) continue;
    seen.add(key);
    parts.push(phrase);
    applied.push(phrase);
  }
  return { prompt: parts.join(", "), applied };
}

export function compilePrompt(
  idea: string,
  scene: Scene,
  graph: SceneGraph,
  intent: IntentAnalysis,
  composition: CompositionPlan,
  identity: IdentityReasoning,
): { prompt: string; appliedModifiers: string[]; structure: CompiledStructure } {
  // The idea already includes the identity reference (Stage 0). It is the SOURCE OF TRUTH.
  const base = idea.trim();

  // Enrichment the Director adds ON TOP — the synthesized identity appearance FIRST (Milestone 21:
  // hair/piercings/tattoo layout the model needs to preserve identity), then scene context the user
  // may have omitted, then photographic direction. Deduped against the user's words.
  const enrichmentPhrases: (string | null)[] = [
    identity.appearance,
    scene.timeOfDay,
    scene.weather,
    scene.location,
    scene.environment !== "unknown" ? `${scene.environment} scene` : null,
    INTENT_PHRASE[intent.type],
    composition.framing,
    composition.cameraAngle !== "eye-level" ? composition.cameraAngle : null,
    composition.composition,
    composition.perspective,
    DOF_PHRASE[composition.depthOfField],
    composition.lighting,
    composition.realism,
    ...composition.qualityFloor,
  ];

  const { prompt, applied } = enrich(base, enrichmentPhrases);

  // Structured view for the Debug panel (does NOT drive the prompt text — the base does).
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const relationships = graph.relationships
    .filter((r) => r.confidence >= CONFIDENCE_THRESHOLD)
    .map((r) => `${label(nodeById.get(r.from))} ${r.type} ${label(nodeById.get(r.to))}`);
  const objects = graph.nodes
    .filter((n) => n.role === "object")
    .map((n) => label(n));

  const structure: CompiledStructure = {
    subject: base, // the preserved user prompt (source of truth)
    relationships,
    objects,
    setting: scene.setting,
    environment: scene.environment !== "unknown" ? `${scene.environment} scene` : null,
    location: scene.location,
    timeOfDay: scene.timeOfDay,
    weather: scene.weather,
    genre: INTENT_PHRASE[intent.type],
    composition: [
      composition.framing,
      composition.cameraAngle !== "eye-level" ? composition.cameraAngle : "",
      composition.composition,
      composition.perspective ?? "",
      DOF_PHRASE[composition.depthOfField] ?? "",
      composition.lighting,
    ].filter(Boolean),
    quality: [composition.realism, ...composition.qualityFloor],
  };

  return { prompt, appliedModifiers: applied, structure };
}
