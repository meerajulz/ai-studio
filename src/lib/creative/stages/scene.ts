/**
 * Stage 1 — Scene Analysis.
 *
 * Analyses the WHOLE idea (not the first keyword) into a structured `Scene`: primary/secondary
 * subjects, objects, living beings, environment, setting, location, time, weather, actions, and
 * fantasy elements. Pure + deterministic. Knows nothing about intent, composition, or providers.
 */
import {
  findAll,
  findEntities,
  findFirst,
  findLocation,
  findSetting,
  LEXICONS,
} from "../lexicon";
import type { EntityKind, Environment, Scene, SceneEntity } from "../types";

/** Kinds that read as a "subject" (vs. an incidental object) when they appear after the primary. */
const SUBJECT_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>([
  "person",
  "animal",
  "vehicle",
  "food",
  "architecture",
  "fantasy",
]);

const LIVING_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>(["person", "animal"]);

/** People negation (e.g. "no person on it") so a negated mention never becomes a subject. */
const PEOPLE_NEGATION =
  /\b(no|without|not|zero)\s+(?:\w+\s+){0,2}(person|people|man|men|woman|women|human|humans|one|figure|subject|character)\b|\bno one\b|\bnobody\b|\bunoccupied\b/i;

function inferEnvironment(
  entities: SceneEntity[],
  setting: { env: Environment } | null,
  location: string | null,
): Environment {
  if (setting) return setting.env;
  const kinds = new Set(entities.map((e) => e.kind));
  if (kinds.has("nature") || location) return "outdoor";
  if (kinds.has("furniture")) return "indoor";
  return "unknown";
}

export function analyzeScene(idea: string): Scene {
  const peopleNegated = PEOPLE_NEGATION.test(idea);

  let entities = findEntities(idea);
  // A negated people mention must not be treated as a subject.
  if (peopleNegated) entities = entities.filter((e) => e.kind !== "person");

  const settingHit = findSetting(idea);
  const location = findLocation(idea);
  const environment = inferEnvironment(entities, settingHit, location);

  const primarySubject = entities[0] ?? null;
  const rest = entities.slice(1);

  const secondarySubjects = rest.filter((e) => SUBJECT_KINDS.has(e.kind));
  const objects = rest.filter((e) => !SUBJECT_KINDS.has(e.kind));
  const livingBeings = entities.filter((e) => LIVING_KINDS.has(e.kind));

  const fantasyElements = entities
    .filter((e) => e.kind === "fantasy")
    .map((e) => e.token);

  // If the scene is clearly a furnished indoor space but no room was named, infer "living room"
  // — but only when there's more than a lone piece of furniture (so bare "sofa" stays a product).
  let setting = settingHit?.name ?? null;
  if (
    !setting &&
    environment === "indoor" &&
    entities.some((e) => e.kind === "furniture") &&
    entities.length > 1
  ) {
    setting = "living room";
  }

  return {
    primarySubject,
    secondarySubjects,
    objects,
    livingBeings,
    entities,
    environment,
    setting,
    location,
    timeOfDay: findFirst(idea, LEXICONS.TIMES),
    weather: findFirst(idea, LEXICONS.WEATHER),
    actions: findAll(idea, LEXICONS.ACTIONS),
    fantasyElements,
  };
}
