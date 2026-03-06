import { describe, it, expect } from 'vitest';
import { stateFrequencies, statePresence } from '../src/index';

const seqData = [
  ['A', 'B', 'C', 'A', 'B'],
  ['B', 'C', 'A', 'B', 'C'],
  ['A', 'A', 'B', 'C', 'A'],
];

describe('stateFrequencies()', () => {
  it('counts total occurrences', () => {
    const freq = stateFrequencies(seqData);
    // A: 2+1+3=6, B: 2+2+1=5, C: 1+2+1=4
    expect(freq['A']).toBe(6);
    expect(freq['B']).toBe(5);
    expect(freq['C']).toBe(4);
  });

  it('handles null/empty values', () => {
    const data = [
      ['A', null, 'B'],
      ['A', '', 'C'],
    ];
    const freq = stateFrequencies(data);
    expect(freq['A']).toBe(2);
    expect(freq['B']).toBe(1);
    expect(freq['C']).toBe(1);
    expect(Object.keys(freq).length).toBe(3);
  });

  it('returns sorted keys', () => {
    const freq = stateFrequencies(seqData);
    const keys = Object.keys(freq);
    expect(keys).toEqual(['A', 'B', 'C']);
  });

  it('handles empty data', () => {
    const freq = stateFrequencies([]);
    expect(Object.keys(freq).length).toBe(0);
  });
});

describe('statePresence()', () => {
  it('counts sequences containing each state', () => {
    const presence = statePresence(seqData);
    // All 3 sequences contain A, B, C
    expect(presence['A']).toBe(3);
    expect(presence['B']).toBe(3);
    expect(presence['C']).toBe(3);
  });

  it('counts presence not frequency', () => {
    const data = [
      ['A', 'A', 'A'],
      ['B', 'B', 'B'],
    ];
    const presence = statePresence(data);
    expect(presence['A']).toBe(1);
    expect(presence['B']).toBe(1);
  });
});
