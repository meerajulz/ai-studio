/**
 * Creative Director — the reasoning pipeline orchestrator (Milestone 13, v2).
 *
 * `directCreative(brief)` runs the four deterministic stages and returns a `CreativeDirective`
 * (the compiled prompt + reserved params + the full reasoning trace in `meta`). It is PURE and
 * DETERMINISTIC (same brief → same directive; no I/O, no provider SDKs, no AI) and the ONLY place
 * the app enriches a prompt. The staged design is what an LLM would later slot into — one stage
 * at a time — without changing callers. See docs/CREATIVE_DIRECTOR.md.
 *
 *   idea → resolveIdentity → analyzeScene → analyzeSpatial → analyzeIntent → planComposition → compilePrompt → prompt
 */
import { compilePrompt } from "./stages/compile";
import { planComposition } from "./stages/composition";
import { resolveIdentity } from "./stages/identity";
import { analyzeIntent } from "./stages/intent";
import { analyzeScene } from "./stages/scene";
import { analyzeSpatial } from "./stages/spatial";
import {
  CREATIVE_DIRECTOR_VERSION,
  DEFAULT_STYLE,
  type CreativeBrief,
  type CreativeDirective,
  type CreativeStyle,
} from "./types";

export function directCreative(brief: CreativeBrief): CreativeDirective {
  const idea = brief.idea.trim();
  const style: CreativeStyle = brief.style ?? DEFAULT_STYLE;

  // Stage 0: an optional identity weaves a subject reference into the idea the rest of the
  // pipeline reasons over. The user's original `idea` is kept for `meta`; downstream stages use
  // `effectiveIdea` so the identity is treated as the subject.
  const { effectiveIdea, reasoning: identity } = resolveIdentity(idea, brief.identity);

  // Each stage consumes only the previous stages' structured output.
  const scene = analyzeScene(effectiveIdea);
  const graph = analyzeSpatial(effectiveIdea, scene);
  const intent = analyzeIntent(scene);
  const composition = planComposition(scene, graph, intent, brief);
  const { prompt, appliedModifiers } = compilePrompt(
    effectiveIdea,
    scene,
    graph,
    intent,
    composition,
  );

  return {
    prompt,
    params: {}, // reserved (aspect ratio / quality tier) — future
    meta: {
      version: CREATIVE_DIRECTOR_VERSION,
      idea,
      style,
      identity,
      scene,
      graph,
      intent,
      composition,
      appliedModifiers,
      identityAware: identity.present,
    },
  };
}
