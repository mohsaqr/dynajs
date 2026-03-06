/** Single pattern entry in discovery results. */
export interface PatternEntry {
  pattern: string;
  length: number;
  frequency: number;
  proportion: number;
  count: number;
  support: number;
  lift: number;
  /** Per-group counts (keys are "count_<groupLabel>"). */
  groupCounts?: Record<string, number>;
  chisq?: number;
  pValue?: number;
}

/** Options for discoverPatterns. */
export interface DiscoverOptions {
  type?: 'ngram' | 'gapped' | 'repeated';
  pattern?: string;
  len?: number[];
  gap?: number[];
  minFreq?: number;
  minSupport?: number;
  start?: string[];
  end?: string[];
  contain?: string[];
  group?: string[] | null;
}

/** Result from discoverPatterns. */
export interface PatternResult {
  patterns: PatternEntry[];
  _raw: RawPatterns[];
}

/** Internal: raw pattern matrix from extraction. */
export interface RawPatterns {
  /** Count matrix [nSequences x nUniquePatterns]. */
  matrix: number[][];
  /** Unique pattern labels. */
  unique: string[];
  /** Pattern length. */
  length: number;
}
