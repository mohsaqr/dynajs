/**
 * Core type definitions for dynajs.
 */
import type { Matrix } from './matrix.js';

/** A sequence is a row of string tokens (states), possibly with null for missing. */
export type Sequence = (string | null)[];

/** A sequence dataset: array of sequences. */
export type SequenceData = Sequence[];

/**
 * TNA model type identifiers.
 * - 'relative': Row-normalized transition probabilities
 * - 'frequency': Raw transition counts
 * - 'co-occurrence': Bidirectional co-occurrence
 * - 'attention': Exponential decay weighted
 * - 'matrix': Direct matrix input
 */
export type ModelType =
  | 'relative'
  | 'frequency'
  | 'co-occurrence'
  | 'attention'
  | 'matrix';

/** Parameters for specific model types. */
export interface TransitionParams {
  /** Decay parameter for attention model. Default 0.1. */
  beta?: number;
}

/** Options for building a TNA model. */
export interface BuildModelOptions {
  type?: ModelType;
  scaling?: string | string[] | null;
  labels?: string[];
  beginState?: string;
  endState?: string;
  params?: TransitionParams;
}

/** TNA model. */
export interface TNA {
  /** Adjacency/transition matrix (n_states x n_states). */
  weights: Matrix;
  /** Initial state probabilities (n_states). */
  inits: Float64Array;
  /** State labels. */
  labels: string[];
  /** Original sequence data (if built from sequences). */
  data: SequenceData | null;
  /** Model type. */
  type: ModelType;
  /** Scaling methods applied. */
  scaling: string[];
  /** Transition parameters (e.g. beta for attention model). */
  params?: TransitionParams;
}

/** GroupTNA: mapping from group name to TNA model. */
export interface GroupTNA {
  models: Record<string, TNA>;
}

/** Centrality measure names. */
export type CentralityMeasure = 'InStrength' | 'OutStrength' | 'Closeness' | 'Betweenness';

/** Centrality result: map from state label to measure values. */
export interface CentralityResult {
  labels: string[];
  measures: Record<CentralityMeasure, Float64Array>;
  /** Optional group column for GroupTNA results. */
  groups?: string[];
}

/** Cluster result. */
export interface ClusterResult {
  data: SequenceData;
  k: number;
  assignments: number[];
  silhouette: number;
  sizes: number[];
  method: string;
  distance: Matrix;
  dissimilarity: string;
}

/** Prepared data container. */
export interface TNAData {
  sequenceData: SequenceData;
  labels: string[];
  statistics: {
    nSessions: number;
    nUniqueActions: number;
    uniqueActions: string[];
    maxSequenceLength: number;
    meanSequenceLength: number;
  };
}

// ── SNA types ────────────────────────────────────────────────────────

/** Community detection result. */
export interface CommunityResult {
  labels: string[];
  /** Community index (0-based) per node. */
  assignments: number[];
  /** Final modularity score. */
  modularity: number;
  /** Number of communities found. */
  nCommunities: number;
}

/** Layout algorithm names. */
export type LayoutAlgorithm = 'spring' | 'fr' | 'circle' | 'grid' | 'spectral' | 'kamada-kawai' | 'star' | 'hierarchical' | 'concentric' | 'random';

/** Force-directed layout result. */
export interface LayoutResult {
  x: Float64Array;
  y: Float64Array;
  labels: string[];
}

/** Degree distribution per node. */
export interface DegreeDistribution {
  /** Count of incoming edges per node (unweighted). */
  inDegree: Float64Array;
  /** Count of outgoing edges per node (unweighted). */
  outDegree: Float64Array;
  /** inDegree + outDegree. */
  totalDegree: Float64Array;
  labels: string[];
}
