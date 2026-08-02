/**
 * Identity Package check (Milestone 25.2, Phase A) — pure, offline, no DB/Fal.
 *
 * Validates the Reference Intelligence core: role scoring, best-per-role selection, MERGE-BY-IMAGE
 * (one photo filling several roles — coverage > uniqueness), transformation-driven needed roles, the
 * Face-Anchor invariant as an IDENTITY-CONFIDENCE policy (a face must clear FACE_ANCHOR_MIN_SCORE or
 * the request refuses), byte-parity with pickIdentityAnchor on a face-only request, the reference cap
 * (never drops the face), and the provider projection. Run:  npx tsx scripts/verify-reference-package.ts
 */
import type { IdentityMetadata } from "../src/lib/vision";
import type { SelectionCandidate } from "../src/lib/selection";
import {
  buildCharacterPackage,
  deriveNeededRoles,
  FACE_ANCHOR_MIN_SCORE,
  hasConfidentFace,
  hydrateAnchors,
  pickIdentityAnchor,
  renderPackageForModel,
  resolvePackage,
  serializeAnchors,
} from "../src/lib/selection";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`✗ ${msg}`);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

type FaceOver = { visible?: boolean; orientation?: string; confidence?: number; q?: number; res?: number };
function mkMeta(over: {
  face?: FaceOver;
  body?: { visibility?: string; pct?: number | null; pose?: string | null };
  hair?: { visible?: boolean; length?: string; color?: string | null; wet?: boolean; windBlown?: boolean };
  tattoos?: { region: string; confidence: number }[];
  quality?: { overall?: number; sharpness?: number; usable?: boolean; cropped?: boolean };
  clothing?: string[];
}): IdentityMetadata {
  const f = over.face ?? {};
  const b = over.body ?? {};
  const h = over.hair ?? {};
  const q = over.quality ?? {};
  return {
    face: {
      visible: f.visible ?? true,
      orientation: (f.orientation ?? "front") as IdentityMetadata["face"]["orientation"],
      confidence: f.confidence ?? 0.9,
      quality: f.visible === false ? null : { overall: f.q ?? 0.8, sharpness: 0.8, lighting: 0.8, eyeVisibility: 0.9, resolution: f.res ?? 0.9 },
    },
    body: { visibility: (b.visibility ?? "face"), visiblePercent: b.pct === undefined ? 20 : b.pct, pose: b.pose ?? null, framing: "headshot", visibleRegions: [] },
    hair: { visible: h.visible ?? true, color: h.color ?? "black", length: (h.length ?? "long"), texture: "straight", parting: "middle", updo: "none", bangs: false, wet: h.wet ?? false, windBlown: h.windBlown ?? false },
    tattoos: (over.tattoos ?? []) as IdentityMetadata["tattoos"],
    accessories: [],
    facialHair: null,
    clothing: over.clothing ?? [],
    quality: { overall: q.overall ?? 80, sharpness: q.sharpness ?? 0.8, usable: q.usable ?? true, cropped: q.cropped ?? false, exposure: 0.8, faceVisible: true, occlusion: false, resolution: null, aesthetic: null, issues: [] },
  } as unknown as IdentityMetadata;
}

const cand = (id: string, meta: IdentityMetadata): SelectionCandidate =>
  ({ mediaId: id, url: `https://x/${id}.jpg`, metadata: meta, score: { overall: meta.quality.overall } as SelectionCandidate["score"] });

function main() {
  console.log("Identity Package:");

  const A = cand("A", mkMeta({ face: { orientation: "front", confidence: 0.95, q: 0.9, res: 0.95 }, body: { visibility: "face", pct: 15 }, hair: { length: "unknown" }, quality: { overall: 88 } }));
  const B = cand("B", mkMeta({ face: { orientation: "three-quarter", confidence: 0.6, q: 0.5, res: 0.4 }, body: { visibility: "full", pct: 90 }, hair: { wet: true }, tattoos: [{ region: "left-forearm", confidence: 0.8 }, { region: "chest", confidence: 0.8 }, { region: "right-thigh", confidence: 0.8 }], quality: { overall: 75 } }));
  const C = cand("C", mkMeta({ face: { orientation: "front", confidence: 0.7, q: 0.6, res: 0.6 }, body: { visibility: "upper", pct: 50 }, hair: { length: "long", color: "black" }, quality: { overall: 70 } }));

  const pkg = buildCharacterPackage("id1", [A, B, C]);
  const anchorFor = (role: string) => pkg.anchors.find((a) => a.roles.includes(role as never));
  assert(anchorFor("face")?.mediaId === "A", "Face anchor = the strong frontal headshot (A)");
  assert(anchorFor("canonical")?.mediaId === "A", "Canonical anchor = highest-quality frontal (A)");
  assert(anchorFor("body")?.mediaId === "B", "Body anchor = the full-body shot (B)");
  assert(anchorFor("tattoo")?.mediaId === "B", "Tattoo anchor = the image with tattoo regions (B)");
  assert(anchorFor("hair")?.mediaId === "C", "Hair anchor = the clean hairstyle (C, not wet B / unknown A)");

  const aAnchor = pkg.anchors.find((a) => a.mediaId === "A")!;
  assert(aAnchor.roles.length >= 2 && aAnchor.roles.includes("face") && aAnchor.roles.includes("canonical"), "MERGE-BY-IMAGE: one image (A) fills face + canonical");
  assert(aAnchor.role === "face", "merged anchor's primary role is the most important (face)");

  // Transformation-driven needed roles: preserve body+tattoos, CHANGE hair → no hair anchor.
  const needed = deriveNeededRoles({
    preserve: ["body proportions", "all tattoos (exact placement and style)"],
    change: ["hairstyle", "the setting and background"],
    available: new Set(pkg.anchors.flatMap((a) => a.roles)),
  });
  assert(needed.includes("face") && needed.includes("body") && needed.includes("tattoo"), "needed roles include face+body+tattoo");
  assert(!needed.includes("hair"), "hair is being CHANGED → no Hair Anchor slot spent");

  const resolved = resolvePackage({ characterPackage: pkg, neededRoles: needed, maxReferences: 4, exposureCeiling: "clothed" });
  assert(resolved.faceAnchorSource === "face", "face anchor resolved from a real face");
  assert(resolved.anchors[0].roles.includes("face"), "INVARIANT: face anchor is position 0");
  assert(resolved.anchors.length === 2, "2 images cover 4 needed roles (coverage > uniqueness)");
  assert(["face", "canonical", "body", "tattoo"].every((r) => resolved.filledRoles.includes(r as never)), "all needed roles filled");
  assert(resolved.facetsCoveredByReference.includes("tattoos") && resolved.facetsCoveredByReference.includes("body"), "covered facets feed prompt de-dup");

  // Cap: never drop the face.
  const capped = resolvePackage({ characterPackage: pkg, neededRoles: needed, maxReferences: 1, exposureCeiling: "clothed" });
  assert(capped.anchors.length === 1 && capped.anchors[0].roles.includes("face"), "cap=1 keeps ONLY the face anchor");

  // Byte-parity: a face-only request yields exactly the same single ref as pickIdentityAnchor picks.
  const faceOnly = resolvePackage({ characterPackage: pkg, neededRoles: ["face"], maxReferences: 4, exposureCeiling: "clothed" });
  const faceUrls = renderPackageForModel(faceOnly, { kind: "image_urls", max: 4 });
  assert(faceUrls.length === 1 && faceUrls[0].url === pickIdentityAnchor([A, B, C])!.url, "BYTE-PARITY: face-only request = the pickIdentityAnchor image");

  // Identity-confidence policy: no eligible face at all → refuse.
  const back = cand("D", mkMeta({ face: { visible: false, orientation: "back" }, quality: { overall: 55 } }));
  assert(!hasConfidentFace([back]), "back-only library has NO confident face");
  const noFacePkg = buildCharacterPackage("id2", [back]);
  const refuse = resolvePackage({ characterPackage: noFacePkg, neededRoles: ["face"], maxReferences: 4, exposureCeiling: "clothed" });
  assert(refuse.faceAnchorSource === "none", "no confident face → faceAnchorSource none (caller must refuse)");

  // Identity-confidence policy: a VISIBLE but weak face (score < threshold) is NOT trusted → refuse.
  const weak = cand("E", mkMeta({ face: { orientation: "three-quarter", confidence: 0.4, q: 0.4, res: 0.3 }, quality: { overall: 55 } }));
  assert(!hasConfidentFace([weak]), `weak face below FACE_ANCHOR_MIN_SCORE (${FACE_ANCHOR_MIN_SCORE}) is not confident`);
  const weakPkg = buildCharacterPackage("id3", [weak]);
  const weakResolved = resolvePackage({ characterPackage: weakPkg, neededRoles: ["face"], maxReferences: 4, exposureCeiling: "clothed" });
  assert(weakResolved.faceAnchorSource === "none", "below-threshold face → refuse (no silent wrong-person)");

  // Phase D — persistence + exposure at resolve time.
  assert(pkg.anchors.every((a) => a.exposure === "clothed"), "buildCharacterPackage tags anchor.exposure");

  // resolvePackage drops an anchor whose exposure exceeds the prompt's ceiling.
  const nudeFace = cand("N", mkMeta({ face: { orientation: "front", confidence: 0.95, q: 0.9, res: 0.95 }, clothing: ["nude"], quality: { overall: 85 } }));
  const nudePkg = buildCharacterPackage("id4", [nudeFace]);
  assert(nudePkg.anchors[0].exposure === "nude", "nude photo → anchor.exposure nude");
  const clothedReq = resolvePackage({ characterPackage: nudePkg, neededRoles: ["face"], maxReferences: 4, exposureCeiling: "clothed" });
  assert(clothedReq.faceAnchorSource === "none", "persisted nude-only face is DROPPED for a clothed prompt → refuse (engine then rebuilds)");
  const explicitReq = resolvePackage({ characterPackage: nudePkg, neededRoles: ["face"], maxReferences: 4, exposureCeiling: "nude" });
  assert(explicitReq.faceAnchorSource === "face", "same anchor is allowed when the prompt permits nude");

  // Serialize → hydrate round-trip preserves roles / mediaId / exposure (URLs re-signed at read time).
  const stored = serializeAnchors(pkg.anchors);
  assert(stored.every((a) => !("url" in a)), "serializeAnchors strips the expiring URL");
  const urlMap = new Map(pkg.anchors.map((a) => [a.mediaId, `https://signed/${a.mediaId}.jpg`]));
  const hydrated = hydrateAnchors(stored, urlMap);
  assert(hydrated.length === pkg.anchors.length, "hydrateAnchors restores every anchor whose media exists");
  assert(hydrated.every((a, i) => a.mediaId === pkg.anchors[i].mediaId && a.exposure === pkg.anchors[i].exposure && a.roles.join() === pkg.anchors[i].roles.join()), "round-trip preserves roles/mediaId/exposure");
  assert(hydrateAnchors(stored, new Map()).length === 0, "hydrateAnchors drops anchors whose media was deleted");

  // Provider projection.
  const urls = renderPackageForModel(resolved, { kind: "image_urls", max: 2 });
  assert(urls.length === 2 && urls[0].role === "face", "image_urls projection: ordered, face first");
  const named = renderPackageForModel(resolved, { kind: "named", slots: { face: 1 } });
  assert(named.length === 1 && named[0].slot === "face", "named projection maps the face slot");

  console.log(`\nAll ${passed} checks passed.`);
}

main();
