/**
 * Deterministic verification of capability-based Model Routing (Milestone 21).
 *
 * Fully OFFLINE — no provider calls. Proves the pipeline requests CAPABILITIES and the router picks
 * the best compatible model from the registry (Auto), honours a Manual pick, and never auto-selects a
 * disabled model. Adding a model = a config entry; this guards the routing logic around it.
 *
 * Run: `npx tsx scripts/verify-model-routing.ts`
 */
import { chooseModel, MODEL_REGISTRY, type ProviderCapability } from "../src/lib/ai";

const EDIT_MULTI: ProviderCapability[] = [
  "imageEditing",
  "referenceImages",
  "identityPreservation",
  "multipleReferenceImages",
];

const auto = chooseModel({ provider: "fal", needs: EDIT_MULTI, mode: "auto" });
const manual = chooseModel({
  provider: "fal",
  needs: EDIT_MULTI,
  mode: "manual",
  manualModelId: "fal-ai/flux-pro/kontext/multi",
});
const manualDisabledFallback = chooseModel({
  provider: "fal",
  needs: EDIT_MULTI,
  mode: "manual",
  manualModelId: "does-not-exist",
});

console.log(`\n▶ Auto (edit+identity+multi): ${auto.decision.chosen} — ${auto.decision.reason}`);
console.log(`▶ Manual pick: ${manual.decision.chosen} (mode ${manual.decision.mode})`);
console.log(`▶ Manual invalid → ${manualDisabledFallback.decision.chosen} (mode ${manualDisabledFallback.decision.mode})`);

// The highest-priority ENABLED model satisfying the needs, computed independently.
const expectedAuto = [...MODEL_REGISTRY]
  .filter((m) => m.provider === "fal" && m.enabled && EDIT_MULTI.every((c) => m.capabilities.includes(c)))
  .sort((a, b) => b.priority - a.priority)[0];

const checks: [string, boolean][] = [
  ["auto picks the highest-priority capable enabled model", auto.model.id === expectedAuto.id],
  ["auto model actually satisfies all needs", EDIT_MULTI.every((c) => auto.model.capabilities.includes(c))],
  ["auto model is a multi-reference editor", auto.model.capabilities.includes("multipleReferenceImages")],
  ["auto default stays the PROVEN Kontext Max Multi", auto.model.id === "fal-ai/flux-pro/kontext/max/multi"],
  ["manual honours the requested model id", manual.model.id === "fal-ai/flux-pro/kontext/multi"],
  ["manual mode is reported", manual.decision.mode === "manual"],
  ["invalid manual id falls back to auto", manualDisabledFallback.decision.mode === "auto"],
  ["a disabled model is never auto-chosen", MODEL_REGISTRY.filter((m) => !m.enabled).every((m) => m.id !== auto.model.id)],
  ["adding a model is config-only (registry non-empty, all have payloadKind)", MODEL_REGISTRY.length > 0 && MODEL_REGISTRY.every((m) => Boolean(m.payloadKind))],
];

console.log("\nChecks:");
let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? "✓" : "✗"} ${name}`);
  ok = ok && pass;
}
console.log(ok ? "\nAll checks passed." : "\nSOME CHECKS FAILED.");
process.exit(ok ? 0 : 1);
