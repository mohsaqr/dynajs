/**
 * Prepare sequence data for pattern discovery: integer-coded matrix + alphabet.
 */

/** Prepared sequence data: integer-coded matrix + alphabet mapping. */
export interface PreparedSequenceData {
  /** Integer-coded sequences (1-based into alphabet, NaN for missing). */
  sequences: number[][];
  /** Sorted unique non-null states. */
  alphabet: string[];
}

/**
 * Prepare sequence data: extract sorted unique alphabet and
 * convert each cell to 1-based integer index (NaN for missing).
 */
export function prepareSequenceData(data: (string | null | undefined)[][]): PreparedSequenceData {
  const stateSet = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;
    for (let j = 0; j < row.length; j++) {
      const v = row[j];
      if (v != null && v !== '') {
        stateSet.add(v);
      }
    }
  }
  const alphabet = [...stateSet].sort();
  const stateToIndex = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) {
    stateToIndex.set(alphabet[i]!, i + 1);
  }

  const sequences: number[][] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;
    const coded: number[] = new Array(row.length);
    for (let j = 0; j < row.length; j++) {
      const v = row[j];
      if (v != null && v !== '') {
        coded[j] = stateToIndex.get(v)!;
      } else {
        coded[j] = NaN;
      }
    }
    sequences.push(coded);
  }

  return { sequences, alphabet };
}
