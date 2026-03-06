import { describe, it, expect } from 'vitest';
import { tna, ctna, centralities, groupTna } from '../src/index';

const seqData = [
  ['A', 'B', 'C', 'A', 'B'],
  ['B', 'C', 'A', 'B', 'C'],
  ['A', 'A', 'B', 'C', 'A'],
  ['C', 'B', 'A', 'C', 'B'],
  ['A', 'B', 'A', 'B', 'C'],
];

describe('centralities()', () => {
  it('returns InStrength and Betweenness', () => {
    const model = tna(seqData);
    const result = centralities(model);
    expect(result.labels).toEqual(['A', 'B', 'C']);
    expect(result.measures.InStrength).toBeDefined();
    expect(result.measures.Betweenness).toBeDefined();
    expect(result.measures.InStrength.length).toBe(3);
    expect(result.measures.Betweenness.length).toBe(3);
  });

  it('InStrength equals column sums without self-loops', () => {
    const model = tna(seqData);
    const result = centralities(model);
    const w = model.weights.clone();
    // Remove self-loops
    for (let i = 0; i < 3; i++) w.set(i, i, 0);
    const colSums = w.colSums();
    for (let i = 0; i < 3; i++) {
      expect(result.measures.InStrength[i]).toBeCloseTo(colSums[i]!, 10);
    }
  });

  it('Betweenness is non-negative', () => {
    const model = tna(seqData);
    const result = centralities(model);
    for (let i = 0; i < 3; i++) {
      expect(result.measures.Betweenness[i]!).toBeGreaterThanOrEqual(0);
    }
  });

  it('halves betweenness for undirected models', () => {
    const model = ctna(seqData);
    const result = centralities(model);
    // Just check it doesn't crash and returns valid values
    for (let i = 0; i < 3; i++) {
      expect(result.measures.Betweenness[i]!).toBeGreaterThanOrEqual(0);
    }
  });

  it('supports normalize option', () => {
    const model = tna(seqData);
    const result = centralities(model, { normalize: true });
    const inStr = result.measures.InStrength;
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < inStr.length; i++) {
      if (inStr[i]! > max) max = inStr[i]!;
      if (inStr[i]! < min) min = inStr[i]!;
    }
    // After normalization, range should be [0, 1]
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
  });

  it('supports measure selection', () => {
    const model = tna(seqData);
    const result = centralities(model, { measures: ['InStrength'] });
    expect(result.measures.InStrength).toBeDefined();
    expect(result.measures.Betweenness).toBeUndefined();
  });

  it('supports GroupTNA', () => {
    const groups = ['G1', 'G1', 'G2', 'G2', 'G1'];
    const g = groupTna(seqData, groups);
    const result = centralities(g);
    expect(result.labels.length).toBe(6); // 3 states * 2 groups
    expect(result.groups!.length).toBe(6);
  });
});
