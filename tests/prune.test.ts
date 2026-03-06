import { describe, it, expect } from 'vitest';
import { tna, prune, groupTna } from '../src/index';

const seqData = [
  ['A', 'B', 'C', 'A', 'B'],
  ['B', 'C', 'A', 'B', 'C'],
  ['A', 'A', 'B', 'C', 'A'],
  ['C', 'B', 'A', 'C', 'B'],
  ['A', 'B', 'A', 'B', 'C'],
];

describe('prune()', () => {
  it('removes edges below threshold', () => {
    const model = tna(seqData);
    const pruned = prune(model, 0.2) as ReturnType<typeof tna>;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const v = pruned.weights.get(i, j);
        expect(v === 0 || v >= 0.2).toBe(true);
      }
    }
  });

  it('preserves model metadata', () => {
    const model = tna(seqData);
    const pruned = prune(model, 0.1) as ReturnType<typeof tna>;
    expect(pruned.labels).toEqual(model.labels);
    expect(pruned.type).toBe(model.type);
  });

  it('default threshold is 0.1', () => {
    const model = tna(seqData);
    const pruned = prune(model) as ReturnType<typeof tna>;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const v = pruned.weights.get(i, j);
        expect(v === 0 || v >= 0.1).toBe(true);
      }
    }
  });

  it('works with GroupTNA', () => {
    const groups = ['G1', 'G1', 'G2', 'G2', 'G1'];
    const g = groupTna(seqData, groups);
    const pruned = prune(g, 0.2);
    expect(pruned).toHaveProperty('G1');
    expect(pruned).toHaveProperty('G2');
  });

  it('threshold 0 keeps all edges', () => {
    const model = tna(seqData);
    const pruned = prune(model, 0) as ReturnType<typeof tna>;
    expect(pruned.weights.count((v) => v > 0)).toBe(model.weights.count((v) => v > 0));
  });

  it('threshold 1 removes most edges', () => {
    const model = tna(seqData);
    const pruned = prune(model, 1.0) as ReturnType<typeof tna>;
    // All edges should be removed (relative model max is < 1)
    expect(pruned.weights.count((v) => v > 0)).toBe(0);
  });
});
