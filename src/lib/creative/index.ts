/**
 * Creative Director — the intelligent layer between creative intent and the AI provider.
 *
 * The user thinks creatively; the Creative Director thinks technically. This is the ONLY layer
 * allowed to enrich a prompt. It is provider-agnostic and (for the MVP) deterministic, so it
 * can be replaced by an LLM later without touching callers. See docs/CREATIVE_DIRECTOR.md.
 */
export { directCreative } from "./director";
export {
  CREATIVE_DIRECTOR_VERSION,
  CREATIVE_STYLE_OPTIONS,
  DEFAULT_FOCUS,
  DEFAULT_STYLE,
  type CreativeBrief,
  type CreativeDirective,
  type CreativeFocus,
  type CreativeStyle,
  type SubjectCategory,
} from "./types";
