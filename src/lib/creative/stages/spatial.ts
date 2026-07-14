/**
 * Stage 1.5 — Spatial Analysis.
 *
 * Turns the flat list of scene entities into a lightweight, INTERNAL scene graph: each entity
 * becomes a node (with any descriptor + frame position), and spatial prepositions become directed
 * relationships between nodes ("dog" —on→ "sofa", "window" —behind→ "sofa"). Pure + deterministic;
 * the graph exists only during prompt generation and is never persisted.
 */
import { descriptorBefore, findPositions, findRelations } from "../lexicon";
import type {
  Scene,
  SceneEntity,
  SceneGraph,
  SceneNode,
  SceneRelationship,
} from "../types";

/** The entity whose token starts nearest before `index` (the subject of a relation/position). */
function nearestBefore(entities: SceneEntity[], index: number): number {
  let best = -1;
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].index < index) best = i;
    else break;
  }
  return best;
}

/** The entity whose token starts nearest at/after `index` (the target of a relation). */
function nearestAfter(entities: SceneEntity[], index: number): number {
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].index >= index) return i;
  }
  return -1;
}

export function analyzeSpatial(idea: string, scene: Scene): SceneGraph {
  const entities = scene.entities;

  const nodes: SceneNode[] = entities.map((e, i) => ({
    id: `n${i}`,
    token: e.token,
    kind: e.kind,
    descriptor: descriptorBefore(idea, e.index),
    position: null,
  }));

  const positionHits = findPositions(idea);

  // Positions attach to the nearest preceding entity ("a red sofa in the center of ..." → sofa).
  for (const hit of positionHits) {
    const i = nearestBefore(entities, hit.index);
    if (i >= 0 && !nodes[i].position) nodes[i].position = hit.position;
  }

  // Relationships: subject = nearest entity before the phrase, target = nearest entity after it.
  // Skip any relation that overlaps a position phrase (e.g. "on the left" is a position, not "on").
  const relationships: SceneRelationship[] = [];
  for (const rel of findRelations(idea)) {
    const overlapsPosition = positionHits.some(
      (p) => rel.index < p.index + p.length && p.index < rel.index + rel.length,
    );
    if (overlapsPosition) continue;

    const fromIdx = nearestBefore(entities, rel.index);
    const toIdx = nearestAfter(entities, rel.index + rel.length);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
      relationships.push({ from: `n${fromIdx}`, type: rel.type, to: `n${toIdx}` });
    }
  }

  return { nodes, relationships, root: nodes[0]?.id ?? null };
}
