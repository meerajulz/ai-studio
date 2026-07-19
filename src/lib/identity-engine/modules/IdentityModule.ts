/**
 * Identity Engine (Milestone 22) — the pluggable module contract.
 *
 * NEUTRAL name on purpose: an `IdentityModule` is not constrained to "conditioning" semantics — a
 * module may condition generation (Reference), own a trained model (LoRA), or inject a runtime
 * adapter (PuLID/InstantID). Every identity technique implements THIS interface; the engine composes
 * whichever modules are enabled + available. Adding a technique = a new module file + a registry
 * entry — nothing in Generation changes. Mirrors the capability-routed `ModelSpec` registry pattern.
 */
import type {
  ConditioningContext,
  ConditioningContribution,
  ConditioningRequest,
  EngineId,
  EngineKind,
  ModuleAvailability,
} from "../types";

export interface IdentityModule {
  id: EngineId;
  label: string;
  kind: EngineKind;
  /** Auto tiebreak among layerable modules (higher wins), like `ModelSpec.priority`. */
  priority: number;
  /** Registered + selectable. Only the Reference module is enabled in the foundation. */
  enabled: boolean;

  /** Can this module condition THIS identity right now? (e.g. is a trained model ready?) */
  availability(ctx: ConditioningContext): Promise<ModuleAvailability>;

  /** Produce this module's contribution to the plan. Only called when `availability` is true. */
  contribute(
    ctx: ConditioningContext,
    req: ConditioningRequest,
  ): Promise<ConditioningContribution>;
}
