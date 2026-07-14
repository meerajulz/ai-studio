/**
 * Stage 4 — Structured Prompt Compilation (v4).
 *
 * Compiles from STRUCTURED DATA (the scene graph), not by concatenating the raw sentence. It
 * builds a `CompiledStructure` — anchor subject, explicit high-confidence relationships, neutral
 * low-confidence objects, scene context, genre, composition, quality — then renders it to a single
 * plain-text prompt (the provider interface is unchanged; providers still get plain text).
 *
 * Spatial fidelity: explicit relationships (high confidence) are stated with their exact relation;
 * low-confidence anchor associations use NEUTRAL wording ("with …") and never a fabricated
 * direction. The identity reference (Stage 0) leads the subject so the name/description survive.
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

/** A low-confidence relationship is rendered neutrally (never a fabricated direction). */
const CONFIDENCE_THRESHOLD = 0.6;

const label = (node: SceneNode | undefined): string =>
  node ? (node.descriptor ? `${node.descriptor} ${node.token}` : node.token) : "";

const INDOOR_ROOMS = /living room|dining room|bedroom|bathroom|kitchen|office|hallway|lobby|loft|apartment/;

/** Render the final plain-text prompt from the structured representation. */
function render(structure: CompiledStructure): string {
  // Skip the setting if it's already named in the subject / relationships / objects.
  const alreadySaid = [structure.subject, ...structure.relationships, ...structure.objects]
    .join(" ")
    .toLowerCase();
  const settingPhrase =
    structure.setting && !alreadySaid.includes(structure.setting)
      ? INDOOR_ROOMS.test(structure.setting)
        ? `in a ${structure.setting}`
        : structure.setting
      : null;

  const parts: (string | null)[] = [
    structure.subject,
    ...structure.relationships,
    structure.objects.length ? `with ${joinList(structure.objects)}` : null,
    settingPhrase,
    structure.environment,
    structure.location,
    structure.timeOfDay,
    structure.weather,
    structure.genre,
    ...structure.composition,
    ...structure.quality,
  ];
  const seen = new Set<string>();
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .filter((p) => {
      const key = p.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function compilePrompt(
  idea: string,
  scene: Scene,
  graph: SceneGraph,
  intent: IntentAnalysis,
  composition: CompositionPlan,
  identity: IdentityReasoning,
): { prompt: string; appliedModifiers: string[]; structure: CompiledStructure } {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const anchor = graph.anchor ? nodeById.get(graph.anchor) : undefined;

  const anchorLabel = label(anchor);
  const subjectIsAnchor = !(identity.present && identity.referencePhrase);
  const action = scene.actions[0] ?? null;
  const consumed = new Set<string>(anchor ? [anchor.id] : []);

  // ── Subject. When the subject IS the anchor, fold its action + first explicit relationship into
  //    one natural clause ("a dog sitting on the sofa") instead of repeating the anchor.
  let subject: string;
  const anchorRel =
    subjectIsAnchor && anchor
      ? graph.relationships.find(
          (r) => r.from === anchor.id && r.confidence >= CONFIDENCE_THRESHOLD,
        )
      : undefined;
  if (subjectIsAnchor) {
    const bits = [anchorLabel || idea];
    if (action) bits.push(action);
    if (anchorRel) {
      const to = nodeById.get(anchorRel.to);
      if (to) {
        bits.push(`${anchorRel.type} the ${to.token}`);
        consumed.add(to.id);
      }
    }
    subject = bits.join(" ");
  } else {
    subject = action
      ? `${identity.referencePhrase} ${action}`
      : (identity.referencePhrase as string);
  }

  // ── Relationships: remaining explicit (high-confidence) edges; the rest become neutral objects.
  const relationships: string[] = [];
  const neutralObjects: string[] = [];
  for (const rel of graph.relationships) {
    if (rel === anchorRel) continue;
    const from = nodeById.get(rel.from);
    const to = nodeById.get(rel.to);
    if (!from || !to) continue;

    if (rel.confidence >= CONFIDENCE_THRESHOLD) {
      const fromLabel = from.id === anchor?.id ? "the " + from.token : label(from);
      relationships.push(`${fromLabel} ${rel.type} the ${to.token}`);
      consumed.add(from.id);
      consumed.add(to.id);
    }
  }

  // ── Surrounding objects with no explicit relation → neutral mention (positioned around anchor).
  for (const node of graph.nodes) {
    if (consumed.has(node.id)) continue;
    if (node.role === "primary") continue; // already the subject
    neutralObjects.push(label(node));
    consumed.add(node.id);
  }

  const structure: CompiledStructure = {
    subject,
    relationships,
    objects: neutralObjects,
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

  const prompt = render(structure);

  // Everything the Director added beyond the subject (for the debug "rules applied" list).
  const appliedModifiers = [
    ...relationships,
    ...neutralObjects,
    structure.genre,
    ...structure.composition,
    ...structure.quality,
  ];

  return { prompt, appliedModifiers, structure };
}
