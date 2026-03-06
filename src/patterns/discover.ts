/**
 * Pattern discovery engine: n-grams, gapped, repeated, custom search.
 */
import type {
  PatternEntry,
  DiscoverOptions,
  PatternResult,
  RawPatterns,
} from './types.js';
import { prepareSequenceData } from './prepare.js';
import { chiSqUpperTail } from './stats.js';

// ── Extraction engines ────────────────────────────────────────────────

interface RawExtracted {
  patterns: string[][];
  length: number;
}

function extractNgrams(
  sequences: number[][],
  alphabet: string[],
  len: number[],
): RawExtracted[] {
  const n = sequences.length;
  const m = sequences[0]?.length ?? 0;
  const results: RawExtracted[] = [];

  for (const j of len) {
    if (j > m) {
      results.push({ patterns: Array.from({ length: n }, () => []), length: j });
      continue;
    }
    const cols = m - j + 1;
    const tmp: string[][] = Array.from({ length: n }, () =>
      new Array(cols).fill('') as string[],
    );

    for (let pos = 0; pos < cols; pos++) {
      for (let i = 0; i < n; i++) {
        const row = sequences[i]!;
        let valid = true;
        const parts: string[] = [];
        for (let d = 0; d < j; d++) {
          const v = row[pos + d]!;
          if (isNaN(v)) { valid = false; break; }
          parts.push(alphabet[v - 1]!);
        }
        if (valid) {
          tmp[i]![pos] = parts.join('->');
        }
      }
    }
    results.push({ patterns: tmp, length: j });
  }

  return results;
}

function extractGapped(
  sequences: number[][],
  alphabet: string[],
  gap: number[],
): RawExtracted[] {
  const n = sequences.length;
  const m = sequences[0]?.length ?? 0;
  const results: RawExtracted[] = [];

  for (const g of gap) {
    const cols = m - g;
    const tmp: string[][] = Array.from({ length: n }, () =>
      new Array(cols).fill('') as string[],
    );
    const wildcards = '*'.repeat(g);
    const sep = `->${wildcards}->`;

    for (let pos = 0; pos < m - g - 1; pos++) {
      for (let i = 0; i < n; i++) {
        const row = sequences[i]!;
        const from = row[pos]!;
        const to = row[pos + g + 1]!;
        if (!isNaN(from) && !isNaN(to)) {
          tmp[i]![pos] = `${alphabet[from - 1]!}${sep}${alphabet[to - 1]!}`;
        }
      }
    }
    results.push({ patterns: tmp, length: g + 2 });
  }

  return results;
}

function extractRepeated(
  sequences: number[][],
  alphabet: string[],
  len: number[],
): RawExtracted[] {
  const n = sequences.length;
  const m = sequences[0]?.length ?? 0;
  const results: RawExtracted[] = [];

  for (const j of len) {
    if (j > m) {
      results.push({ patterns: Array.from({ length: n }, () => []), length: j });
      continue;
    }
    const cols = m - j + 1;
    const tmp: string[][] = Array.from({ length: n }, () =>
      new Array(cols).fill('') as string[],
    );

    for (let pos = 0; pos < cols; pos++) {
      for (let i = 0; i < n; i++) {
        const row = sequences[i]!;
        let valid = true;
        let allSame = true;
        const first = row[pos]!;
        if (isNaN(first)) { continue; }
        const parts: string[] = [alphabet[first - 1]!];
        for (let d = 1; d < j; d++) {
          const v = row[pos + d]!;
          if (isNaN(v)) { valid = false; break; }
          if (v !== first) { allSame = false; break; }
          parts.push(alphabet[v - 1]!);
        }
        if (valid && allSame) {
          tmp[i]![pos] = parts.join('->');
        }
      }
    }
    results.push({ patterns: tmp, length: j });
  }

  return results;
}

function searchPattern(
  sequences: number[][],
  alphabet: string[],
  pattern: string,
): RawExtracted[] {
  const n = sequences.length;
  const m = sequences[0]?.length ?? 0;

  const states = pattern.split('->');
  const wildcards = states.map(s => /^\*+$/.test(s));
  let totalLen = states.length;
  const fixedPositions: number[] = [];
  const fixedStates: string[] = [];

  if (wildcards.some(w => w)) {
    let pos = 0;
    for (let i = 0; i < states.length; i++) {
      if (wildcards[i]) {
        pos += states[i]!.length;
      } else {
        fixedPositions.push(pos);
        fixedStates.push(states[i]!);
        pos++;
      }
    }
    totalLen = pos;
  } else {
    for (let i = 0; i < states.length; i++) {
      fixedPositions.push(i);
      fixedStates.push(states[i]!);
    }
  }

  if (totalLen > m) {
    return [{ patterns: Array.from({ length: n }, () => []), length: totalLen }];
  }

  const cols = m - totalLen + 1;
  const discovered: string[][] = Array.from({ length: n }, () =>
    new Array(cols).fill('') as string[],
  );

  for (let pos = 0; pos < cols; pos++) {
    for (let i = 0; i < n; i++) {
      const row = sequences[i]!;
      let anyNaN = false;
      for (let d = 0; d < totalLen; d++) {
        if (isNaN(row[pos + d]!)) { anyNaN = true; break; }
      }
      if (anyNaN) continue;

      let match = true;
      for (let f = 0; f < fixedPositions.length; f++) {
        if (alphabet[row[pos + fixedPositions[f]!]! - 1] !== fixedStates[f]) {
          match = false;
          break;
        }
      }
      if (match) {
        const parts: string[] = [];
        for (let d = 0; d < totalLen; d++) {
          parts.push(alphabet[row[pos + d]! - 1]!);
        }
        discovered[i]![pos] = parts.join('->');
      }
    }
  }

  return [{ patterns: discovered, length: totalLen }];
}

// ── Format + process ──────────────────────────────────────────────────

function formatPatterns(extracted: RawExtracted[]): RawPatterns[] {
  const results: RawPatterns[] = [];

  for (const item of extracted) {
    const patMat = item.patterns;
    const n = patMat.length;

    const allPats: string[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < patMat[i]!.length; j++) {
        const p = patMat[i]![j]!;
        if (p !== '') allPats.push(p);
      }
    }

    if (allPats.length === 0) {
      results.push({
        matrix: Array.from({ length: n }, () => []),
        unique: [],
        length: item.length,
      });
      continue;
    }

    const unique = [...new Set(allPats)];
    const patIdx = new Map<string, number>();
    for (let i = 0; i < unique.length; i++) {
      patIdx.set(unique[i]!, i);
    }

    const matrix: number[][] = Array.from({ length: n }, () =>
      new Array(unique.length).fill(0) as number[],
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < patMat[i]!.length; j++) {
        const p = patMat[i]![j]!;
        if (p !== '') {
          matrix[i]![patIdx.get(p)!]!++;
        }
      }
    }

    results.push({ matrix, unique, length: item.length });
  }

  return results;
}

function stateSupport(sequences: number[][], alphabet: string[]): Map<string, number> {
  const n = sequences.length;
  const m = sequences[0]?.length ?? 0;
  const a = alphabet.length;
  const support = new Map<string, number>();

  for (let s = 0; s < a; s++) {
    let count = 0;
    for (let i = 0; i < n; i++) {
      let found = false;
      for (let j = 0; j < m; j++) {
        if (sequences[i]![j] === s + 1) { found = true; break; }
      }
      if (found) count++;
    }
    support.set(alphabet[s]!, count / n);
  }

  return support;
}

function chisqTest(
  groupCounts: number[][],
  totalCounts: number[],
  nGroups: number,
): { statistic: number[]; pValue: number[] } {
  const nPatterns = groupCounts.length;
  const prob = 1.0 / nGroups;
  const statistic: number[] = new Array(nPatterns);
  const pValue: number[] = new Array(nPatterns);
  const df = nGroups - 1;

  for (let i = 0; i < nPatterns; i++) {
    let chi2 = 0;
    for (let g = 0; g < nGroups; g++) {
      const expected = totalCounts[i]! * prob;
      const diff = groupCounts[i]![g]! - expected;
      chi2 += (diff * diff) / expected;
    }
    statistic[i] = chi2;
    pValue[i] = chiSqUpperTail(chi2, df);
  }

  return { statistic, pValue };
}

function processPatterns(
  raw: RawPatterns[],
  n: number,
  group: string[] | null,
  stateSupp: Map<string, number>,
  minFreq: number,
  minSupport: number,
  start?: string[],
  end?: string[],
  contain?: string[],
): PatternEntry[] {
  const entries: PatternEntry[] = [];
  const hasGroup = group !== null && group.length > 0;

  let groups: string[] = [];
  const groupIndices = new Map<string, number[]>();
  if (hasGroup) {
    groups = [...new Set(group)];
    for (const g of groups) {
      const indices: number[] = [];
      for (let i = 0; i < group!.length; i++) {
        if (group![i] === g) indices.push(i);
      }
      groupIndices.set(g, indices);
    }
  }

  for (const r of raw) {
    if (r.unique.length === 0) continue;
    const mat = r.matrix;

    for (let p = 0; p < r.unique.length; p++) {
      let frequency = 0;
      let count = 0;
      for (let i = 0; i < n; i++) {
        const v = mat[i]![p]!;
        frequency += v;
        if (v > 0) count++;
      }

      const support = count / n;

      if (frequency < minFreq || support < minSupport) continue;

      const pattern = r.unique[p]!;

      if (start && start.length > 0) {
        if (!start.some(s => pattern.startsWith(s))) continue;
      }
      if (end && end.length > 0) {
        if (!end.some(s => pattern.endsWith(s))) continue;
      }
      if (contain && contain.length > 0) {
        const pat = contain.join('|');
        if (!new RegExp(pat).test(pattern)) continue;
      }

      const entry: PatternEntry = {
        pattern,
        length: r.length,
        frequency,
        proportion: 0,
        count,
        support,
        lift: 0,
      };

      const patStates = pattern.split('->').filter(s => !/^\*+$/.test(s));
      let denom = 1;
      for (const s of patStates) {
        denom *= stateSupp.get(s) ?? 1;
      }
      entry.lift = denom > 0 ? support / denom : 0;

      if (hasGroup) {
        const gc: Record<string, number> = {};
        const countsArr: number[] = [];
        for (const g of groups) {
          const indices = groupIndices.get(g)!;
          let gCount = 0;
          for (const idx of indices) {
            if (mat[idx]![p]! > 0) gCount++;
          }
          gc[`count_${g}`] = gCount;
          countsArr.push(gCount);
        }
        entry.groupCounts = gc;

        const chisqResult = chisqTest([countsArr], [count], groups.length);
        entry.chisq = chisqResult.statistic[0]!;
        entry.pValue = chisqResult.pValue[0]!;
      }

      entries.push(entry);
    }
  }

  entries.sort((a, b) => b.frequency - a.frequency);

  const lengthTotals = new Map<number, number>();
  for (const e of entries) {
    lengthTotals.set(e.length, (lengthTotals.get(e.length) ?? 0) + e.frequency);
  }
  for (const e of entries) {
    const total = lengthTotals.get(e.length) ?? 1;
    e.proportion = e.frequency / total;
  }

  return entries;
}

/**
 * Discover sequence patterns: n-grams, gapped, repeated, or custom search.
 */
export function discoverPatterns(
  data: (string | null | undefined)[][],
  options?: DiscoverOptions,
): PatternResult {
  const prepared = prepareSequenceData(data);
  const { sequences, alphabet } = prepared;
  const n = sequences.length;

  const type = options?.type ?? 'ngram';
  const len = options?.len ?? [2, 3, 4, 5];
  const gap = options?.gap ?? [1, 2, 3];
  const minFreq = options?.minFreq ?? 2;
  const minSupport = options?.minSupport ?? 0.01;
  const group = options?.group ?? null;

  let extracted: RawExtracted[];
  if (options?.pattern) {
    extracted = searchPattern(sequences, alphabet, options.pattern);
  } else if (type === 'ngram') {
    extracted = extractNgrams(sequences, alphabet, len);
  } else if (type === 'gapped') {
    extracted = extractGapped(sequences, alphabet, gap);
  } else {
    extracted = extractRepeated(sequences, alphabet, len);
  }

  const raw = formatPatterns(extracted);
  const stateSupp = stateSupport(sequences, alphabet);

  const patterns = processPatterns(
    raw, n, group, stateSupp,
    minFreq, minSupport,
    options?.start, options?.end, options?.contain,
  );

  return { patterns, _raw: raw };
}
