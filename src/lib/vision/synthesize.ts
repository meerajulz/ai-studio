/**
 * Identity Description Synthesis (Milestone 21, folded into M20 hardening).
 *
 * Aggregate an identity's PERSISTED per-image knowledge into ONE canonical appearance paragraph the
 * Creative Director can weave into every prompt — replacing the sparse static description ("long
 * hair, tattoos"). Pure + deterministic; provider-neutral; reads only frozen `im-2` knowledge.
 *
 * Rules:
 *   • **Stable visual identity only** — hair, piercings/accessories, facial hair, tattoos, body.
 *     NO inferred age (not a stable visual identity trait).
 *   • **Majority vote** across images resolves single-image disagreement (one "brown", most "pink").
 *   • **Region/LAYOUT-based tattoos with descriptive style/size, never specific artwork.** We say
 *     "colorful illustrative right sleeve, large floral chest piece" — never "a snake" — so the
 *     appearance is rich but can't pollute scene/intent detection with stray nouns.
 *   • **Deduplicated** — no "ear gauges" AND "ear gauge".
 */
import type { IdentityMetadata, TattooKnowledge, TattooRegion } from "./types";

/** Most-common non-empty value (majority vote); ties broken by first-seen order. */
function mode(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/**
 * Remove near-duplicate phrases: normalize (lowercase, singularize, collapse spaces) and drop a
 * phrase if another already-kept phrase is an equal/containing form. Keeps the more descriptive one.
 */
function dedupePhrases(phrases: string[]): string[] {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/s\b/g, "");
  const kept: string[] = [];
  for (const raw of phrases) {
    const p = raw.trim();
    if (!p) continue;
    const np = norm(p);
    const dupIdx = kept.findIndex((k) => {
      const nk = norm(k);
      return nk === np || nk.includes(np) || np.includes(nk);
    });
    if (dupIdx === -1) kept.push(p);
    else if (p.length > kept[dupIdx].length) kept[dupIdx] = p; // prefer the more descriptive form
  }
  return kept;
}

// ── Tattoo layout with descriptive (but not artwork-specific) modifiers ──────
const SIZE_WORDS = ["full", "large", "big", "small", "tiny", "half", "mini", "extensive"];
const STYLE_WORDS = [
  "blackout", "black-and-grey", "black and grey", "black and gray", "colorful", "colourful",
  "illustrative", "traditional", "neo-traditional", "ornamental", "geometric", "floral", "tribal",
  "realistic", "fine-line", "fine line", "watercolor", "watercolour", "minimalist", "script",
  "lettering", "abstract", "botanical", "line-art", "line art",
];

const REGION_NOUN: Record<TattooRegion, string> = {
  "left-shoulder": "left shoulder",
  "left-upper-arm": "left upper arm",
  "left-forearm": "left forearm",
  "left-hand": "left hand",
  "right-shoulder": "right shoulder",
  "right-upper-arm": "right upper arm",
  "right-forearm": "right forearm",
  "right-hand": "right hand",
  "chest-left": "left chest",
  "chest-right": "right chest",
  chest: "chest piece",
  abdomen: "abdomen",
  hip: "hip",
  "upper-back": "upper back",
  "lower-back": "lower back",
  back: "back piece",
  neck: "neck",
  "left-thigh": "left thigh",
  "right-thigh": "right thigh",
  "left-calf": "left calf",
  "right-calf": "right calf",
  feet: "feet",
  other: "tattoo",
};

/** Pull coarse size + style descriptors from a provider tattoo description (no imagery nouns). */
function descriptorsFor(tattoos: TattooKnowledge[]): string {
  const text = tattoos.map((t) => t.description ?? "").join(" ").toLowerCase();
  const size = SIZE_WORDS.find((w) => text.includes(w));
  const style = STYLE_WORDS.find((w) => text.includes(w));
  return [size, style].filter(Boolean).join(" ");
}

const phrase = (descriptors: string, noun: string): string =>
  descriptors ? `${descriptors} ${noun}` : noun;

const ARM = {
  left: ["left-shoulder", "left-upper-arm", "left-forearm", "left-hand"] as TattooRegion[],
  right: ["right-shoulder", "right-upper-arm", "right-forearm", "right-hand"] as TattooRegion[],
};

/** Build a rich, region-based tattoo description from all of the identity's tattoos. */
function tattooDescription(all: TattooKnowledge[]): string | null {
  const byRegion = new Map<TattooRegion, TattooKnowledge[]>();
  for (const t of all) {
    if (t.region === "other") continue;
    byRegion.set(t.region, [...(byRegion.get(t.region) ?? []), t]);
  }
  if (byRegion.size === 0) return null;

  const parts: string[] = [];
  const usedArmSide = new Set<"left" | "right">();

  // Arms → collapse to "{style} {side} sleeve" when 2+ sub-regions on a side.
  for (const side of ["left", "right"] as const) {
    const regions = ARM[side].filter((r) => byRegion.has(r));
    if (regions.length === 0) continue;
    const tattoos = regions.flatMap((r) => byRegion.get(r) ?? []);
    if (regions.length >= 2) {
      parts.push(phrase(descriptorsFor(tattoos), `${side} sleeve`));
      usedArmSide.add(side);
    } else {
      parts.push(phrase(descriptorsFor(tattoos), REGION_NOUN[regions[0]]));
      usedArmSide.add(side);
    }
  }

  // Chest (group), abdomen, hip, back (group), neck, thighs, calves, feet.
  const chest = (["chest", "chest-left", "chest-right"] as TattooRegion[]).filter((r) => byRegion.has(r));
  if (chest.length) parts.push(phrase(descriptorsFor(chest.flatMap((r) => byRegion.get(r)!)), "chest piece"));

  for (const r of ["abdomen", "hip"] as TattooRegion[]) {
    if (byRegion.has(r)) parts.push(phrase(descriptorsFor(byRegion.get(r)!), REGION_NOUN[r]));
  }

  const back = (["back", "upper-back", "lower-back"] as TattooRegion[]).filter((r) => byRegion.has(r));
  if (back.length) parts.push(phrase(descriptorsFor(back.flatMap((r) => byRegion.get(r)!)), "back piece"));

  if (byRegion.has("neck")) parts.push(phrase(descriptorsFor(byRegion.get("neck")!), "neck tattoo"));

  const thighs = (["left-thigh", "right-thigh"] as TattooRegion[]).filter((r) => byRegion.has(r));
  if (thighs.length === 2) parts.push(phrase(descriptorsFor(thighs.flatMap((r) => byRegion.get(r)!)), "thigh tattoos"));
  else if (thighs.length === 1) parts.push(phrase(descriptorsFor(byRegion.get(thighs[0])!), REGION_NOUN[thighs[0]]));

  for (const r of ["left-calf", "right-calf", "feet"] as TattooRegion[]) {
    if (byRegion.has(r)) parts.push(phrase(descriptorsFor(byRegion.get(r)!), REGION_NOUN[r]));
  }

  return dedupePhrases(parts).join(", ");
}

/**
 * Synthesize a provider-neutral appearance paragraph from an identity's analyzed images. Returns
 * `null` when there's nothing meaningful to say — callers fall back to the static description.
 */
export function synthesizeIdentityAppearance(metadatas: IdentityMetadata[]): string | null {
  if (metadatas.length === 0) return null;

  const clauses: string[] = [];

  // Hair (majority-voted across images where hair is visible).
  const visibleHair = metadatas.filter((m) => m.hair.visible);
  const color = mode(visibleHair.map((m) => m.hair.color));
  const length = mode(visibleHair.map((m) => (m.hair.length !== "unknown" ? m.hair.length : null)));
  const texture = mode(visibleHair.map((m) => (m.hair.texture !== "unknown" ? m.hair.texture : null)));
  const hairWords = [color, length, texture].filter((x): x is string => Boolean(x));
  if (hairWords.length) clauses.push(`${hairWords.join(" ")} hair`);

  // Accessories / piercings (union across images), deduplicated.
  const accessories = dedupePhrases(metadatas.flatMap((m) => m.accessories));
  clauses.push(...accessories.slice(0, 6));

  // Facial hair (majority).
  const facialHair = mode(metadatas.map((m) => m.facialHair));
  if (facialHair) clauses.push(facialHair);

  // Tattoo layout (region-based, descriptive — never imagery). NO inferred age.
  const tattoos = tattooDescription(metadatas.flatMap((m) => m.tattoos));
  if (tattoos) clauses.push(tattoos);

  const deduped = dedupePhrases(clauses);
  return deduped.length ? deduped.join(", ") : null;
}
