/**
 * Centrality measures: InStrength, OutStrength, Closeness, Betweenness.
 */
import { Matrix } from '../core/matrix.js';
import type { TNA, GroupTNA, CentralityMeasure, CentralityResult } from '../core/types.js';
import { isGroupTNA, groupEntries } from '../model/group.js';

export const AVAILABLE_MEASURES: CentralityMeasure[] = [
  'InStrength', 'OutStrength', 'Closeness', 'Betweenness',
];

/**
 * Compute centrality measures for a TNA model.
 */
export function centralities(
  model: TNA | GroupTNA,
  options?: {
    loops?: boolean;
    normalize?: boolean;
    measures?: CentralityMeasure[];
  },
): CentralityResult {
  if (isGroupTNA(model)) {
    const allLabels: string[] = [];
    const allGroups: string[] = [];
    const allMeasures: Record<CentralityMeasure, number[]> = {} as Record<CentralityMeasure, number[]>;

    for (const [name, m] of groupEntries(model)) {
      const result = centralities(m, options);
      for (let i = 0; i < result.labels.length; i++) {
        allLabels.push(result.labels[i]!);
        allGroups.push(name);
      }
      for (const [measure, values] of Object.entries(result.measures) as [CentralityMeasure, Float64Array][]) {
        if (!allMeasures[measure]) allMeasures[measure] = [];
        for (let i = 0; i < values.length; i++) {
          allMeasures[measure]!.push(values[i]!);
        }
      }
    }

    const measures: Record<CentralityMeasure, Float64Array> = {} as Record<CentralityMeasure, Float64Array>;
    for (const [m, vals] of Object.entries(allMeasures) as [CentralityMeasure, number[]][]) {
      measures[m] = new Float64Array(vals);
    }

    return { labels: allLabels, measures, groups: allGroups };
  }

  const tnaModel = model as TNA;
  const requestedMeasures = options?.measures ?? [...AVAILABLE_MEASURES];
  const loops = options?.loops ?? false;
  const normalize = options?.normalize ?? false;

  const weights = tnaModel.weights.clone();
  const n = weights.rows;

  if (!loops) {
    for (let i = 0; i < n; i++) weights.set(i, i, 0);
  }

  const isUndirected = tnaModel.type === 'co-occurrence' || tnaModel.type === 'attention';

  const measures: Record<string, Float64Array> = {};

  for (const measure of AVAILABLE_MEASURES) {
    if (!requestedMeasures.includes(measure)) continue;

    switch (measure) {
      case 'InStrength':
        measures.InStrength = weights.colSums();
        break;
      case 'OutStrength':
        measures.OutStrength = weights.rowSums();
        break;
      case 'Closeness':
        measures.Closeness = closeness(weights, n);
        break;
      case 'Betweenness':
        measures.Betweenness = betweenness(weights, n, isUndirected);
        break;
    }
  }

  if (normalize) {
    for (const key of Object.keys(measures)) {
      const vals = measures[key]!;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i]! < min) min = vals[i]!;
        if (vals[i]! > max) max = vals[i]!;
      }
      if (max > min) {
        for (let i = 0; i < vals.length; i++) {
          vals[i] = (vals[i]! - min) / (max - min);
        }
      } else {
        vals.fill(0);
      }
    }
  }

  return {
    labels: tnaModel.labels,
    measures: measures as Record<CentralityMeasure, Float64Array>,
  };
}

// ---- Dijkstra shortest paths from source (shared by Closeness + Betweenness) ----

interface DijkstraResult {
  dist: Float64Array;
  sigma: Float64Array;
  pred: number[][];
  stack: number[];
}

function dijkstra(weights: Matrix, n: number, s: number): DijkstraResult {
  const stack: number[] = [];
  const pred: number[][] = Array.from({ length: n }, () => []);
  const sigma = new Float64Array(n);
  const dist = new Float64Array(n).fill(Infinity);

  sigma[s] = 1;
  dist[s] = 0;

  const visited = new Uint8Array(n);

  for (let step = 0; step < n; step++) {
    let u = -1;
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i]! < minDist) {
        minDist = dist[i]!;
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = 1;
    stack.push(u);

    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      const w = weights.get(u, v);
      if (w <= 0) continue;
      const d = 1 / w;
      const newDist = dist[u]! + d;

      if (newDist < dist[v]! - 1e-15) {
        dist[v] = newDist;
        sigma[v] = sigma[u]!;
        pred[v] = [u];
      } else if (Math.abs(newDist - dist[v]!) < 1e-15) {
        sigma[v] = sigma[v]! + sigma[u]!;
        pred[v]!.push(u);
      }
    }
  }

  return { dist, sigma, pred, stack };
}

// ---- Closeness centrality ----

function closeness(weights: Matrix, n: number): Float64Array {
  const result = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    const { dist } = dijkstra(weights, n, s);
    let sumDist = 0;
    let reachable = 0;
    for (let t = 0; t < n; t++) {
      if (t === s) continue;
      if (dist[t]! < Infinity) {
        sumDist += dist[t]!;
        reachable++;
      }
    }
    // Wasserman-Faust normalization: (reachable) / sumDist
    result[s] = reachable > 0 && sumDist > 0 ? reachable / sumDist : 0;
  }

  return result;
}

// ---- Betweenness (Brandes' algorithm using shared Dijkstra) ----

function betweenness(weights: Matrix, n: number, undirected = false): Float64Array {
  const CB = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    const { sigma, pred, stack } = dijkstra(weights, n, s);

    const delta = new Float64Array(n);
    const revStack = stack.slice().reverse();
    for (const w of revStack) {
      for (const v of pred[w]!) {
        const frac = (sigma[v]! / sigma[w]!) * (1 + delta[w]!);
        delta[v] = delta[v]! + frac;
      }
      if (w !== s) {
        CB[w] = CB[w]! + delta[w]!;
      }
    }
  }

  if (undirected) {
    for (let i = 0; i < n; i++) CB[i] = CB[i]! / 2;
  }

  return CB;
}
