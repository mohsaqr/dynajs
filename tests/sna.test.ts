import { describe, it, expect } from 'vitest';
import {
  tna, ftna, ctna,
  centralities,
  communities,
  layout,
  networkDensity,
  degreeDistribution,
  Matrix,
} from '../src/index';
import type { TNA } from '../src/index';

// Shared fixture — same as centralities.test.ts
const seqData = [
  ['A', 'B', 'C', 'A', 'B'],
  ['B', 'C', 'A', 'B', 'C'],
  ['A', 'A', 'B', 'C', 'A'],
  ['C', 'B', 'A', 'C', 'B'],
  ['A', 'B', 'A', 'B', 'C'],
];

// Two disconnected cliques
const clique1 = [
  ['X', 'Y', 'X', 'Y'],
  ['Y', 'X', 'Y', 'X'],
];
const clique2 = [
  ['P', 'Q', 'P', 'Q'],
  ['Q', 'P', 'Q', 'P'],
];

// Helper to build a model from a raw matrix
function modelFromMatrix(data: number[][], labels: string[]): TNA {
  const n = labels.length;
  const w = Matrix.zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      w.set(i, j, data[i]![j]!);
    }
  }
  return {
    weights: w,
    inits: new Float64Array(n).fill(1 / n),
    labels,
    data: null,
    type: 'matrix',
    scaling: [],
  };
}

// ── Extended Centralities ──────────────────────────────────────────

describe('OutStrength centrality', () => {
  it('equals rowSums without self-loops', () => {
    const model = tna(seqData);
    const result = centralities(model, { measures: ['OutStrength'] });
    const w = model.weights.clone();
    for (let i = 0; i < 3; i++) w.set(i, i, 0);
    const rowSums = w.rowSums();
    for (let i = 0; i < 3; i++) {
      expect(result.measures.OutStrength[i]).toBeCloseTo(rowSums[i]!, 10);
    }
  });
});

describe('Closeness centrality', () => {
  it('is non-negative', () => {
    const model = tna(seqData);
    const result = centralities(model, { measures: ['Closeness'] });
    for (let i = 0; i < 3; i++) {
      expect(result.measures.Closeness[i]!).toBeGreaterThanOrEqual(0);
    }
  });

  it('is zero for isolated nodes', () => {
    // Node C has no outgoing edges → can't reach anyone → closeness = 0
    const m = modelFromMatrix(
      [
        [0, 1, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      ['A', 'B', 'C'],
    );
    const result = centralities(m, { measures: ['Closeness'] });
    // B and C can't reach anyone → closeness = 0
    expect(result.measures.Closeness[1]).toBe(0);
    expect(result.measures.Closeness[2]).toBe(0);
    // A can reach B
    expect(result.measures.Closeness[0]!).toBeGreaterThan(0);
  });

  it('all 4 measures work together', () => {
    const model = tna(seqData);
    const result = centralities(model, {
      measures: ['InStrength', 'OutStrength', 'Closeness', 'Betweenness'],
    });
    expect(result.measures.InStrength.length).toBe(3);
    expect(result.measures.OutStrength.length).toBe(3);
    expect(result.measures.Closeness.length).toBe(3);
    expect(result.measures.Betweenness.length).toBe(3);
  });
});

// ── Network Metrics ────────────────────────────────────────────────

describe('networkDensity()', () => {
  it('fully connected 3-node graph has density 1', () => {
    const m = modelFromMatrix(
      [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ],
      ['A', 'B', 'C'],
    );
    expect(networkDensity(m)).toBeCloseTo(1.0, 10);
  });

  it('empty graph has density 0', () => {
    const m = modelFromMatrix(
      [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      ['A', 'B', 'C'],
    );
    expect(networkDensity(m)).toBe(0);
  });

  it('single-node graph has density 0', () => {
    const m = modelFromMatrix([[0]], ['A']);
    expect(networkDensity(m)).toBe(0);
  });

  it('returns value in [0, 1] for real model', () => {
    const model = tna(seqData);
    const d = networkDensity(model);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
  });
});

describe('degreeDistribution()', () => {
  it('counts match manual check', () => {
    const m = modelFromMatrix(
      [
        [0, 1, 0],
        [1, 0, 1],
        [0, 0, 0],
      ],
      ['A', 'B', 'C'],
    );
    const dd = degreeDistribution(m);
    // outDegree: A=1, B=2, C=0
    expect(dd.outDegree[0]).toBe(1);
    expect(dd.outDegree[1]).toBe(2);
    expect(dd.outDegree[2]).toBe(0);
    // inDegree: A=1, B=1, C=1
    expect(dd.inDegree[0]).toBe(1);
    expect(dd.inDegree[1]).toBe(1);
    expect(dd.inDegree[2]).toBe(1);
    // totalDegree
    expect(dd.totalDegree[0]).toBe(2);
    expect(dd.totalDegree[1]).toBe(3);
    expect(dd.totalDegree[2]).toBe(1);
  });

  it('labels match model labels', () => {
    const model = tna(seqData);
    const dd = degreeDistribution(model);
    expect(dd.labels).toEqual(model.labels);
  });
});

// ── Community Detection ────────────────────────────────────────────

describe('communities()', () => {
  it('single-node graph → 1 community', () => {
    const m = modelFromMatrix([[1]], ['A']);
    const result = communities(m);
    expect(result.nCommunities).toBe(1);
    expect(result.assignments).toEqual([0]);
  });

  it('2 disconnected cliques → 2 communities', () => {
    // Build model with 4 nodes, 2 cliques: {X,Y} and {P,Q}
    const m = modelFromMatrix(
      [
        [0, 5, 0, 0],
        [5, 0, 0, 0],
        [0, 0, 0, 5],
        [0, 0, 5, 0],
      ],
      ['X', 'Y', 'P', 'Q'],
    );
    const result = communities(m);
    expect(result.nCommunities).toBe(2);
    // X and Y should be in the same community
    expect(result.assignments[0]).toBe(result.assignments[1]);
    // P and Q should be in the same community
    expect(result.assignments[2]).toBe(result.assignments[3]);
    // The two cliques should be in different communities
    expect(result.assignments[0]).not.toBe(result.assignments[2]);
  });

  it('modularity is in valid range', () => {
    const model = tna(seqData);
    const result = communities(model);
    expect(result.modularity).toBeGreaterThanOrEqual(-0.5);
    expect(result.modularity).toBeLessThanOrEqual(1);
  });

  it('higher resolution produces more or equal communities', () => {
    const model = ftna(seqData);
    const low = communities(model, { resolution: 0.5 });
    const high = communities(model, { resolution: 5.0 });
    expect(high.nCommunities).toBeGreaterThanOrEqual(low.nCommunities);
  });

  it('labels match model labels', () => {
    const model = tna(seqData);
    const result = communities(model);
    expect(result.labels).toEqual(model.labels);
  });
});

// ── Layouts ────────────────────────────────────────────────────────

describe('layout()', () => {
  it('spring layout returns correct-length arrays', () => {
    const model = tna(seqData);
    const result = layout(model, { algorithm: 'spring' });
    expect(result.x.length).toBe(3);
    expect(result.y.length).toBe(3);
  });

  it('FR layout returns correct-length arrays', () => {
    const model = tna(seqData);
    const result = layout(model, { algorithm: 'fr' });
    expect(result.x.length).toBe(3);
    expect(result.y.length).toBe(3);
  });

  it('coordinates in [0, 1] after normalization', () => {
    const model = tna(seqData);
    for (const algo of ['spring', 'fr'] as const) {
      const result = layout(model, { algorithm: algo });
      for (let i = 0; i < result.x.length; i++) {
        expect(result.x[i]!).toBeGreaterThanOrEqual(0);
        expect(result.x[i]!).toBeLessThanOrEqual(1);
        expect(result.y[i]!).toBeGreaterThanOrEqual(0);
        expect(result.y[i]!).toBeLessThanOrEqual(1);
      }
    }
  });

  it('labels match model labels', () => {
    const model = tna(seqData);
    const result = layout(model);
    expect(result.labels).toEqual(model.labels);
  });

  it('single-node layout does not crash', () => {
    const m = modelFromMatrix([[0]], ['A']);
    const result = layout(m);
    expect(result.x.length).toBe(1);
    expect(result.y.length).toBe(1);
    expect(result.x[0]).toBe(0.5);
    expect(result.y[0]).toBe(0.5);
  });

  it('empty graph does not crash', () => {
    const m: TNA = {
      weights: Matrix.zeros(0, 0),
      inits: new Float64Array(0),
      labels: [],
      data: null,
      type: 'matrix',
      scaling: [],
    };
    const result = layout(m);
    expect(result.x.length).toBe(0);
    expect(result.labels).toEqual([]);
  });
});
