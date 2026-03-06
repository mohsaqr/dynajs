/**
 * Transition computation algorithms.
 * Supports 4 model types: relative, frequency, co-occurrence, attention.
 */
import { Matrix, rowNormalize } from '../core/matrix.js';
import type { ModelType, SequenceData, TransitionParams } from '../core/types.js';

/** Check if a value is null/undefined/empty. */
function isNA(val: string | null | undefined): boolean {
  return val === null || val === undefined || val === '';
}

/** Get list of (position, state) for non-NA values in a sequence row. */
function getValidTransitions(row: (string | null)[]): { pos: number; state: string }[] {
  const result: { pos: number; state: string }[] = [];
  for (let i = 0; i < row.length; i++) {
    const val = row[i];
    if (!isNA(val)) {
      result.push({ pos: i, state: val! });
    }
  }
  return result;
}

/**
 * Compute transition matrix and initial probabilities from sequence data.
 */
export function computeTransitions(
  data: SequenceData,
  states: string[],
  type: ModelType = 'relative',
  params?: TransitionParams,
): { weights: Matrix; inits: Float64Array } {
  const nStates = states.length;
  const stateToIdx = new Map<string, number>();
  states.forEach((s, i) => stateToIdx.set(s, i));

  switch (type) {
    case 'relative':
      return transitionsRelative(data, stateToIdx, nStates);
    case 'frequency':
      return transitionsFrequency(data, stateToIdx, nStates);
    case 'co-occurrence':
      return transitionsCooccurrence(data, stateToIdx, nStates);
    case 'attention':
      return transitionsAttention(data, stateToIdx, nStates, params?.beta ?? 0.1);
    default:
      throw new Error(`Unknown transition type: ${type}`);
  }
}

function transitionsRelative(
  data: SequenceData,
  stateToIdx: Map<string, number>,
  nStates: number,
): { weights: Matrix; inits: Float64Array } {
  const counts = Matrix.zeros(nStates, nStates);
  const inits = new Float64Array(nStates);

  for (const row of data) {
    const valid = getValidTransitions(row);
    if (valid.length === 0) continue;

    const firstIdx = stateToIdx.get(valid[0]!.state);
    if (firstIdx !== undefined) inits[firstIdx]!++;

    for (let i = 0; i < valid.length - 1; i++) {
      const fromIdx = stateToIdx.get(valid[i]!.state);
      const toIdx = stateToIdx.get(valid[i + 1]!.state);
      if (fromIdx !== undefined && toIdx !== undefined) {
        counts.set(fromIdx, toIdx, counts.get(fromIdx, toIdx) + 1);
      }
    }
  }

  const weights = rowNormalize(counts);
  const initSum = inits.reduce((a, b) => a + b, 0);
  if (initSum > 0) {
    for (let i = 0; i < inits.length; i++) inits[i]! /= initSum;
  }

  return { weights, inits };
}

function transitionsFrequency(
  data: SequenceData,
  stateToIdx: Map<string, number>,
  nStates: number,
): { weights: Matrix; inits: Float64Array } {
  const counts = Matrix.zeros(nStates, nStates);
  const inits = new Float64Array(nStates);

  for (const row of data) {
    const valid = getValidTransitions(row);
    if (valid.length === 0) continue;

    const firstIdx = stateToIdx.get(valid[0]!.state);
    if (firstIdx !== undefined) inits[firstIdx]!++;

    for (let i = 0; i < valid.length - 1; i++) {
      const fromIdx = stateToIdx.get(valid[i]!.state);
      const toIdx = stateToIdx.get(valid[i + 1]!.state);
      if (fromIdx !== undefined && toIdx !== undefined) {
        counts.set(fromIdx, toIdx, counts.get(fromIdx, toIdx) + 1);
      }
    }
  }

  const initSum = inits.reduce((a, b) => a + b, 0);
  if (initSum > 0) {
    for (let i = 0; i < inits.length; i++) inits[i]! /= initSum;
  }

  return { weights: counts, inits };
}

function transitionsCooccurrence(
  data: SequenceData,
  stateToIdx: Map<string, number>,
  nStates: number,
): { weights: Matrix; inits: Float64Array } {
  const counts = Matrix.zeros(nStates, nStates);
  const inits = new Float64Array(nStates);

  for (const row of data) {
    const valid = getValidTransitions(row);
    if (valid.length === 0) continue;

    const firstIdx = stateToIdx.get(valid[0]!.state);
    if (firstIdx !== undefined) inits[firstIdx]!++;

    for (let i = 0; i < valid.length - 1; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const idx1 = stateToIdx.get(valid[i]!.state);
        const idx2 = stateToIdx.get(valid[j]!.state);
        if (idx1 !== undefined && idx2 !== undefined) {
          counts.set(idx1, idx2, counts.get(idx1, idx2) + 1);
          if (idx1 !== idx2) {
            counts.set(idx2, idx1, counts.get(idx2, idx1) + 1);
          }
        }
      }
    }
  }

  const initSum = inits.reduce((a, b) => a + b, 0);
  if (initSum > 0) {
    for (let i = 0; i < inits.length; i++) inits[i]! /= initSum;
  }

  return { weights: counts, inits };
}

function transitionsAttention(
  data: SequenceData,
  stateToIdx: Map<string, number>,
  nStates: number,
  beta: number,
): { weights: Matrix; inits: Float64Array } {
  const counts = Matrix.zeros(nStates, nStates);
  const inits = new Float64Array(nStates);

  for (const row of data) {
    const valid = getValidTransitions(row);
    if (valid.length === 0) continue;

    const firstIdx = stateToIdx.get(valid[0]!.state);
    if (firstIdx !== undefined) inits[firstIdx]!++;

    for (let i = 0; i < valid.length; i++) {
      const fromIdx = stateToIdx.get(valid[i]!.state);
      if (fromIdx === undefined) continue;
      for (let j = i + 1; j < valid.length; j++) {
        const toIdx = stateToIdx.get(valid[j]!.state);
        if (toIdx === undefined) continue;
        const distance = j - i;
        const weight = Math.exp(-beta * distance);
        counts.set(fromIdx, toIdx, counts.get(fromIdx, toIdx) + weight);
      }
    }
  }

  const initSum = inits.reduce((a, b) => a + b, 0);
  if (initSum > 0) {
    for (let i = 0; i < inits.length; i++) inits[i]! /= initSum;
  }

  return { weights: counts, inits };
}

/** Process an existing weight/count matrix. */
export function computeWeightsFromMatrix(
  mat: Matrix,
  type: ModelType = 'relative',
): Matrix {
  if (type === 'relative') return rowNormalize(mat);
  return mat.clone();
}
