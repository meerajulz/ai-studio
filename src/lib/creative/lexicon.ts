/**
 * Creative Director — deterministic vocabulary (Milestone 13).
 *
 * The lexicon is the ONLY place raw keyword knowledge lives. Stages consume its typed finders;
 * they never hard-code word lists. This is the seam an LLM would later replace — everything here
 * is pure string matching, no I/O, no provider concepts.
 */
import type {
  EntityKind,
  Environment,
  SceneEntity,
  SpatialPosition,
  SpatialRelationType,
} from "./types";

/** Entity vocabulary. Order within a kind is irrelevant; overlaps resolve to the longest match. */
const ENTITY_LEXICON: ReadonlyArray<readonly [EntityKind, readonly string[]]> = [
  [
    "person",
    [
      "man", "men", "woman", "women", "person", "people", "boy", "girl",
      "kid", "child", "children", "model", "lady", "guy", "businessman",
      "businesswoman", "portrait", "selfie", "headshot", "couple", "family",
    ],
  ],
  [
    "animal",
    [
      "golden retriever", "german shepherd", "dog", "puppy", "cat", "kitten",
      "pet", "horse", "bird", "fox", "wolf", "lion", "tiger", "rabbit", "bear",
      "deer", "elephant", "panda", "owl", "eagle", "fish", "dolphin",
    ],
  ],
  [
    "furniture",
    [
      "sofa", "couch", "armchair", "chair", "table", "desk", "shelf",
      "bookshelf", "bed", "cabinet", "wardrobe", "stool", "bench", "dresser",
      "coffee table", "kitchen island", "island", "nightstand", "counter",
    ],
  ],
  ["plant", ["plants", "plant", "tree", "trees", "flower", "flowers", "fern", "cactus", "bouquet"]],
  [
    "vehicle",
    [
      "ferrari", "lamborghini", "porsche", "sports car", "car", "motorcycle",
      "motorbike", "bike", "bicycle", "truck", "plane", "airplane", "boat",
      "yacht", "bus", "van", "jeep", "train",
    ],
  ],
  [
    "food",
    [
      "pizza", "burger", "hamburger", "cake", "coffee", "cocktail", "drink",
      "sushi", "salad", "dessert", "sandwich", "pasta", "steak", "ice cream",
      "breakfast", "food", "dish", "meal",
    ],
  ],
  [
    "product",
    [
      "bottle", "perfume", "watch", "sneaker", "shoe", "handbag", "bag",
      "phone", "smartphone", "laptop", "camera", "headphones", "jewelry",
      "cosmetic", "lipstick", "gadget", "cup", "mug", "bowl", "plate", "book",
      "vase", "candle", "clock", "mirror", "television", "tv", "painting",
      "rug", "carpet", "pillow", "cushion", "umbrella", "lamp",
    ],
  ],
  [
    "architecture",
    [
      "eiffel tower", "big ben", "statue of liberty", "colosseum", "taj mahal",
      "skyscraper", "building", "house", "castle", "tower", "bridge",
      "cathedral", "temple", "palace", "cabin", "lighthouse", "windows",
      "window", "staircase", "archway", "fireplace",
    ],
  ],
  [
    "fantasy",
    [
      "dragon", "wizard", "sorcerer", "fairy", "elf", "orc", "unicorn",
      "phoenix", "griffin", "mermaid", "knight", "warrior", "spaceship",
      "robot", "cyborg", "alien", "mythical creature", "magic",
    ],
  ],
  [
    "nature",
    [
      "mountain", "mountains", "forest", "woods", "waterfall", "river", "lake",
      "ocean", "sea", "canyon", "valley", "meadow", "field", "cliff", "glacier",
    ],
  ],
];

/** Settings (scene types) with their implied environment. */
const SETTINGS: ReadonlyArray<{ name: string; env: Environment }> = [
  { name: "living room", env: "indoor" },
  { name: "dining room", env: "indoor" },
  { name: "bedroom", env: "indoor" },
  { name: "bathroom", env: "indoor" },
  { name: "kitchen", env: "indoor" },
  { name: "office", env: "indoor" },
  { name: "hallway", env: "indoor" },
  { name: "lobby", env: "indoor" },
  { name: "loft", env: "indoor" },
  { name: "apartment", env: "indoor" },
  { name: "studio", env: "indoor" },
  { name: "restaurant", env: "indoor" },
  { name: "cafe", env: "indoor" },
  { name: "office", env: "indoor" },
  { name: "beach", env: "outdoor" },
  { name: "mountains", env: "outdoor" },
  { name: "mountain", env: "outdoor" },
  { name: "forest", env: "outdoor" },
  { name: "desert", env: "outdoor" },
  { name: "city", env: "outdoor" },
  { name: "street", env: "outdoor" },
  { name: "park", env: "outdoor" },
  { name: "garden", env: "outdoor" },
  { name: "rooftop", env: "outdoor" },
];

/** Named places (proper-noun locations). Matched case-insensitively, displayed title-cased. */
const LOCATIONS: readonly string[] = [
  "paris", "tokyo", "london", "new york", "rome", "venice", "kyoto", "berlin",
  "barcelona", "dubai", "los angeles", "san francisco", "amsterdam", "iceland",
  "santorini", "moscow", "sydney", "cairo", "istanbul", "prague",
];

const TIMES: readonly string[] = [
  "sunrise", "dawn", "morning", "noon", "midday", "afternoon", "sunset",
  "dusk", "twilight", "evening", "night", "midnight", "golden hour", "blue hour",
];

const WEATHER: readonly string[] = [
  "rainy", "rain", "snowy", "snow", "foggy", "fog", "misty", "mist", "sunny",
  "cloudy", "overcast", "stormy", "storm",
];

const ACTIONS: readonly string[] = [
  "running", "walking", "sitting", "standing", "drinking", "eating", "flying",
  "jumping", "dancing", "swimming", "driving", "riding", "playing", "reading",
  "holding", "smiling", "laughing", "sleeping", "cooking", "fighting", "posing",
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** All whole-word matches of a term list, as [term, index] pairs (deduped later). */
function matchTerms(
  haystackLower: string,
  terms: readonly string[],
): { term: string; index: number }[] {
  const out: { term: string; index: number }[] = [];
  for (const term of terms) {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystackLower)) !== null) {
      out.push({ term, index: m.index });
    }
  }
  return out;
}

/**
 * Find every entity in the idea, ordered by position. Overlapping matches (e.g. "sports car"
 * vs "car") resolve to the LONGEST term, so a scene is analysed as a whole rather than stopping
 * at the first keyword.
 */
export function findEntities(idea: string): SceneEntity[] {
  const lower = idea.toLowerCase();
  const raw: { token: string; kind: EntityKind; start: number; end: number }[] = [];
  for (const [kind, terms] of ENTITY_LEXICON) {
    for (const { term, index } of matchTerms(lower, terms)) {
      raw.push({ token: term, kind, start: index, end: index + term.length });
    }
  }
  // Longest-first at each position, then drop anything overlapping an accepted span.
  raw.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const accepted: typeof raw = [];
  for (const m of raw) {
    if (accepted.some((a) => m.start < a.end && a.start < m.end)) continue;
    accepted.push(m);
  }
  accepted.sort((a, b) => a.start - b.start);
  return accepted.map((a) => ({ token: a.token, kind: a.kind, index: a.start }));
}

/** First matching setting (scene type) + its implied environment. */
export function findSetting(idea: string): { name: string; env: Environment } | null {
  const lower = idea.toLowerCase();
  let best: { name: string; env: Environment; index: number } | null = null;
  for (const s of SETTINGS) {
    const re = new RegExp(`\\b${escapeRegExp(s.name)}\\b`);
    const m = re.exec(lower);
    if (m && (best === null || m.index < best.index)) {
      best = { name: s.name, env: s.env, index: m.index };
    }
  }
  return best ? { name: best.name, env: best.env } : null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function findLocation(idea: string): string | null {
  const lower = idea.toLowerCase();
  for (const loc of LOCATIONS) {
    if (new RegExp(`\\b${escapeRegExp(loc)}\\b`).test(lower)) return titleCase(loc);
  }
  return null;
}

export function findFirst(idea: string, terms: readonly string[]): string | null {
  const matches = matchTerms(idea.toLowerCase(), terms);
  matches.sort((a, b) => a.index - b.index);
  return matches[0]?.term ?? null;
}

export function findAll(idea: string, terms: readonly string[]): string[] {
  const matches = matchTerms(idea.toLowerCase(), terms);
  matches.sort((a, b) => a.index - b.index);
  return [...new Set(matches.map((m) => m.term))];
}

export const LEXICONS = { TIMES, WEATHER, ACTIONS } as const;

// ── spatial vocabulary (Milestone 13.5) ─────────────────────────────────────

/** Adjectives that describe an entity (color / size / material / style). */
const DESCRIPTORS: readonly string[] = [
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "black",
  "white", "grey", "gray", "brown", "golden", "silver", "beige", "turquoise",
  "large", "big", "small", "tall", "short", "tiny", "huge", "giant", "long", "wide",
  "wooden", "metal", "metallic", "glass", "leather", "marble", "stone", "plastic", "concrete",
  "modern", "vintage", "rustic", "minimalist", "antique", "futuristic", "cozy",
  "luxurious", "elegant", "industrial", "indoor", "outdoor",
];

/**
 * Relation phrases → normalized type. Ordered longest/most-specific first so "sitting on" wins
 * over "on" and "in front of" wins over "on". Overlap resolution happens in `findRelations`.
 */
const RELATION_PHRASES: ReadonlyArray<{ phrase: string; type: SpatialRelationType }> = [
  { phrase: "parked in front of", type: "in front of" },
  { phrase: "standing in front of", type: "in front of" },
  { phrase: "standing beside", type: "next to" },
  { phrase: "standing next to", type: "next to" },
  { phrase: "sitting on", type: "on" },
  { phrase: "sitting in", type: "on" },
  { phrase: "lying on", type: "on" },
  { phrase: "resting on", type: "on" },
  { phrase: "placed on", type: "on" },
  { phrase: "on top of", type: "on" },
  { phrase: "in front of", type: "in front of" },
  { phrase: "looking at", type: "looking at" },
  { phrase: "flying over", type: "over" },
  { phrase: "flying above", type: "over" },
  { phrase: "hovering over", type: "over" },
  { phrase: "to the left of", type: "left of" },
  { phrase: "to the right of", type: "right of" },
  { phrase: "next to", type: "next to" },
  { phrase: "left of", type: "left of" },
  { phrase: "right of", type: "right of" },
  { phrase: "underneath", type: "under" },
  { phrase: "beside", type: "next to" },
  { phrase: "behind", type: "behind" },
  { phrase: "inside", type: "inside" },
  { phrase: "holding", type: "holding" },
  { phrase: "riding", type: "riding" },
  { phrase: "above", type: "above" },
  { phrase: "below", type: "below" },
  { phrase: "under", type: "under" },
  { phrase: "over", type: "over" },
  { phrase: "on", type: "on" },
];

/** Position phrases → normalized position. Longest-first. */
const POSITION_PHRASES: ReadonlyArray<{ phrase: string; position: SpatialPosition }> = [
  { phrase: "in the center of", position: "center" },
  { phrase: "in the centre of", position: "center" },
  { phrase: "at the center of", position: "center" },
  { phrase: "in the middle of", position: "center" },
  { phrase: "in the foreground", position: "foreground" },
  { phrase: "in the background", position: "background" },
  { phrase: "in the middle", position: "center" },
  { phrase: "in the center", position: "center" },
  { phrase: "in the centre", position: "center" },
  { phrase: "on the left", position: "left" },
  { phrase: "on the right", position: "right" },
  { phrase: "at the top", position: "top" },
  { phrase: "at the bottom", position: "bottom" },
];

type Span = { index: number; length: number };

/** Longest-first, non-overlapping matches of `{phrase, ...}` entries against the idea. */
function matchPhrases<T extends { phrase: string }>(
  idea: string,
  entries: readonly T[],
): (T & Span)[] {
  const lower = idea.toLowerCase();
  const hits: (T & Span)[] = [];
  for (const entry of entries) {
    const re = new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      hits.push({ ...entry, index: m.index, length: entry.phrase.length });
    }
  }
  hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const accepted: (T & Span)[] = [];
  for (const h of hits) {
    if (accepted.some((a) => h.index < a.index + a.length && a.index < h.index + h.length)) {
      continue;
    }
    accepted.push(h);
  }
  accepted.sort((a, b) => a.index - b.index);
  return accepted;
}

export function findRelations(
  idea: string,
): { index: number; length: number; type: SpatialRelationType }[] {
  return matchPhrases(idea, RELATION_PHRASES).map(({ index, length, type }) => ({
    index,
    length,
    type,
  }));
}

export function findPositions(
  idea: string,
): { index: number; length: number; position: SpatialPosition }[] {
  return matchPhrases(idea, POSITION_PHRASES).map(({ index, length, position }) => ({
    index,
    length,
    position,
  }));
}

/** The descriptor word (if any) immediately before an entity token at `entityIndex`. */
export function descriptorBefore(idea: string, entityIndex: number): string | null {
  const before = idea.slice(0, entityIndex).toLowerCase().trimEnd();
  const words = before.split(/\s+/);
  const last = words[words.length - 1] ?? "";
  return DESCRIPTORS.includes(last) ? last : null;
}
