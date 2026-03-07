/**
 * Network-level metrics: density and degree distribution.
 */
import type { TNA, DegreeDistribution } from '../core/types.js';

/**
 * Network density: fraction of possible edges that exist.
 * Directed by default. For undirected (co-occurrence/attention), divides by 2.
 */
export function networkDensity(
  model: TNA,
  options?: { loops?: boolean },
): number {
  const n = model.weights.rows;
  if (n <= 1) return 0;

  const loops = options?.loops ?? false;
  const isUndirected = model.type === 'co-occurrence' || model.type === 'attention';

  let edgeCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!loops && i === j) continue;
      if (model.weights.get(i, j) > 0) edgeCount++;
    }
  }

  const maxEdges = loops ? n * n : n * (n - 1);
  if (isUndirected) {
    // Each undirected edge counted twice in the directed loop
    return edgeCount / 2 / (maxEdges / 2);
  }

  return edgeCount / maxEdges;
}

/**
 * Degree distribution: in-degree, out-degree, total degree per node.
 * Counts non-zero entries (unweighted).
 */
export function degreeDistribution(
  model: TNA,
  options?: { loops?: boolean },
): DegreeDistribution {
  const n = model.weights.rows;
  const loops = options?.loops ?? false;

  const inDegree = new Float64Array(n);
  const outDegree = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!loops && i === j) continue;
      if (model.weights.get(i, j) > 0) {
        outDegree[i] = outDegree[i]! + 1;
        inDegree[j] = inDegree[j]! + 1;
      }
    }
  }

  const totalDegree = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    totalDegree[i] = inDegree[i]! + outDegree[i]!;
  }

  return { inDegree, outDegree, totalDegree, labels: model.labels };
}
