/**
 * Stage 3 — Composition Planning.
 *
 * Given the scene + intent (+ the user's optional Style/Focus), decides how to shoot it:
 * framing, camera distance/angle, composition, perspective, depth of field, lighting, realism
 * level, and the professional quality floor. Pure + deterministic; still provider-agnostic.
 *
 * Crucially, an animal in a room does NOT become a portrait — framing comes from the INTENT, not
 * from whichever entity matched first.
 */
import type {
  CompositionPlan,
  CreativeBrief,
  CreativeStyle,
  DepthOfField,
  IntentAnalysis,
  RealismLevel,
  Scene,
  SceneGraph,
} from "../types";

type BasePlan = Omit<CompositionPlan, "realism" | "qualityFloor">;

const INTENT_PLANS: Record<IntentAnalysis["type"], BasePlan> = {
  portrait: {
    framing: "medium portrait",
    cameraDistance: "medium",
    cameraAngle: "eye-level",
    composition: "subject centered, background gently blurred",
    perspective: null,
    depthOfField: "shallow",
    lighting: "soft flattering light",
  },
  lifestyle: {
    framing: "candid medium shot",
    cameraDistance: "medium",
    cameraAngle: "eye-level",
    composition: "environmental context, natural moment",
    perspective: null,
    depthOfField: "medium",
    lighting: "natural available light",
  },
  "interior-design": {
    framing: "wide-angle interior shot",
    cameraDistance: "wide",
    cameraAngle: "eye-level",
    composition: "architectural composition, full room in frame",
    perspective: "one-point perspective",
    depthOfField: "deep",
    lighting: "soft natural window light",
  },
  architecture: {
    framing: "wide architectural shot",
    cameraDistance: "wide",
    cameraAngle: "low angle",
    composition: "symmetrical, strong leading lines",
    perspective: "two-point perspective",
    depthOfField: "deep",
    lighting: "natural daylight",
  },
  automotive: {
    framing: "three-quarter hero shot",
    cameraDistance: "wide",
    cameraAngle: "low angle",
    composition: "the vehicle dominates the frame",
    perspective: null,
    depthOfField: "deep",
    lighting: "dramatic reflective lighting",
  },
  "food-photography": {
    framing: "close-up food shot",
    cameraDistance: "close-up",
    cameraAngle: "high angle",
    composition: "appetizing arrangement",
    perspective: null,
    depthOfField: "shallow",
    lighting: "soft diffused light",
  },
  "product-photography": {
    framing: "centered product shot",
    cameraDistance: "medium",
    cameraAngle: "eye-level",
    composition: "clean, minimal background",
    perspective: null,
    depthOfField: "medium",
    lighting: "studio softbox lighting",
  },
  landscape: {
    framing: "wide panoramic view",
    cameraDistance: "panoramic",
    cameraAngle: "eye-level",
    composition: "rule of thirds, deep horizon",
    perspective: null,
    depthOfField: "deep",
    lighting: "natural golden-hour light",
  },
  wildlife: {
    framing: "dynamic action shot",
    cameraDistance: "medium",
    cameraAngle: "eye-level",
    composition: "subject in motion, environment visible",
    perspective: null,
    depthOfField: "medium",
    lighting: "natural daylight",
  },
  "concept-art": {
    framing: "epic wide shot",
    cameraDistance: "wide",
    cameraAngle: "low angle",
    composition: "dramatic cinematic scale",
    perspective: null,
    depthOfField: "deep",
    lighting: "dramatic atmospheric lighting",
  },
  fashion: {
    framing: "full-body fashion shot",
    cameraDistance: "medium",
    cameraAngle: "eye-level",
    composition: "editorial styling",
    perspective: null,
    depthOfField: "shallow",
    lighting: "studio fashion lighting",
  },
  "still-life": {
    framing: "still-life composition",
    cameraDistance: "close-up",
    cameraAngle: "eye-level",
    composition: "balanced arrangement",
    perspective: null,
    depthOfField: "shallow",
    lighting: "soft directional light",
  },
};

const STYLE_REALISM: Record<CreativeStyle, RealismLevel> = {
  realistic: "photorealistic",
  cinematic: "cinematic photorealistic",
  illustration: "stylized illustration",
  fantasy: "concept art",
};

const STYLE_QUALITY: Record<CreativeStyle, string[]> = {
  realistic: ["highly detailed", "sharp focus", "professional photography", "high resolution"],
  cinematic: ["cinematic color grading", "highly detailed", "film grain", "8k"],
  illustration: ["clean linework", "vibrant colors", "highly detailed", "trending on artstation"],
  fantasy: ["intricate detail", "dramatic atmosphere", "highly detailed", "artstation"],
};

export function planComposition(
  scene: Scene,
  graph: SceneGraph,
  intent: IntentAnalysis,
  brief: CreativeBrief,
): CompositionPlan {
  const base: BasePlan = { ...INTENT_PLANS[intent.type] };

  // Spatial-aware framing: a scene with actual relationships (or several objects) must be shot
  // wide enough that the whole arrangement is visible — but NOT for intents whose whole point is
  // to isolate one subject (product / food / portrait).
  const composedScene = graph.relationships.length > 0 || graph.nodes.length >= 3;
  const isolatingIntent =
    intent.type === "product-photography" ||
    intent.type === "food-photography" ||
    intent.type === "portrait";
  if (composedScene && !isolatingIntent) {
    base.framing = "wide shot showing the full scene";
    base.cameraDistance = "wide";
    base.composition = "all elements arranged in frame, spatial relationships preserved";
    base.depthOfField = "deep";
  }
  // Outdoor scenes should not use studio lighting.
  if (scene.environment === "outdoor" && /studio/.test(base.lighting)) {
    base.lighting = "natural daylight";
  }

  // Optional explicit Focus overrides the intent's default emphasis.
  switch (brief.focus) {
    case "face":
      base.cameraDistance = "close-up";
      base.framing = "close-up portrait";
      base.depthOfField = "shallow";
      break;
    case "environment":
      base.cameraDistance = "wide";
      base.framing = "wide environmental shot";
      base.depthOfField = "deep";
      break;
    case "product":
      base.framing = "centered product shot";
      base.composition = "clean, minimal background";
      break;
    case "action":
      base.framing = "dynamic action shot";
      base.depthOfField = "medium";
      break;
    default:
      break;
  }

  const style: CreativeStyle = brief.style ?? "realistic";
  // A concept-art genre shouldn't also claim "photorealistic / professional photography" — the
  // intent wins the realism call when the chosen style is photographic.
  const effectiveStyle: CreativeStyle =
    intent.type === "concept-art" && (style === "realistic" || style === "cinematic")
      ? "fantasy"
      : style;

  return {
    ...base,
    realism: STYLE_REALISM[effectiveStyle],
    qualityFloor: STYLE_QUALITY[effectiveStyle],
  };
}
