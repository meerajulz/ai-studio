/**
 * Creative Director — the intelligent layer between creative intent and the AI provider.
 *
 * The user thinks creatively; the Creative Director thinks technically. It is a deterministic,
 * provider-agnostic reasoning pipeline (scene → intent → composition → prompt) and the ONLY layer
 * allowed to enrich a prompt. It can be replaced by an LLM later — one stage at a time — without
 * touching callers. See docs/CREATIVE_DIRECTOR.md.
 */
export { directCreative } from "./director";
export { resolveIdentity } from "./stages/identity";
export { analyzeScene } from "./stages/scene";
export { analyzeSpatial } from "./stages/spatial";
export { analyzeIntent } from "./stages/intent";
export { planComposition } from "./stages/composition";
export {
  CREATIVE_DIRECTOR_VERSION,
  CREATIVE_STYLE_OPTIONS,
  DEFAULT_FOCUS,
  DEFAULT_STYLE,
  type CompiledStructure,
  type CompositionPlan,
  type CreativeBrief,
  type CreativeDirective,
  type CreativeFocus,
  type CreativeStyle,
  type EntityKind,
  type Environment,
  type IdentityContext,
  type IdentityReasoning,
  type IntentAnalysis,
  type IntentType,
  type NodeRole,
  type Scene,
  type SceneEntity,
  type SceneGraph,
  type SceneNode,
  type SceneRelationship,
  type SpatialPosition,
  type SpatialRelationType,
} from "./types";
