/** Cosine similarity between two equal-length vectors. Pure. Returns 0 for degenerate input. */
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Clamp a raw cosine (−1..1) into a 0..1 identity-similarity score. */
export const toSimilarity = (c: number): number => Math.max(0, Math.min(1, c));
