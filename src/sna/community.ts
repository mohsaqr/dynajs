/**
 * Louvain community detection for directed weighted networks.
 */
import type { TNA, CommunityResult } from '../core/types.js';

/**
 * Detect communities using the Louvain algorithm.
 *
 * Modularity formula (directed, weighted):
 *   Q = (1/m) * sum_ij [ A_ij - gamma * (s_out_i * s_in_j) / m ] * delta(c_i, c_j)
 *
 * @param resolution - gamma parameter (default 1.0). Higher = more communities.
 */
export function communities(
  model: TNA,
  options?: { resolution?: number },
): CommunityResult {
  const gamma = options?.resolution ?? 1.0;
  const n = model.weights.rows;

  if (n === 0) {
    return { labels: [], assignments: [], modularity: 0, nCommunities: 0 };
  }
  if (n === 1) {
    return { labels: [...model.labels], assignments: [0], modularity: 0, nCommunities: 1 };
  }

  // Build adjacency as flat array for speed
  const A = new Float64Array(n * n);
  const sOut = new Float64Array(n);
  const sIn = new Float64Array(n);
  let m = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const w = model.weights.get(i, j);
      if (w > 0) {
        A[i * n + j] = w;
        sOut[i] = sOut[i]! + w;
        sIn[j] = sIn[j]! + w;
        m += w;
      }
    }
  }

  if (m === 0) {
    return {
      labels: [...model.labels],
      assignments: Array.from({ length: n }, (_, i) => i),
      modularity: 0,
      nCommunities: n,
    };
  }

  // Initialize: each node in its own community
  const comm = new Int32Array(n);
  for (let i = 0; i < n; i++) comm[i] = i;

  // Track community-level in/out strengths
  const commSIn = new Float64Array(n);
  const commSOut = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    commSIn[i] = sIn[i]!;
    commSOut[i] = sOut[i]!;
  }

  // Track sum of weights within each community
  const commInternalW = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    commInternalW[i] = A[i * n + i]!; // self-loop only initially
  }

  let improved = true;
  while (improved) {
    improved = false;

    for (let i = 0; i < n; i++) {
      const ci = comm[i]!;

      // Compute weights from node i to each neighboring community
      const neighborComms = new Map<number, number>();
      for (let j = 0; j < n; j++) {
        const wij = A[i * n + j]!;
        const wji = A[j * n + i]!;
        if (wij > 0 || wji > 0) {
          const cj = comm[j]!;
          neighborComms.set(cj, (neighborComms.get(cj) ?? 0) + wij + wji);
        }
      }

      // Weight to own community (excluding self)
      const wToCurrent = neighborComms.get(ci) ?? 0;

      // Remove node i from its community
      commSOut[ci] = commSOut[ci]! - sOut[i]!;
      commSIn[ci] = commSIn[ci]! - sIn[i]!;

      let bestComm = ci;
      let bestGain = 0;

      for (const [cj, wToNeighbor] of neighborComms) {
        if (cj === ci) continue;

        // Modularity gain of moving i from ci to cj
        const gain =
          (wToNeighbor - wToCurrent) / m -
          gamma * (
            (sOut[i]! * commSIn[cj]! + sIn[i]! * commSOut[cj]!) -
            (sOut[i]! * commSIn[ci]! + sIn[i]! * commSOut[ci]!)
          ) / (m * m);

        if (gain > bestGain) {
          bestGain = gain;
          bestComm = cj;
        }
      }

      // Put node back
      commSOut[comm[i]!] = commSOut[comm[i]!]! + sOut[i]!;
      commSIn[comm[i]!] = commSIn[comm[i]!]! + sIn[i]!;

      if (bestComm !== ci) {
        // Move node i to bestComm
        commSOut[ci] = commSOut[ci]! - sOut[i]!;
        commSIn[ci] = commSIn[ci]! - sIn[i]!;
        commSOut[bestComm] = commSOut[bestComm]! + sOut[i]!;
        commSIn[bestComm] = commSIn[bestComm]! + sIn[i]!;
        comm[i] = bestComm;
        improved = true;
      }
    }
  }

  // Renumber communities to 0..k-1
  const uniqueComms = [...new Set(comm)];
  uniqueComms.sort((a, b) => a - b);
  const renumber = new Map<number, number>();
  uniqueComms.forEach((c, idx) => renumber.set(c, idx));

  const assignments = Array.from(comm, c => renumber.get(c)!);
  const nCommunities = uniqueComms.length;

  // Compute final modularity
  let Q = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (assignments[i] !== assignments[j]) continue;
      Q += A[i * n + j]! - gamma * (sOut[i]! * sIn[j]!) / m;
    }
  }
  Q /= m;

  return {
    labels: [...model.labels],
    assignments,
    modularity: Q,
    nCommunities,
  };
}
