/**
 * Creative Director — deterministic vocabulary (Milestone 13).
 *
 * The lexicon is the ONLY place raw keyword knowledge lives. Stages consume its typed finders;
 * they never hard-code word lists. This is the seam an LLM would later replace — everything here
 * is pure string matching, no I/O, no provider concepts.
 */
import type { EntityKind, Environment, SceneEntity } from "./types";

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
      "sofa", "couch", "armchair", "chair", "table", "desk", "lamp", "shelf",
      "bookshelf", "bed", "cabinet", "wardrobe", "stool", "bench", "dresser",
      "coffee table",
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
      "cosmetic", "lipstick", "gadget",
    ],
  ],
  [
    "architecture",
    [
      "skyscraper", "building", "house", "castle", "tower", "bridge",
      "cathedral", "temple", "palace", "cabin", "lighthouse", "windows",
      "window", "staircase", "archway",
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
