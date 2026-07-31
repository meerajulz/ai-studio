/**
 * Transformation Planner check (Milestone 25.1) — pure, offline, no DB/Fal.
 *
 * Asserts the preserve-vs-change plan is GROUNDED (tattoos/piercings listed only when the character has
 * them; change facets only when the idea introduces them) and that the no-identity / no-knowledge paths
 * stay out of the way (prompt unchanged). Run:  npx tsx scripts/verify-transform.ts
 */
import type { CreativeDirective } from "../src/lib/creative";
import type { IdentityMetadata } from "../src/lib/vision";
import { composeTransformationPrompt, planTransformation } from "../src/lib/transform";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`✗ ${msg}`);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

// Minimal fixtures — the planner only reads a few fields, so we cast partial shapes.
const meta = (over: Partial<IdentityMetadata>): IdentityMetadata =>
  ({ tattoos: [], accessories: [], facialHair: null, ...over }) as unknown as IdentityMetadata;

const directive = (idea: string, scene: Partial<CreativeDirective["meta"]["scene"]>): CreativeDirective =>
  ({
    prompt: `${idea}, cinematic, high quality`,
    params: {},
    meta: {
      idea,
      scene: {
        primarySubject: null, secondarySubjects: [], objects: [], livingBeings: [], entities: [],
        environment: "unknown", setting: null, location: null, timeOfDay: null, weather: null,
        actions: [], fantasyElements: [], ...scene,
      },
    },
  }) as unknown as CreativeDirective;

function main() {
  console.log("Transformation Planner:");

  // 1) Tattooed + pierced character, beach/bikini idea → grounded preserve + change.
  const tattooed = [
    meta({ tattoos: [{ region: "left-forearm", description: "colorful sleeve" }] as IdentityMetadata["tattoos"], accessories: ["septum piercing", "ear gauges"] }),
  ];
  const beach = directive("on the beach at sunset wearing a bikini, smiling", {
    setting: "beach", actions: ["standing"], timeOfDay: "sunset",
  });
  const p1 = planTransformation({ hasIdentity: true, hasReferences: true, metadatas: tattooed, directive: beach });
  assert(p1.applies, "applies on the identity + references + knowledge path");
  assert(p1.preserve.includes("facial identity"), "preserve always includes facial identity");
  assert(p1.preserve.some((x) => x.includes("tattoo")), "preserve includes tattoos (character has them)");
  assert(p1.preserve.includes("piercings"), "preserve includes piercings (septum detected)");
  assert(p1.change.includes("outfit"), "change includes outfit (bikini in idea)");
  assert(p1.change.includes("expression"), "change includes expression (smiling in idea)");
  assert(p1.change.some((x) => x.includes("setting")), "change includes the setting/background");
  assert(p1.change.includes("lighting"), "change includes lighting (sunset)");
  assert(/^Preserve this person's identity exactly\. Keep unchanged:/.test(p1.instruction), "instruction leads with the preserve clause");
  assert(p1.negativePrompt!.includes("altered tattoos"), "negative prompt reinforces tattoos");
  assert(composeTransformationPrompt(beach.prompt, p1).startsWith(p1.instruction), "compose prepends the instruction");

  // 2) Character with NO tattoos/piercings → preserve + negative omit them.
  const plain = [meta({})];
  const office = directive("in a modern office, professional headshot", { setting: "office" });
  const p2 = planTransformation({ hasIdentity: true, hasReferences: true, metadatas: plain, directive: office });
  assert(p2.applies, "applies for a plain character too");
  assert(!p2.preserve.some((x) => x.includes("tattoo")), "no tattoos → preserve omits tattoos");
  assert(!p2.negativePrompt!.includes("tattoo"), "no tattoos → negative prompt omits tattoos");
  assert(!p2.change.includes("outfit"), "no outfit words → change omits outfit");

  // 3) No identity → out of the way (prompt unchanged).
  const p3 = planTransformation({ hasIdentity: false, hasReferences: true, metadatas: tattooed, directive: beach });
  assert(!p3.applies, "no identity → does not apply");
  assert(composeTransformationPrompt(beach.prompt, p3) === beach.prompt, "no identity → prompt is unchanged");

  // 4) Identity but NO analyzed knowledge → out of the way (can't ground preserve).
  const p4 = planTransformation({ hasIdentity: true, hasReferences: true, metadatas: [], directive: beach });
  assert(!p4.applies, "no analyzed knowledge → does not apply");

  // 5) References absent (pure t2i) → out of the way.
  const p5 = planTransformation({ hasIdentity: true, hasReferences: false, metadatas: tattooed, directive: beach });
  assert(!p5.applies, "no references (text-to-image) → does not apply");

  console.log(`\nAll ${passed} checks passed.`);
}

main();
