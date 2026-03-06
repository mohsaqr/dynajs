/**
 * State frequency counts across sequences.
 */
import type { SequenceData } from '../core/types.js';

/**
 * Count the frequency of each state across all sequences.
 * Returns a sorted record of { state: count }.
 */
export function stateFrequencies(data: SequenceData): Record<string, number> {
  const counts = new Map<string, number>();

  for (const row of data) {
    for (const val of row) {
      if (val !== null && val !== undefined && val !== '') {
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
    }
  }

  // Sort by state name
  const sorted = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const result: Record<string, number> = {};
  for (const [state, count] of sorted) {
    result[state] = count;
  }

  return result;
}

/**
 * Count state frequencies per sequence (binary: present/absent).
 * Returns { state: number_of_sequences_containing_state }.
 */
export function statePresence(data: SequenceData): Record<string, number> {
  const counts = new Map<string, number>();

  for (const row of data) {
    const seen = new Set<string>();
    for (const val of row) {
      if (val !== null && val !== undefined && val !== '') {
        seen.add(val);
      }
    }
    for (const state of seen) {
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const result: Record<string, number> = {};
  for (const [state, count] of sorted) {
    result[state] = count;
  }

  return result;
}
