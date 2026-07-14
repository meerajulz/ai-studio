/**
 * Stage 2 — Intent Analysis.
 *
 * Infers what the user is actually trying to CREATE from the analysed scene — not merely the
 * subject. "woman drinking coffee in Paris" → lifestyle (not "person"); "red Ferrari in Tokyo"
 * → automotive; "living room with sofa" → interior design. Pure + deterministic; consumes only
 * the `Scene`.
 */
import type { EntityKind, IntentAnalysis, IntentType, Scene } from "../types";

const LABELS: Record<IntentType, string> = {
  portrait: "Portrait photography",
  lifestyle: "Lifestyle photography",
  "interior-design": "Interior design photography",
  architecture: "Architectural photography",
  automotive: "Automotive photography",
  "food-photography": "Food photography",
  "product-photography": "Product photography",
  landscape: "Landscape photography",
  wildlife: "Wildlife / action photography",
  "concept-art": "Concept art",
  fashion: "Fashion editorial",
  "still-life": "Still life",
};

function result(type: IntentType, rationale: string): IntentAnalysis {
  return { type, label: LABELS[type], rationale };
}

const INDOOR_SETTINGS = /living room|dining room|bedroom|bathroom|kitchen|office|hallway|lobby|loft|apartment|restaurant|cafe|studio/;

export function analyzeIntent(scene: Scene): IntentAnalysis {
  const primaryKind: EntityKind | null = scene.primarySubject?.kind ?? null;
  const hasLivingBeings = scene.livingBeings.length > 0;
  const hasAction = scene.actions.length > 0;
  const isRoom = Boolean(scene.setting && INDOOR_SETTINGS.test(scene.setting));

  // Fantasy anywhere in the scene dominates — it defines the creative genre.
  if (scene.fantasyElements.length > 0 || primaryKind === "fantasy") {
    return result("concept-art", "fantasy elements present in the scene");
  }

  if (primaryKind === "vehicle") {
    return result("automotive", "the primary subject is a vehicle");
  }
  if (primaryKind === "food") {
    return result("food-photography", "the primary subject is food");
  }
  if (primaryKind === "product") {
    return result("product-photography", "the primary subject is a product");
  }

  // Indoor room, or furniture as the subject → an interior (unless a lone furniture product shot).
  if (isRoom || primaryKind === "furniture") {
    const loneFurniture =
      primaryKind === "furniture" && !isRoom && scene.entities.length <= 1;
    if (loneFurniture) {
      return result("product-photography", "a single furniture item with no scene");
    }
    if (hasLivingBeings) {
      return result("lifestyle", "an interior scene with people or animals in it");
    }
    return result("interior-design", "an indoor room / furnished space");
  }

  if (primaryKind === "architecture") {
    return result("architecture", "the primary subject is a building / structure");
  }

  if (primaryKind === "person") {
    if (scene.location || hasAction || scene.setting) {
      return result("lifestyle", "a person doing something / in a place");
    }
    return result("portrait", "a person with no wider scene");
  }

  if (primaryKind === "animal") {
    // Indoors → a pet lifestyle scene, never wildlife (a dog on a sofa isn't a nature shot).
    if (scene.environment === "indoor") {
      return result("lifestyle", "an animal indoors within a scene");
    }
    if (scene.environment === "outdoor" || hasAction) {
      return result("wildlife", "an animal outdoors or in motion");
    }
    return result("lifestyle", "an animal within a scene (not an isolated portrait)");
  }

  if (primaryKind === "nature" || (!scene.primarySubject && scene.environment === "outdoor")) {
    return result("landscape", "a natural / outdoor scene without a dominant subject");
  }

  return result("still-life", "no dominant subject detected");
}
