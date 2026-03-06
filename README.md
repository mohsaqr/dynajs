# dynajs

A lightweight, zero-dependency JavaScript/TypeScript library for **Transition Network Analysis (TNA)** and **Sequential Pattern Discovery**. Extracted from the full-featured [tnaj](https://github.com/mohsaqr/tna-js) and [codynaj](https://github.com/mohsaqr/codynaj) packages, dynajs provides only the core analysis essentials in a small, self-contained bundle (~46 KB minified).

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Concepts](#concepts)
  - [What is TNA?](#what-is-tna)
  - [Sequence Data Format](#sequence-data-format)
- [API Reference](#api-reference)
  - [Data Preparation](#data-preparation)
    - [`prepareData()`](#preparedatadata-options)
    - [`createSeqdata()`](#createseqdatadata-options)
  - [Model Building](#model-building)
    - [`tna()`](#tnax-options)
    - [`ftna()`](#ftnax-options)
    - [`ctna()`](#ctnax-options)
    - [`atna()`](#atnax-options)
    - [`buildModel()`](#buildmodelx-options)
    - [`summary()`](#summarymodel)
  - [Group Models](#group-models)
    - [`groupTna()`](#grouptna-groupftna-groupctna-groupatna)
    - [Group Utilities](#group-utilities)
  - [Centrality Analysis](#centrality-analysis)
    - [`centralities()`](#centralitiesmodel-options)
  - [Pruning](#pruning)
    - [`prune()`](#prunemodel-threshold)
  - [Clustering](#clustering)
    - [`clusterData()`](#clusterdatadata-k-options)
  - [State Frequencies](#state-frequencies)
    - [`stateFrequencies()`](#statefrequenciesdata)
    - [`statePresence()`](#statepresencedata)
  - [Pattern Discovery](#pattern-discovery)
    - [`discoverPatterns()`](#discoverpatternsdata-options)
  - [Matrix Utilities](#matrix-utilities)
    - [Matrix Class](#matrix-class)
    - [Scaling Functions](#scaling-functions)
- [Type Reference](#type-reference)
- [Examples](#examples)
  - [Complete Analysis Pipeline](#complete-analysis-pipeline)
  - [Comparing Groups](#comparing-groups)
  - [Pattern Discovery with Groups](#pattern-discovery-with-groups)
- [When to Use dynajs vs tnaj](#when-to-use-dynajs-vs-tnaj)
- [License](#license)

---

## Installation

```bash
npm install dynajs
```

Or install directly from GitHub:

```bash
npm install github:mohsaqr/dynajs
```

dynajs has **zero runtime dependencies**. It ships ESM, CJS, and TypeScript declarations.

---

## Quick Start

```typescript
import { tna, centralities, prune, summary, discoverPatterns } from 'dynajs';

// Your sequence data: rows = sessions/learners, columns = time steps
const sequences = [
  ['Reading', 'Video',   'Quiz',    'Reading', 'Forum'],
  ['Video',   'Reading', 'Forum',   'Quiz',    'Video'],
  ['Reading', 'Reading', 'Video',   'Quiz',    'Reading'],
  ['Forum',   'Video',   'Reading', 'Quiz',    'Forum'],
  ['Reading', 'Video',   'Reading', 'Video',   'Quiz'],
];

// 1. Build a transition network
const model = tna(sequences);
console.log(summary(model));
// { nStates: 4, type: 'relative', nEdges: 12, density: 0.75, ... }

// 2. Compute centralities
const cent = centralities(model);
console.log(cent.labels);           // ['Forum', 'Quiz', 'Reading', 'Video']
console.log(cent.measures.InStrength);    // Float64Array of incoming weights
console.log(cent.measures.Betweenness);   // Float64Array of betweenness scores

// 3. Prune weak edges
const pruned = prune(model, 0.15);

// 4. Discover sequential patterns
const patterns = discoverPatterns(sequences, { len: [2, 3] });
patterns.patterns.forEach(p =>
  console.log(`${p.pattern}: freq=${p.frequency}, support=${p.support.toFixed(2)}`)
);
```

---

## Concepts

### What is TNA?

**Transition Network Analysis** models sequential behavior as a directed weighted graph. Each unique state (e.g., a learning activity like "Reading", "Video", "Quiz") becomes a node. Edges represent transitions between states, weighted by how often or how strongly the transition occurs.

TNA answers questions like:
- Which activities do learners transition to most often?
- Which states are most central in the behavioral network?
- Are there distinct groups of learners with different behavioral patterns?
- What sequential patterns appear frequently?

### Sequence Data Format

dynajs uses **wide-format** sequence data: a 2D array where each row is one sequence (e.g., one learner's session) and each column is a time step.

```typescript
type SequenceData = (string | null)[][];

// Example: 3 learners, 5 time steps each
const data: SequenceData = [
  ['A', 'B', 'C', 'A', 'B'],     // Learner 1
  ['B', 'C', null, 'A', 'C'],    // Learner 2 (null = missing at step 3)
  ['A', 'A', 'B', 'C', 'A'],     // Learner 3
];
```

- **Rows**: Individual sequences (learners, sessions, users, etc.)
- **Columns**: Time-ordered steps within each sequence
- **Values**: String state labels. Use `null` or `''` for missing values.
- **States are auto-detected**: All unique non-null values become the state labels, sorted alphabetically.

---

## API Reference

### Data Preparation

#### `prepareData(data, options?)`

Parse raw sequence data into a structured `TNAData` object with computed statistics. Useful for inspecting your data before building models.

```typescript
import { prepareData } from 'dynajs';

const data = prepareData(sequences);

console.log(data.labels);
// ['Forum', 'Quiz', 'Reading', 'Video']

console.log(data.statistics);
// {
//   nSessions: 5,
//   nUniqueActions: 4,
//   uniqueActions: ['Forum', 'Quiz', 'Reading', 'Video'],
//   maxSequenceLength: 5,
//   meanSequenceLength: 5,
// }

// data.sequenceData contains the (possibly modified) sequences
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `SequenceData` | 2D string array of sequences |
| `options.beginState` | `string?` | Prepend this state to every sequence |
| `options.endState` | `string?` | Append this state to every sequence |

**Returns:** `TNAData` — object with `sequenceData`, `labels`, and `statistics`.

Begin/end states are useful when you want to model session start/end explicitly:

```typescript
const data = prepareData(sequences, {
  beginState: 'START',
  endState: 'END',
});
// data.labels: ['START', 'Forum', 'Quiz', 'Reading', 'Video', 'END']
```

---

#### `createSeqdata(data, options?)`

Lower-level function that extracts labels and optionally adds begin/end states, without computing statistics.

```typescript
import { createSeqdata } from 'dynajs';

const { data: processed, labels } = createSeqdata(sequences, {
  beginState: 'START',
});
// labels: ['START', 'Forum', 'Quiz', 'Reading', 'Video']
// processed: sequences with 'START' prepended to each row
```

---

### Model Building

dynajs provides four model-building functions, each computing transitions differently. All accept three input types:

1. **`SequenceData`** — 2D string array (most common)
2. **`TNAData`** — output of `prepareData()`
3. **`number[][]`** — a pre-computed square weight matrix

#### `tna(x, options?)`

Build a **relative transition probability** model. Each row of the weight matrix sums to 1, representing the probability of transitioning from one state to another.

```typescript
import { tna } from 'dynajs';

const model = tna(sequences);

// model.weights — Matrix (n_states x n_states), rows sum to 1
// model.inits   — Float64Array of initial state probabilities
// model.labels  — ['Forum', 'Quiz', 'Reading', 'Video']
// model.type    — 'relative'
// model.data    — the processed sequence data
// model.scaling — [] (no scaling applied)

// Access individual transition probabilities:
const readingIdx = model.labels.indexOf('Reading');
const videoIdx = model.labels.indexOf('Video');
const prob = model.weights.get(readingIdx, videoIdx);
console.log(`P(Reading → Video) = ${prob.toFixed(3)}`);

// View full matrix:
console.log(model.weights.to2D());
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scaling` | `string \| string[] \| null` | `null` | Scaling to apply: `'minmax'`, `'max'`, `'rank'`, or array for chaining |
| `labels` | `string[]?` | auto-detected | Override state labels |
| `beginState` | `string?` | none | Prepend this state to each sequence |
| `endState` | `string?` | none | Append this state to each sequence |

```typescript
// With scaling
const scaled = tna(sequences, { scaling: 'minmax' });
// All weights now in [0, 1] range

// Chain multiple scalings
const ranked = tna(sequences, { scaling: ['rank', 'minmax'] });
```

---

#### `ftna(x, options?)`

Build a **frequency (count)** model. Weights are raw transition counts (not normalized).

```typescript
import { ftna } from 'dynajs';

const model = ftna(sequences);
// model.type === 'frequency'
// model.weights contains integer counts: how many times each transition occurred
```

Useful when you need absolute counts rather than probabilities, or when comparing groups of different sizes where raw counts are more interpretable.

---

#### `ctna(x, options?)`

Build a **co-occurrence** model. Counts all pairs of states that appear in the same sequence (not just adjacent transitions). The resulting matrix is symmetric.

```typescript
import { ctna } from 'dynajs';

const model = ctna(sequences);
// model.type === 'co-occurrence'
// model.weights is symmetric: weights[i][j] === weights[j][i]
```

Co-occurrence captures broader relationships: two states are connected even if they are far apart in the sequence. Useful for understanding which activities tend to appear together, regardless of order.

---

#### `atna(x, options?)`

Build an **attention-weighted** model. Like co-occurrence, but distant pairs receive exponentially less weight via a decay parameter `beta`.

```typescript
import { atna } from 'dynajs';

// Default beta = 0.1 (slow decay, distant pairs still count)
const model = atna(sequences);

// Higher beta = faster decay (focus on nearby transitions)
const focused = atna(sequences, { beta: 0.5 });

// model.params.beta — the beta value used
```

**Additional option:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `beta` | `number` | `0.1` | Decay rate. Higher = more weight on nearby transitions |

The weight between states at distance `d` is `exp(-beta * d)`. With `beta = 0.1`, a pair 10 steps apart receives weight `exp(-1) ≈ 0.37`. With `beta = 0.5`, the same pair gets `exp(-5) ≈ 0.007`.

---

#### `buildModel(x, options?)`

Generic model builder — use this when the model type is determined at runtime.

```typescript
import { buildModel } from 'dynajs';

const type = getUserSelection(); // 'relative' | 'frequency' | 'co-occurrence' | 'attention'
const model = buildModel(sequences, { type });

// Also accepts a pre-computed weight matrix:
const matrix = [
  [0.0, 0.4, 0.6],
  [0.3, 0.0, 0.7],
  [0.5, 0.5, 0.0],
];
const fromMatrix = buildModel(matrix, {
  labels: ['Reading', 'Video', 'Quiz'],
});
```

**Full options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `ModelType` | `'relative'` | `'relative'`, `'frequency'`, `'co-occurrence'`, `'attention'`, or `'matrix'` |
| `scaling` | `string \| string[] \| null` | `null` | Scaling method(s) |
| `labels` | `string[]?` | auto-detected | State labels |
| `beginState` | `string?` | none | Prepend state |
| `endState` | `string?` | none | Append state |
| `params` | `TransitionParams?` | none | Extra params (e.g. `{ beta: 0.5 }` for attention) |

---

#### `summary(model)`

Get a summary of model properties.

```typescript
import { tna, summary } from 'dynajs';

const model = tna(sequences);
const s = summary(model);

console.log(s);
// {
//   nStates: 4,           — number of states
//   type: 'relative',     — model type
//   scaling: [],           — applied scalings
//   nEdges: 12,           — edges with weight > 0
//   density: 0.75,        — nEdges / nStates^2
//   meanWeight: 0.267,    — mean of non-zero weights
//   maxWeight: 0.5,       — maximum weight
//   hasSelfLoops: true,   — any diagonal > 0?
// }
```

---

### Group Models

Build separate TNA models for each group in your data (e.g., high vs. low performers, different courses, experimental conditions).

#### `groupTna()`, `groupFtna()`, `groupCtna()`, `groupAtna()`

```typescript
import { groupTna, groupFtna, groupCtna, groupAtna } from 'dynajs';

// groups array must have same length as sequences
const groups = ['High', 'High', 'Low', 'Low', 'High'];

// Each function matches its single-model counterpart
const gRelative     = groupTna(sequences, groups);
const gFrequency    = groupFtna(sequences, groups);
const gCooccurrence = groupCtna(sequences, groups);
const gAttention    = groupAtna(sequences, groups, { beta: 0.3 });

// Access individual group models:
const highModel = gRelative.models['High'];
const lowModel  = gRelative.models['Low'];
console.log(highModel.weights.to2D());
console.log(lowModel.weights.to2D());
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `SequenceData` | Sequence data for all groups |
| `groups` | `string[]` | Group label per sequence (same length as data) |
| `options` | same as `tna()`/etc. | Scaling, labels, begin/end states |

**Important:** All groups share the same state labels (union of all states across all groups). This ensures matrices are comparable.

---

#### Group Utilities

```typescript
import {
  isGroupTNA,
  groupNames,
  groupEntries,
  groupApply,
  renameGroups,
  createGroupTNA,
} from 'dynajs';

const g = groupTna(sequences, groups);

// Check type
isGroupTNA(g);            // true
isGroupTNA(tna(sequences)); // false

// List group names
groupNames(g);            // ['High', 'Low']

// Iterate as [name, model] pairs
for (const [name, model] of groupEntries(g)) {
  console.log(`${name}: ${model.labels.length} states`);
}

// Apply a function to each group
const densities = groupApply(g, (model) => {
  const s = summary(model);
  return s.density;
});
// { High: 0.75, Low: 0.6875 }

// Rename groups
const renamed = renameGroups(g, ['Cluster A', 'Cluster B']);
groupNames(renamed); // ['Cluster A', 'Cluster B']

// Create from existing models
const custom = createGroupTNA({
  'Group 1': tna(data1),
  'Group 2': tna(data2),
});
```

---

### Centrality Analysis

#### `centralities(model, options?)`

Compute node centrality measures for a TNA model. Two measures are available:

- **InStrength**: Sum of incoming edge weights. Identifies states that are frequently transitioned *to*.
- **Betweenness**: Number of shortest paths passing through a node (Brandes' algorithm with 1/weight as distance). Identifies bridge states that connect different parts of the network.

```typescript
import { tna, centralities } from 'dynajs';

const model = tna(sequences);
const result = centralities(model);

// result.labels     — ['Forum', 'Quiz', 'Reading', 'Video']
// result.measures   — { InStrength: Float64Array, Betweenness: Float64Array }

// Create a centrality table:
result.labels.forEach((label, i) => {
  console.log(
    `${label}: InStrength=${result.measures.InStrength[i].toFixed(3)}, ` +
    `Betweenness=${result.measures.Betweenness[i].toFixed(3)}`
  );
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `loops` | `boolean` | `false` | Include self-loops in calculations |
| `normalize` | `boolean` | `false` | Min-max normalize each measure to [0, 1] |
| `measures` | `CentralityMeasure[]` | `['InStrength', 'Betweenness']` | Which measures to compute |

```typescript
// Normalized centralities
const norm = centralities(model, { normalize: true });

// Only InStrength
const instrOnly = centralities(model, { measures: ['InStrength'] });

// Include self-loops
const withLoops = centralities(model, { loops: true });
```

**With GroupTNA:**

```typescript
const g = groupTna(sequences, groups);
const result = centralities(g);

// result.labels  — all labels stacked: ['Forum','Quiz','Reading','Video','Forum','Quiz','Reading','Video']
// result.groups  — group for each row: ['High','High','High','High','Low','Low','Low','Low']
// result.measures — stacked Float64Arrays
```

---

### Pruning

#### `prune(model, threshold?)`

Remove edges below a weight threshold. Returns a new model with weak edges set to zero.

```typescript
import { tna, prune } from 'dynajs';

const model = tna(sequences);

// Remove edges with weight < 0.15
const pruned = prune(model, 0.15);
// pruned.weights — same shape, but values < 0.15 are now 0

// Default threshold is 0.1
const defaultPruned = prune(model);
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `TNA \| GroupTNA` | required | Model to prune |
| `threshold` | `number` | `0.1` | Minimum edge weight to keep |

**With GroupTNA:**

```typescript
const g = groupTna(sequences, groups);
const pruned = prune(g, 0.2);
// Returns Record<string, TNA>: { 'High': TNA, 'Low': TNA }
```

---

### Clustering

#### `clusterData(data, k, options?)`

Cluster sequences into `k` groups based on sequence dissimilarity. Supports PAM (Partitioning Around Medoids) and hierarchical agglomerative clustering.

```typescript
import { clusterData } from 'dynajs';

const result = clusterData(sequences, 3);

console.log(result.assignments); // [1, 2, 1, 3, 2] — 1-indexed cluster labels
console.log(result.silhouette);  // 0.42 — clustering quality [-1, 1]
console.log(result.sizes);       // [2, 2, 1] — sequences per cluster
console.log(result.method);      // 'pam'
console.log(result.dissimilarity); // 'hamming'
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `SequenceData \| TNAData` | required | Sequence data |
| `k` | `number` | required | Number of clusters (must be >= 2) |
| `options.dissimilarity` | `string` | `'hamming'` | Distance metric: `'hamming'`, `'lv'`, `'osa'`, `'lcs'` |
| `options.method` | `string` | `'pam'` | Clustering method: `'pam'`, `'single'`, `'complete'`, `'average'` |
| `options.naSyms` | `string[]` | `['*', '%']` | Symbols treated as missing |
| `options.weighted` | `boolean` | `false` | Weighted Hamming (exponential position decay) |
| `options.lambda` | `number` | `1` | Decay rate for weighted Hamming |

**Distance metrics explained:**

| Metric | Description | Best for |
|--------|-------------|----------|
| `hamming` | Count of positions where sequences differ | Equal-length sequences, position matters |
| `lv` | Levenshtein (edit distance): insertions, deletions, substitutions | Variable-length sequences |
| `osa` | Optimal String Alignment: Levenshtein + transpositions | When swapped adjacent states are similar |
| `lcs` | Longest Common Subsequence distance | Flexible alignment, order matters |

**Clustering methods:**

| Method | Description |
|--------|-------------|
| `pam` | Partitioning Around Medoids — robust to outliers, medoids are actual data points |
| `single` | Hierarchical: minimum linkage — finds elongated clusters |
| `complete` | Hierarchical: maximum linkage — finds compact clusters |
| `average` | Hierarchical: UPGMA — balanced between single and complete |

```typescript
// Levenshtein distance + hierarchical average linkage
const result = clusterData(sequences, 3, {
  dissimilarity: 'lv',
  method: 'average',
});

// Use the cluster assignments to build group models
const clusterLabels = result.assignments.map(String);
const grouped = groupTna(sequences, clusterLabels);
```

**Return type: `ClusterResult`**

| Field | Type | Description |
|-------|------|-------------|
| `data` | `SequenceData` | Input sequence data |
| `k` | `number` | Number of clusters |
| `assignments` | `number[]` | 1-indexed cluster labels for each sequence |
| `silhouette` | `number` | Mean silhouette score [-1, 1] |
| `sizes` | `number[]` | Count of sequences in each cluster |
| `method` | `string` | Clustering method used |
| `distance` | `Matrix` | Full pairwise distance matrix |
| `dissimilarity` | `string` | Distance metric used |

---

### State Frequencies

#### `stateFrequencies(data)`

Count total occurrences of each state across all sequences.

```typescript
import { stateFrequencies } from 'dynajs';

const freq = stateFrequencies(sequences);
// { Forum: 4, Quiz: 5, Reading: 8, Video: 8 }
```

#### `statePresence(data)`

Count how many sequences contain each state (binary presence, not total count).

```typescript
import { statePresence } from 'dynajs';

const presence = statePresence(sequences);
// { Forum: 3, Quiz: 5, Reading: 5, Video: 5 }
// Forum appears in 3 out of 5 sequences
```

Both functions ignore `null` and empty string values.

---

### Pattern Discovery

#### `discoverPatterns(data, options?)`

Discover sequential patterns in your data: n-grams, gapped patterns, repeated patterns, or search for specific patterns. Includes support, lift, and optional group-level chi-squared tests.

```typescript
import { discoverPatterns } from 'dynajs';

const result = discoverPatterns(sequences, {
  type: 'ngram',
  len: [2, 3],
  minFreq: 2,
  minSupport: 0.1,
});

result.patterns.forEach(p => {
  console.log(`${p.pattern}`);
  console.log(`  length=${p.length}, freq=${p.frequency}, support=${p.support.toFixed(2)}`);
  console.log(`  proportion=${p.proportion.toFixed(3)}, lift=${p.lift.toFixed(2)}`);
});
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `(string \| null)[][]` | required | Sequence data |
| `options.type` | `string` | `'ngram'` | Pattern type: `'ngram'`, `'gapped'`, `'repeated'` |
| `options.pattern` | `string?` | none | Search for a specific pattern (overrides `type`) |
| `options.len` | `number[]` | `[2,3,4,5]` | N-gram / repeated pattern lengths |
| `options.gap` | `number[]` | `[1,2,3]` | Gap sizes for gapped patterns |
| `options.minFreq` | `number` | `2` | Minimum total frequency |
| `options.minSupport` | `number` | `0.01` | Minimum support (proportion of sequences) |
| `options.start` | `string[]?` | none | Only patterns starting with these states |
| `options.end` | `string[]?` | none | Only patterns ending with these states |
| `options.contain` | `string[]?` | none | Only patterns containing these states (regex) |
| `options.group` | `string[]?` | none | Group labels for chi-squared test |

**Pattern types:**

**N-grams** — Contiguous subsequences of length `n`:
```typescript
const result = discoverPatterns(sequences, {
  type: 'ngram',
  len: [2, 3, 4],
});
// Finds: "Reading->Video", "Video->Quiz", "Reading->Video->Quiz", etc.
```

**Gapped patterns** — Pairs of states separated by `g` wildcard positions:
```typescript
const result = discoverPatterns(sequences, {
  type: 'gapped',
  gap: [1, 2],
});
// Finds: "Reading->*->Quiz" (gap=1), "Video->**->Forum" (gap=2), etc.
```

**Repeated patterns** — Consecutive repetitions of the same state:
```typescript
const result = discoverPatterns(sequences, {
  type: 'repeated',
  len: [2, 3],
});
// Finds: "Reading->Reading", "Reading->Reading->Reading", etc.
```

**Pattern search** — Find a specific pattern, with optional wildcards:
```typescript
// Exact pattern
const exact = discoverPatterns(sequences, { pattern: 'Reading->Video->Quiz' });

// With wildcards
const gapped = discoverPatterns(sequences, { pattern: 'Reading->*->Quiz' });
```

**Filtering:**

```typescript
// Only patterns starting with "Reading"
const fromReading = discoverPatterns(sequences, {
  start: ['Reading'],
  len: [2, 3],
});

// Only patterns ending with "Quiz"
const toQuiz = discoverPatterns(sequences, {
  end: ['Quiz'],
  len: [2, 3],
});

// Only patterns containing "Video"
const withVideo = discoverPatterns(sequences, {
  contain: ['Video'],
  len: [2, 3],
});
```

**Group comparison with chi-squared:**

```typescript
const groups = ['High', 'High', 'Low', 'Low', 'High'];

const result = discoverPatterns(sequences, {
  group: groups,
  len: [2, 3],
});

result.patterns.forEach(p => {
  console.log(`${p.pattern}: chi2=${p.chisq?.toFixed(2)}, p=${p.pValue?.toFixed(4)}`);
  console.log(`  Group counts:`, p.groupCounts);
  // { count_High: 3, count_Low: 1 }
});
```

**Return type: `PatternResult`**

The `patterns` array contains `PatternEntry` objects, sorted by frequency (descending):

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | `string` | Pattern string, e.g. `"Reading->Video->Quiz"` |
| `length` | `number` | Number of positions in the pattern |
| `frequency` | `number` | Total occurrences across all sequences and positions |
| `proportion` | `number` | Frequency / total frequency within same length group |
| `count` | `number` | Number of sequences containing this pattern |
| `support` | `number` | Proportion of sequences containing the pattern (count / n) |
| `lift` | `number` | Support / product of individual state supports |
| `groupCounts` | `Record<string, number>?` | Per-group sequence counts (if `group` provided) |
| `chisq` | `number?` | Chi-squared statistic (if `group` provided) |
| `pValue` | `number?` | Chi-squared p-value (if `group` provided) |

---

### Matrix Utilities

#### Matrix Class

The `Matrix` class is a thin Float64Array wrapper with row-major layout. All model weights are Matrix objects.

```typescript
import { Matrix } from 'dynajs';

// Create from 2D array
const m = Matrix.from2D([
  [1, 2, 3],
  [4, 5, 6],
]);

// Create empty
const zeros = Matrix.zeros(3, 3);
const filled = Matrix.fill(3, 3, 0.5);

// Access
m.get(0, 1);         // 2
m.set(0, 1, 99);
m.rows;              // 2
m.cols;              // 3

// Operations
m.clone();           // deep copy
m.to2D();            // convert back to number[][]
m.transpose();       // new transposed matrix
m.scale(2);          // multiply all by scalar
m.map((v, i, j) => v * 2);  // element-wise transform

// Aggregations
m.sum();             // sum of all elements
m.rowSums();         // Float64Array of row sums
m.colSums();         // Float64Array of column sums
m.diag();            // Float64Array of diagonal elements
m.max();             // maximum element
m.min();             // minimum element
m.count(v => v > 0); // count matching elements
m.meanNonZero();     // mean of positive elements
m.flatten();         // Float64Array in row-major order

// Row/column access
m.row(0);            // Float64Array of first row
m.col(1);            // Float64Array of second column

// Properties
m.isSquare;          // boolean
```

#### Scaling Functions

Standalone scaling functions for matrices:

```typescript
import { rowNormalize, minmaxScale, maxScale, rankScale, applyScaling, Matrix } from 'dynajs';

const m = Matrix.from2D([[1, 2, 3], [4, 5, 6]]);

rowNormalize(m);   // Each row sums to 1
minmaxScale(m);    // Values in [0, 1]
maxScale(m);       // Divide by max value
rankScale(m);      // Replace with average ranks (zeros stay zero)

// Apply one or multiple scalings
const { weights, applied } = applyScaling(m, 'minmax');
const { weights: w2 } = applyScaling(m, ['rank', 'minmax']);
```

---

## Type Reference

```typescript
// Sequence types
type Sequence = (string | null)[];
type SequenceData = Sequence[];

// Model types
type ModelType = 'relative' | 'frequency' | 'co-occurrence' | 'attention' | 'matrix';

interface TransitionParams {
  beta?: number;                // Decay for attention model (default 0.1)
}

interface BuildModelOptions {
  type?: ModelType;
  scaling?: string | string[] | null;
  labels?: string[];
  beginState?: string;
  endState?: string;
  params?: TransitionParams;
}

interface TNA {
  weights: Matrix;              // n_states x n_states adjacency matrix
  inits: Float64Array;          // initial state probabilities
  labels: string[];             // state names
  data: SequenceData | null;    // original sequences (null for matrix input)
  type: ModelType;
  scaling: string[];
  params?: TransitionParams;
}

interface GroupTNA {
  models: Record<string, TNA>;
}

// Centrality types
type CentralityMeasure = 'InStrength' | 'Betweenness';

interface CentralityResult {
  labels: string[];
  measures: Record<CentralityMeasure, Float64Array>;
  groups?: string[];            // present for GroupTNA input
}

// Cluster types
interface ClusterResult {
  data: SequenceData;
  k: number;
  assignments: number[];        // 1-indexed
  silhouette: number;
  sizes: number[];
  method: string;
  distance: Matrix;
  dissimilarity: string;
}

// Data prep types
interface TNAData {
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

// Pattern types
interface PatternEntry {
  pattern: string;
  length: number;
  frequency: number;
  proportion: number;
  count: number;
  support: number;
  lift: number;
  groupCounts?: Record<string, number>;
  chisq?: number;
  pValue?: number;
}

interface DiscoverOptions {
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

interface PatternResult {
  patterns: PatternEntry[];
  _raw: RawPatterns[];
}
```

---

## Examples

### Complete Analysis Pipeline

```typescript
import {
  tna, ftna, centralities, prune, summary,
  clusterData, stateFrequencies, discoverPatterns,
} from 'dynajs';

// 1. Load your data (rows = learners, cols = time steps)
const sequences = [
  ['Reading', 'Video',   'Quiz',    'Reading', 'Forum'],
  ['Video',   'Reading', 'Forum',   'Quiz',    'Video'],
  ['Reading', 'Reading', 'Video',   'Quiz',    'Reading'],
  ['Forum',   'Video',   'Reading', 'Quiz',    'Forum'],
  ['Reading', 'Video',   'Reading', 'Video',   'Quiz'],
  ['Video',   'Forum',   'Reading', 'Video',   'Quiz'],
  ['Reading', 'Quiz',    'Video',   'Reading', 'Forum'],
  ['Forum',   'Reading', 'Video',   'Quiz',    'Reading'],
];

// 2. Build model and inspect
const model = tna(sequences);
console.log(summary(model));

// 3. State frequencies
const freq = stateFrequencies(sequences);
console.log('Frequencies:', freq);

// 4. Centralities
const cent = centralities(model, { normalize: true });
cent.labels.forEach((label, i) => {
  console.log(`${label}: InStr=${cent.measures.InStrength[i].toFixed(3)}, ` +
    `Betw=${cent.measures.Betweenness[i].toFixed(3)}`);
});

// 5. Prune weak edges
const pruned = prune(model, 0.15);
const prunedSummary = summary(pruned);
console.log(`Edges before: ${summary(model).nEdges}, after: ${prunedSummary.nEdges}`);

// 6. Cluster learners
const clusters = clusterData(sequences, 3, { dissimilarity: 'lv' });
console.log('Clusters:', clusters.assignments);
console.log('Silhouette:', clusters.silhouette.toFixed(3));

// 7. Discover patterns
const patterns = discoverPatterns(sequences, { len: [2, 3], minFreq: 3 });
patterns.patterns.slice(0, 10).forEach(p => {
  console.log(`${p.pattern}: freq=${p.frequency}, lift=${p.lift.toFixed(2)}`);
});
```

### Comparing Groups

```typescript
import { groupTna, centralities, prune, groupApply, summary } from 'dynajs';

const sequences = [
  ['Reading', 'Video', 'Quiz', 'Reading', 'Forum'],
  ['Reading', 'Quiz',  'Video', 'Quiz',   'Reading'],
  ['Video',   'Forum', 'Video', 'Forum',  'Video'],
  ['Forum',   'Video', 'Forum', 'Video',  'Forum'],
];

const performance = ['High', 'High', 'Low', 'Low'];

// Build group models
const grouped = groupTna(sequences, performance);

// Summary per group
const summaries = groupApply(grouped, (m) => summary(m));
console.log('High performers:', summaries['High']);
console.log('Low performers:', summaries['Low']);

// Centralities per group (stacked result)
const cent = centralities(grouped, { normalize: true });
cent.labels.forEach((label, i) => {
  console.log(`[${cent.groups![i]}] ${label}: InStr=${cent.measures.InStrength[i].toFixed(3)}`);
});

// Prune each group
const prunedGroups = prune(grouped, 0.2);
// prunedGroups is Record<string, TNA>
```

### Pattern Discovery with Groups

```typescript
import { discoverPatterns } from 'dynajs';

const sequences = [
  ['A', 'B', 'C', 'A', 'B'],
  ['A', 'B', 'A', 'B', 'C'],
  ['B', 'C', 'A', 'B', 'C'],
  ['C', 'A', 'B', 'C', 'A'],
  ['A', 'C', 'B', 'A', 'C'],
  ['C', 'B', 'A', 'C', 'B'],
];

const groups = ['X', 'X', 'X', 'Y', 'Y', 'Y'];

const result = discoverPatterns(sequences, {
  type: 'ngram',
  len: [2, 3],
  group: groups,
  minFreq: 2,
});

// Find patterns that differ significantly between groups
const significant = result.patterns.filter(p => p.pValue !== undefined && p.pValue < 0.05);
significant.forEach(p => {
  console.log(`${p.pattern}: p=${p.pValue!.toFixed(4)}`);
  console.log(`  X: ${p.groupCounts!['count_X']}, Y: ${p.groupCounts!['count_Y']}`);
});
```

---

## When to Use dynajs vs tnaj

| Feature | dynajs | tnaj |
|---------|--------|------|
| **Model types** | 4 (relative, frequency, co-occurrence, attention) | 10 (+ reverse, n-gram, gap, window, betweenness, matrix) |
| **Centralities** | 2 (InStrength, Betweenness) | 10 (+ OutStrength, Closeness variants, PageRank, Diffusion, etc.) |
| **Pruning** | Threshold only | Threshold + disparity filter |
| **Clustering** | 4 distance metrics | 9 distance metrics + numeric clustering |
| **Bootstrap / Permutation** | No | Yes |
| **Stability / Reliability** | No | Yes |
| **Communities / Cliques** | No | Yes |
| **WTNA** | No | Yes |
| **Pattern Discovery** | Yes (full engine) | No (separate codynaj package) |
| **Dependencies** | 0 | 0 |
| **Bundle size** | ~46 KB | ~120 KB |

**Use dynajs when:** You need core TNA + pattern discovery in a lightweight package, e.g., for dashboards, embedded analytics, or quick prototyping.

**Use tnaj when:** You need the full analytical suite — bootstrap confidence intervals, permutation tests, stability analysis, 10 centrality measures, community detection, etc.

---

## License

MIT
