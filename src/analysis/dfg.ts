/**
 * Directly-Follows Graph (DFG) — process map computation.
 *
 * Builds a process-mining-style DFG from a TNA model or raw sequences.
 * Three metric modes: absolute counts, relative proportions, case-based fractions.
 */
import type { TNA, GroupTNA, SequenceData } from '../core/types.js';
import { isGroupTNA, groupEntries } from '../model/group.js';

// ═══════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════

export type DFGMetric = 'absolute' | 'relative' | 'case';

export interface DFGNode {
  id: string;
  type: 'activity' | 'start' | 'end';
  absoluteFreq: number;
  relativeFreq: number;
  caseFreq: number;
}

export interface DFGEdge {
  from: string;
  to: string;
  absoluteCount: number;
  relativeCount: number;
  caseCount: number;
}

export interface DFGResult {
  nodes: DFGNode[];
  edges: DFGEdge[];
  totalSequences: number;
  totalTransitions: number;
}

export interface DFGOptions {
  startLabel?: string;
  endLabel?: string;
}

// ═══════════════════════════════════════════════════════════
//  Implementation
// ═══════════════════════════════════════════════════════════

/**
 * Build a directly-follows graph from a TNA model.
 * Uses model.data (sequences) when available; falls back to weight matrix.
 */
export function buildDFG(
  model: TNA | GroupTNA,
  options?: DFGOptions,
): DFGResult | Record<string, DFGResult> {
  if (isGroupTNA(model)) {
    const result: Record<string, DFGResult> = {};
    for (const [name, m] of groupEntries(model)) {
      result[name] = buildDFG(m, options) as DFGResult;
    }
    return result;
  }

  const tna = model as TNA;
  if (tna.data && tna.data.length > 0) {
    return buildDFGFromSequences(tna.data, tna.labels, options?.startLabel, options?.endLabel);
  }

  // Matrix fallback
  const n = tna.labels.length;
  const w = tna.weights;
  let totalWeight = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) totalWeight += w.get(i, j);

  const rowSums = w.rowSums();
  const colSums = w.colSums();
  const totalNode = [...rowSums].reduce((a, b) => a + b, 0);

  const nodes: DFGNode[] = tna.labels.map((id, i) => ({
    id,
    type: id === options?.startLabel ? 'start' : id === options?.endLabel ? 'end' : 'activity',
    absoluteFreq: Math.round(rowSums[i]! + colSums[i]!),
    relativeFreq: totalNode > 0 ? (rowSums[i]! + colSums[i]!) / (2 * totalNode) : 0,
    caseFreq: 0,
  }));

  const edges: DFGEdge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = w.get(i, j);
      if (v > 0) edges.push({
        from: tna.labels[i]!, to: tna.labels[j]!,
        absoluteCount: Math.round(v), relativeCount: totalWeight > 0 ? v / totalWeight : 0, caseCount: 0,
      });
    }
  }

  return { nodes, edges, totalSequences: 0, totalTransitions: Math.round(totalWeight) };
}

/**
 * Build a DFG directly from raw sequence data.
 */
export function buildDFGFromSequences(
  sequences: SequenceData,
  labels?: string[],
  startLabel?: string,
  endLabel?: string,
): DFGResult {
  const totalSeq = sequences.length;

  const absFreq = new Map<string, number>();
  const casePresence = new Map<string, number>();
  for (const seq of sequences) {
    const seen = new Set<string>();
    for (const s of seq) {
      if (s === null) continue;
      absFreq.set(s, (absFreq.get(s) ?? 0) + 1);
      seen.add(s);
    }
    for (const s of seen) casePresence.set(s, (casePresence.get(s) ?? 0) + 1);
  }
  const totalOcc = [...absFreq.values()].reduce((a, b) => a + b, 0);

  const transMap = new Map<string, number>();
  const caseTrans = new Map<string, number>();
  let totalTrans = 0;
  for (const seq of sequences) {
    const seenT = new Set<string>();
    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i], to = seq[i + 1];
      if (from === null || to === null) continue;
      const key = `${from}\x00${to}`;
      transMap.set(key, (transMap.get(key) ?? 0) + 1);
      totalTrans++;
      seenT.add(key);
    }
    for (const k of seenT) caseTrans.set(k, (caseTrans.get(k) ?? 0) + 1);
  }

  const allLabels = labels ?? [...absFreq.keys()].sort();

  const nodes: DFGNode[] = allLabels
    .filter(id => absFreq.has(id))
    .map(id => ({
      id,
      type: id === startLabel ? 'start' : id === endLabel ? 'end' : 'activity',
      absoluteFreq: absFreq.get(id)!,
      relativeFreq: totalOcc > 0 ? absFreq.get(id)! / totalOcc : 0,
      caseFreq: totalSeq > 0 ? (casePresence.get(id) ?? 0) / totalSeq : 0,
    }));

  const edges: DFGEdge[] = [];
  for (const [key, count] of transMap) {
    const sep = key.indexOf('\x00');
    edges.push({
      from: key.slice(0, sep), to: key.slice(sep + 1),
      absoluteCount: count,
      relativeCount: totalTrans > 0 ? count / totalTrans : 0,
      caseCount: totalSeq > 0 ? (caseTrans.get(key) ?? 0) / totalSeq : 0,
    });
  }

  return { nodes, edges, totalSequences: totalSeq, totalTransitions: totalTrans };
}
