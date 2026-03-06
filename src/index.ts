// ── Core ──────────────────────────────────────────────────────────────
export { Matrix } from './core/matrix.js';
export { rowNormalize, minmaxScale, maxScale, rankScale, applyScaling } from './core/matrix.js';
export type {
  Sequence,
  SequenceData,
  ModelType,
  TransitionParams,
  BuildModelOptions,
  TNA,
  GroupTNA,
  CentralityMeasure,
  CentralityResult,
  ClusterResult,
  TNAData,
} from './core/types.js';

// ── Model ─────────────────────────────────────────────────────────────
export { createTNA, buildModel, tna, ftna, ctna, atna, summary } from './model/model.js';
export { createSeqdata, prepareData } from './model/prepare.js';
export { computeTransitions, computeWeightsFromMatrix } from './model/transitions.js';
export {
  isGroupTNA,
  createGroupTNA,
  groupNames,
  groupEntries,
  groupApply,
  renameGroups,
  groupTna,
  groupFtna,
  groupCtna,
  groupAtna,
} from './model/group.js';

// ── Analysis ──────────────────────────────────────────────────────────
export { centralities, AVAILABLE_MEASURES } from './analysis/centralities.js';
export { prune } from './analysis/prune.js';
export { clusterData } from './analysis/cluster.js';
export { stateFrequencies, statePresence } from './analysis/frequencies.js';

// ── Patterns ──────────────────────────────────────────────────────────
export { discoverPatterns } from './patterns/discover.js';
export type {
  PatternEntry,
  DiscoverOptions,
  PatternResult,
  RawPatterns,
} from './patterns/types.js';
