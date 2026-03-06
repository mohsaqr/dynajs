import { describe, it, expect } from 'vitest';
import { clusterData, prepareData } from '../src/index';

const seqData = [
  ['A', 'B', 'C', 'A'],
  ['A', 'B', 'C', 'B'],
  ['C', 'B', 'A', 'C'],
  ['C', 'B', 'A', 'B'],
  ['A', 'A', 'B', 'C'],
  ['B', 'C', 'A', 'A'],
  ['A', 'B', 'A', 'B'],
  ['B', 'A', 'B', 'A'],
];

describe('clusterData()', () => {
  it('clusters with PAM (default)', () => {
    const result = clusterData(seqData, 2);
    expect(result.k).toBe(2);
    expect(result.assignments.length).toBe(8);
    expect(result.sizes.length).toBe(2);
    expect(result.sizes[0]! + result.sizes[1]!).toBe(8);
    expect(result.method).toBe('pam');
    expect(result.dissimilarity).toBe('hamming');
  });

  it('clusters with hierarchical', () => {
    const result = clusterData(seqData, 2, { method: 'average' });
    expect(result.method).toBe('average');
    expect(result.assignments.length).toBe(8);
  });

  it('supports lv dissimilarity', () => {
    const result = clusterData(seqData, 2, { dissimilarity: 'lv' });
    expect(result.dissimilarity).toBe('lv');
    expect(result.assignments.length).toBe(8);
  });

  it('supports osa dissimilarity', () => {
    const result = clusterData(seqData, 2, { dissimilarity: 'osa' });
    expect(result.dissimilarity).toBe('osa');
  });

  it('supports lcs dissimilarity', () => {
    const result = clusterData(seqData, 2, { dissimilarity: 'lcs' });
    expect(result.dissimilarity).toBe('lcs');
  });

  it('accepts TNAData input', () => {
    const data = prepareData(seqData);
    const result = clusterData(data, 2);
    expect(result.assignments.length).toBe(8);
  });

  it('silhouette is between -1 and 1', () => {
    const result = clusterData(seqData, 2);
    expect(result.silhouette).toBeGreaterThanOrEqual(-1);
    expect(result.silhouette).toBeLessThanOrEqual(1);
  });

  it('assignments are 1-indexed', () => {
    const result = clusterData(seqData, 3);
    const unique = [...new Set(result.assignments)].sort();
    expect(unique[0]).toBe(1);
    expect(unique[unique.length - 1]!).toBeLessThanOrEqual(3);
  });

  it('throws for k < 2', () => {
    expect(() => clusterData(seqData, 1)).toThrow('k must be >= 2');
  });

  it('throws for k > n', () => {
    expect(() => clusterData(seqData, 100)).toThrow('exceeds');
  });

  it('distance matrix is symmetric', () => {
    const result = clusterData(seqData, 2);
    const d = result.distance;
    for (let i = 0; i < d.rows; i++) {
      for (let j = i + 1; j < d.cols; j++) {
        expect(d.get(i, j)).toBe(d.get(j, i));
      }
    }
  });
});
