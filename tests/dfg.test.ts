import { describe, it, expect } from 'vitest';
import { tna, ftna, groupTna, buildDFG, buildDFGFromSequences } from '../src/index';
import type { DFGResult, SequenceData } from '../src/index';

const SEQ: SequenceData = [
  ['A', 'B', 'C'],
  ['A', 'C'],
  ['B', 'A', 'C'],
  ['A', 'B', 'A', 'C'],
  ['B', 'C'],
];

describe('buildDFGFromSequences', () => {
  it('returns correct node and edge counts', () => {
    const dfg = buildDFGFromSequences(SEQ) as DFGResult;
    expect(dfg.totalSequences).toBe(5);
    expect(dfg.nodes).toHaveLength(3);

    const nodeA = dfg.nodes.find(n => n.id === 'A')!;
    expect(nodeA.absoluteFreq).toBe(5);
    expect(nodeA.caseFreq).toBeCloseTo(4 / 5);

    const ab = dfg.edges.find(e => e.from === 'A' && e.to === 'B')!;
    expect(ab.absoluteCount).toBe(2);

    const ac = dfg.edges.find(e => e.from === 'A' && e.to === 'C')!;
    expect(ac.absoluteCount).toBe(3);
  });

  it('relative counts sum to 1', () => {
    const dfg = buildDFGFromSequences(SEQ) as DFGResult;
    const sum = dfg.edges.reduce((s, e) => s + e.relativeCount, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('identifies sentinel nodes', () => {
    const seqs: SequenceData = [['Start', 'A', 'End'], ['Start', 'B', 'End']];
    const dfg = buildDFGFromSequences(seqs, undefined, 'Start', 'End') as DFGResult;
    expect(dfg.nodes.find(n => n.id === 'Start')!.type).toBe('start');
    expect(dfg.nodes.find(n => n.id === 'End')!.type).toBe('end');
  });

  it('handles self-loops', () => {
    const seqs: SequenceData = [['A', 'A', 'B']];
    const dfg = buildDFGFromSequences(seqs) as DFGResult;
    const aa = dfg.edges.find(e => e.from === 'A' && e.to === 'A');
    expect(aa).toBeDefined();
    expect(aa!.absoluteCount).toBe(1);
  });

  it('skips null values', () => {
    const seqs: SequenceData = [['A', null, 'B'], ['A', 'B']];
    const dfg = buildDFGFromSequences(seqs) as DFGResult;
    const ab = dfg.edges.find(e => e.from === 'A' && e.to === 'B');
    expect(ab!.absoluteCount).toBe(1);
  });
});

describe('buildDFG from model', () => {
  it('works with ftna model', () => {
    const model = ftna(SEQ);
    const dfg = buildDFG(model) as DFGResult;
    expect(dfg.totalSequences).toBe(5);
    expect(dfg.nodes.length).toBeGreaterThan(0);
  });

  it('matches direct sequence computation', () => {
    const model = ftna(SEQ);
    const dfgModel = buildDFG(model) as DFGResult;
    const dfgDirect = buildDFGFromSequences(SEQ) as DFGResult;
    for (const e1 of dfgModel.edges) {
      const e2 = dfgDirect.edges.find(e => e.from === e1.from && e.to === e1.to);
      expect(e2).toBeDefined();
      expect(e1.absoluteCount).toBe(e2!.absoluteCount);
    }
  });
});

describe('buildDFG from GroupTNA', () => {
  it('returns per-group results', () => {
    const seqs: SequenceData = [['A', 'B'], ['A', 'C'], ['B', 'C']];
    const gm = groupTna(seqs, ['g1', 'g1', 'g2']);
    const result = buildDFG(gm) as Record<string, DFGResult>;
    expect(Object.keys(result)).toContain('g1');
    expect(Object.keys(result)).toContain('g2');
  });
});
