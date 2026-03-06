/**
 * Data preparation functions.
 */
import type { SequenceData, TNAData } from '../core/types.js';

/**
 * Create sequence data from a 2D string array (wide format).
 * Extracts unique state labels and optionally adds begin/end states.
 */
export function createSeqdata(
  data: SequenceData,
  options?: {
    beginState?: string;
    endState?: string;
  },
): { data: SequenceData; labels: string[] } {
  const stateSet = new Set<string>();
  for (const row of data) {
    for (const val of row) {
      if (val !== null && val !== undefined && val !== '') {
        stateSet.add(val);
      }
    }
  }
  const labels = Array.from(stateSet).sort();

  if (options?.beginState && !labels.includes(options.beginState)) {
    labels.unshift(options.beginState);
  }
  if (options?.endState && !labels.includes(options.endState)) {
    labels.push(options.endState);
  }

  let result = data;

  if (options?.beginState) {
    result = result.map((row) => [options.beginState!, ...row]);
  }
  if (options?.endState) {
    result = result.map((row) => [...row, options.endState!]);
  }

  return { data: result, labels };
}

/**
 * Parse wide-format data into a TNAData object.
 */
export function prepareData(
  data: SequenceData,
  options?: {
    beginState?: string;
    endState?: string;
  },
): TNAData {
  const { data: seqData, labels } = createSeqdata(data, options);

  let totalLength = 0;
  let maxLen = 0;

  for (const row of seqData) {
    let rowLen = 0;
    for (const val of row) {
      if (val !== null && val !== undefined && val !== '') {
        rowLen++;
      }
    }
    totalLength += rowLen;
    if (rowLen > maxLen) maxLen = rowLen;
  }

  return {
    sequenceData: seqData,
    labels,
    statistics: {
      nSessions: seqData.length,
      nUniqueActions: labels.length,
      uniqueActions: labels,
      maxSequenceLength: maxLen,
      meanSequenceLength: seqData.length > 0 ? totalLength / seqData.length : 0,
    },
  };
}
