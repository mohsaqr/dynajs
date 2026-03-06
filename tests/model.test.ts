import { describe, it, expect } from 'vitest';
import {
  tna, ftna, ctna, atna,
  buildModel, summary, prepareData,
  groupTna, groupFtna, groupCtna, groupAtna,
  isGroupTNA, groupNames, groupApply, renameGroups,
  Matrix,
} from '../src/index';

const seqData = [
  ['A', 'B', 'C', 'A', 'B'],
  ['B', 'C', 'A', 'B', 'C'],
  ['A', 'A', 'B', 'C', 'A'],
  ['C', 'B', 'A', 'C', 'B'],
  ['A', 'B', 'A', 'B', 'C'],
];

describe('tna()', () => {
  it('builds relative model with correct labels', () => {
    const model = tna(seqData);
    expect(model.labels).toEqual(['A', 'B', 'C']);
    expect(model.type).toBe('relative');
    expect(model.weights.rows).toBe(3);
    expect(model.weights.cols).toBe(3);
  });

  it('row sums ~1 for relative model', () => {
    const model = tna(seqData);
    const sums = model.weights.rowSums();
    for (let i = 0; i < sums.length; i++) {
      expect(sums[i]).toBeCloseTo(1, 10);
    }
  });

  it('inits sum to 1', () => {
    const model = tna(seqData);
    const sum = model.inits.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('ftna()', () => {
  it('builds frequency model with integer counts', () => {
    const model = ftna(seqData);
    expect(model.type).toBe('frequency');
    // Frequency values should be non-negative integers
    for (let i = 0; i < model.weights.data.length; i++) {
      expect(model.weights.data[i]! % 1).toBe(0);
      expect(model.weights.data[i]!).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('ctna()', () => {
  it('builds symmetric co-occurrence model', () => {
    const model = ctna(seqData);
    expect(model.type).toBe('co-occurrence');
    // Co-occurrence is symmetric
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(model.weights.get(i, j)).toBe(model.weights.get(j, i));
      }
    }
  });
});

describe('atna()', () => {
  it('builds attention model with decay', () => {
    const model = atna(seqData, { beta: 0.5 });
    expect(model.type).toBe('attention');
    expect(model.params?.beta).toBe(0.5);
    // Values should be non-negative
    for (let i = 0; i < model.weights.data.length; i++) {
      expect(model.weights.data[i]!).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('buildModel()', () => {
  it('accepts number[][] matrix input', () => {
    const mat = [
      [0, 0.5, 0.5],
      [0.3, 0, 0.7],
      [0.4, 0.6, 0],
    ];
    const model = buildModel(mat);
    expect(model.labels).toEqual(['S1', 'S2', 'S3']);
    expect(model.data).toBeNull();
  });

  it('accepts TNAData input', () => {
    const data = prepareData(seqData);
    const model = buildModel(data);
    expect(model.labels).toEqual(['A', 'B', 'C']);
  });

  it('supports scaling', () => {
    const model = tna(seqData, { scaling: 'minmax' });
    expect(model.scaling).toEqual(['minmax']);
    expect(model.weights.min()).toBeGreaterThanOrEqual(0);
    expect(model.weights.max()).toBeLessThanOrEqual(1);
  });

  it('supports begin/end states', () => {
    const model = tna(seqData, { beginState: 'START', endState: 'END' });
    expect(model.labels).toContain('START');
    expect(model.labels).toContain('END');
    expect(model.labels.length).toBe(5);
  });
});

describe('summary()', () => {
  it('returns expected keys', () => {
    const model = tna(seqData);
    const s = summary(model);
    expect(s).toHaveProperty('nStates');
    expect(s).toHaveProperty('type');
    expect(s).toHaveProperty('nEdges');
    expect(s).toHaveProperty('density');
    expect(s).toHaveProperty('meanWeight');
    expect(s).toHaveProperty('maxWeight');
    expect(s.nStates).toBe(3);
  });
});

describe('group models', () => {
  const groups = ['G1', 'G1', 'G2', 'G2', 'G1'];

  it('groupTna creates per-group models', () => {
    const g = groupTna(seqData, groups);
    expect(isGroupTNA(g)).toBe(true);
    expect(groupNames(g)).toEqual(['G1', 'G2']);
    expect(g.models['G1']!.type).toBe('relative');
  });

  it('groupFtna creates frequency models', () => {
    const g = groupFtna(seqData, groups);
    expect(g.models['G1']!.type).toBe('frequency');
  });

  it('groupCtna creates co-occurrence models', () => {
    const g = groupCtna(seqData, groups);
    expect(g.models['G2']!.type).toBe('co-occurrence');
  });

  it('groupAtna creates attention models', () => {
    const g = groupAtna(seqData, groups);
    expect(g.models['G1']!.type).toBe('attention');
  });

  it('groupApply maps function over groups', () => {
    const g = groupTna(seqData, groups);
    const sizes = groupApply(g, (m) => m.labels.length);
    expect(sizes).toEqual({ G1: 3, G2: 3 });
  });

  it('renameGroups works', () => {
    const g = groupTna(seqData, groups);
    const renamed = renameGroups(g, ['Group1', 'Group2']);
    expect(groupNames(renamed)).toEqual(['Group1', 'Group2']);
  });
});

describe('prepareData()', () => {
  it('returns correct statistics', () => {
    const data = prepareData(seqData);
    expect(data.statistics.nSessions).toBe(5);
    expect(data.statistics.nUniqueActions).toBe(3);
    expect(data.statistics.uniqueActions).toEqual(['A', 'B', 'C']);
    expect(data.statistics.maxSequenceLength).toBe(5);
    expect(data.statistics.meanSequenceLength).toBe(5);
  });
});
