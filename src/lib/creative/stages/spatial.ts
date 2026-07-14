/**
 * Stage 1.5 — Spatial Analysis (v4: true scene graph).
 *
 * Builds a lightweight, INTERNAL scene graph: nodes (entity + descriptor + role + position), an
 * ANCHOR (the central object everything is positioned around), and confidence-scored
 * relationships. Explicit prepositions → high-confidence directed edges; co-mentioned objects with
 * no preposition → a low-confidence NEUTRAL association to the anchor (never a fabricated
 * direction). Pure + deterministic; the graph exists only during prompt generation.
 */
import { descriptorBefore, findPositions, findRelations } from "../lexicon";
import type {
  EntityKind,
  NodeRole,
  Scene,
  SceneEntity,
  SceneGraph,
  SceneNode,
  SceneRelationship,
} from "../types";

/** Kinds that anchor a scene as a subject (rather than the room's furniture). */
const SUBJECT_ANCHOR_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>([
  "person",
  "animal",
  "vehicle",
]);

/** The characteristic anchor furniture for a named room (first present wins). */
const ROOM_ANCHOR: Record<string, string[]> = {
  "living room": ["sofa", "couch", "armchair"],
  bedroom: ["bed"],
  kitchen: ["kitchen island", "island", "counter", "table"],
  "dining room": ["table"],
  office: ["desk"],
};

const HIGH_CONFIDENCE = 0.9;
const LOW_CONFIDENCE = 0.4;

function nearestBefore(entities: SceneEntity[], index: number): number {
  let best = -1;
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].index < index) best = i;
    else break;
  }
  return best;
}

function nearestAfter(entities: SceneEntity[], index: number): number {
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].index >= index) return i;
  }
  return -1;
}

/** Role of an entity from the scene's own classification. */
function roleOf(entity: SceneEntity, scene: Scene): NodeRole {
  if (scene.primarySubject && entity === scene.primarySubject) return "primary";
  if (scene.secondarySubjects.includes(entity)) return "secondary";
  return "object";
}

/** Pick the anchor: a subject (person/animal/vehicle) if present, else the room's key furniture. */
function pickAnchor(scene: Scene, nodes: SceneNode[]): string | null {
  const primary = nodes[0];
  if (primary && SUBJECT_ANCHOR_KINDS.has(primary.kind)) return primary.id;

  if (scene.setting && ROOM_ANCHOR[scene.setting]) {
    for (const token of ROOM_ANCHOR[scene.setting]) {
      const hit = nodes.find((n) => n.token === token);
      if (hit) return hit.id;
    }
    const furniture = nodes.find((n) => n.kind === "furniture");
    if (furniture) return furniture.id;
  }
  return primary?.id ?? null;
}

export function analyzeSpatial(idea: string, scene: Scene): SceneGraph {
  const entities = scene.entities;

  const nodes: SceneNode[] = entities.map((e, i) => ({
    id: `n${i}`,
    token: e.token,
    kind: e.kind,
    role: roleOf(e, scene),
    descriptor: descriptorBefore(idea, e.index),
    position: null,
  }));

  const positionHits = findPositions(idea);
  for (const hit of positionHits) {
    const i = nearestBefore(entities, hit.index);
    if (i >= 0 && !nodes[i].position) nodes[i].position = hit.position;
  }

  const anchor = pickAnchor(scene, nodes);

  // 1) Explicit relationships from prepositions (high confidence).
  const relationships: SceneRelationship[] = [];
  const relatedNodeIds = new Set<string>();
  for (const rel of findRelations(idea)) {
    const overlapsPosition = positionHits.some(
      (p) => rel.index < p.index + p.length && p.index < rel.index + rel.length,
    );
    if (overlapsPosition) continue;

    const fromIdx = nearestBefore(entities, rel.index);
    const toIdx = nearestAfter(entities, rel.index + rel.length);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
      relationships.push({
        from: `n${fromIdx}`,
        type: rel.type,
        to: `n${toIdx}`,
        confidence: HIGH_CONFIDENCE,
      });
      relatedNodeIds.add(`n${fromIdx}`);
      relatedNodeIds.add(`n${toIdx}`);
    }
  }

  // 2) Anchor-proximity inference (low confidence, NEUTRAL): surrounding objects with no explicit
  //    relation are associated with the anchor as "near" — we never invent a specific direction.
  if (anchor) {
    for (const node of nodes) {
      if (node.id === anchor) continue;
      if (relatedNodeIds.has(node.id)) continue;
      if (node.role === "primary") continue; // the subject isn't "near" the anchor
      relationships.push({
        from: node.id,
        type: "near",
        to: anchor,
        confidence: LOW_CONFIDENCE,
      });
    }
  }

  return { nodes, relationships, anchor };
}
