/**
 * Creative Director — the reasoning pipeline orchestrator (Milestone 13, v2).
 *
 * `directCreative(brief)` runs the four deterministic stages and returns a `CreativeDirective`
 * (the compiled prompt + reserved params + the full reasoning trace in `meta`). It is PURE and
 * DETERMINISTIC (same brief → same directive; no I/O, no provider SDKs, no AI) and the ONLY place
 * the app enriches a prompt. The staged design is what an LLM would later slot into — one stage
 * at a time — without changing callers. See docs/CREATIVE_DIRECTOR.md.
 *
 *   idea → analyzeScene → analyzeIntent → planComposition → compilePrompt → prompt
 */
import { compilePrompt } from "./stages/compile";
import { planComposition } from "./stages/composition";
import { analyzeIntent } from "./stages/intent";
import { analyzeScene } from "./stages/scene";
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

  // Stage 1–4: each consumes only the previous stage's structured output.
  const scene = analyzeScene(idea);
  const intent = analyzeIntent(scene);
  const composition = planComposition(scene, intent, brief);
  const { prompt, appliedModifiers } = compilePrompt(idea, scene, intent, composition);

  return {
    prompt,
    params: {}, // reserved (aspect ratio / quality tier) — future
    meta: {
      version: CREATIVE_DIRECTOR_VERSION,
      idea,
      style,
      scene,
      intent,
      composition,
      appliedModifiers,
      identityAware: Boolean(brief.identityId),
    },
  };
}
