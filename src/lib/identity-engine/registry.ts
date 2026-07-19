/**
 * Identity Engine (Milestone 22) — the module registry. Mirrors `src/lib/ai/model-registry.ts`:
 * adding an identity technique is a config entry here, not a change to Generation. Order is
 * documentation only; the engine composes by `kind` + `priority` + `enabled` + availability.
 *
 * Today only the Reference module is enabled. LoRA / PuLID / InstantID are registered but disabled,
 * so the pluggable architecture is visible and testable without any technique being implemented.
 */
import type { IdentityModule } from "./modules/IdentityModule";
import { referenceEngine } from "./engines/reference/reference-engine";
import { loraEngine } from "./engines/lora/lora-engine";
import { pulidEngine } from "./engines/pulid/pulid-engine";
import { instantIdEngine } from "./engines/instantid/instantid-engine";

export const IDENTITY_MODULES: IdentityModule[] = [
  referenceEngine, // enabled — the always-on baseline
  loraEngine, // disabled — architecture only
  pulidEngine, // disabled — placeholder
  instantIdEngine, // disabled — placeholder
];

export const listModules = (): IdentityModule[] => IDENTITY_MODULES;
export const getModule = (id: string): IdentityModule | undefined =>
  IDENTITY_MODULES.find((m) => m.id === id);
