import { describe, it, expect } from 'vitest';
import { discoverPatterns } from '../src/index';

const seqData = [
  ['A', 'B', 'C', 'A', 'B'],
  ['B', 'C', 'A', 'B', 'C'],
  ['A', 'A', 'B', 'C', 'A'],
  ['C', 'B', 'A', 'C', 'B'],
  ['A', 'B', 'A', 'B', 'C'],
  ['B', 'A', 'B', 'C', 'A'],
  ['C', 'A', 'B', 'C', 'B'],
  ['A', 'B', 'C', 'B', 'A'],
];

describe('discoverPatterns()', () => {
  it('discovers n-gram patterns (default)', () => {
    const result = discoverPatterns(seqData);
    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.patterns[0]).toHaveProperty('pattern');
    expect(result.patterns[0]).toHaveProperty('frequency');
    expect(result.patterns[0]).toHaveProperty('support');
    expect(result.patterns[0]).toHaveProperty('lift');
  });

  it('patterns are sorted by frequency descending', () => {
    const result = discoverPatterns(seqData);
    for (let i = 1; i < result.patterns.length; i++) {
      expect(result.patterns[i]!.frequency).toBeLessThanOrEqual(
        result.patterns[i - 1]!.frequency,
      );
    }
  });

  it('supports len parameter', () => {
    const result = discoverPatterns(seqData, { len: [2] });
    for (const p of result.patterns) {
      expect(p.length).toBe(2);
    }
  });

  it('discovers gapped patterns', () => {
    const result = discoverPatterns(seqData, { type: 'gapped', gap: [1] });
    expect(result.patterns.length).toBeGreaterThan(0);
    // Gapped patterns contain wildcards
    for (const p of result.patterns) {
      expect(p.pattern).toContain('*');
    }
  });

  it('discovers repeated patterns', () => {
    const data = [
      ['A', 'A', 'B', 'B'],
      ['A', 'A', 'C', 'C'],
      ['B', 'B', 'A', 'A'],
      ['B', 'B', 'C', 'C'],
    ];
    const result = discoverPatterns(data, { type: 'repeated', len: [2] });
    // Only repeated (same state) patterns
    for (const p of result.patterns) {
      const states = p.pattern.split('->');
      expect(new Set(states).size).toBe(1);
    }
  });

  it('filters by minFreq', () => {
    const result = discoverPatterns(seqData, { minFreq: 5 });
    for (const p of result.patterns) {
      expect(p.frequency).toBeGreaterThanOrEqual(5);
    }
  });

  it('filters by minSupport', () => {
    const result = discoverPatterns(seqData, { minSupport: 0.5 });
    for (const p of result.patterns) {
      expect(p.support).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('searches for specific pattern', () => {
    const result = discoverPatterns(seqData, { pattern: 'A->B->C' });
    for (const p of result.patterns) {
      expect(p.pattern).toBe('A->B->C');
    }
  });

  it('supports group parameter with chi-squared', () => {
    const groups = ['G1', 'G1', 'G1', 'G1', 'G2', 'G2', 'G2', 'G2'];
    const result = discoverPatterns(seqData, { group: groups });
    // At least some patterns should have group stats
    const withGroups = result.patterns.filter((p) => p.groupCounts);
    expect(withGroups.length).toBeGreaterThan(0);
    // Check chi-sq fields exist
    for (const p of withGroups) {
      expect(p.chisq).toBeDefined();
      expect(p.pValue).toBeDefined();
      expect(p.pValue!).toBeGreaterThanOrEqual(0);
      expect(p.pValue!).toBeLessThanOrEqual(1);
    }
  });

  it('filters by start', () => {
    const result = discoverPatterns(seqData, { start: ['A'], len: [2] });
    for (const p of result.patterns) {
      expect(p.pattern.startsWith('A')).toBe(true);
    }
  });

  it('filters by end', () => {
    const result = discoverPatterns(seqData, { end: ['C'], len: [2] });
    for (const p of result.patterns) {
      expect(p.pattern.endsWith('C')).toBe(true);
    }
  });

  it('proportions sum to ~1 within each length', () => {
    const result = discoverPatterns(seqData, { len: [2], minFreq: 1, minSupport: 0 });
    const sum = result.patterns
      .filter((p) => p.length === 2)
      .reduce((s, p) => s + p.proportion, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('handles null values in data', () => {
    const data = [
      ['A', null, 'B', 'C'],
      ['A', 'B', null, 'C'],
      ['A', 'B', 'C', null],
    ];
    const result = discoverPatterns(data, { len: [2], minFreq: 1, minSupport: 0 });
    expect(result.patterns.length).toBeGreaterThan(0);
  });
});
