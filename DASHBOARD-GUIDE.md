# Implementing dynajs in an LMS Dashboard

A complete, step-by-step guide to building a learning analytics dashboard powered by dynajs. This guide uses a **Learning Management System (LMS)** as the running example, but the architecture applies to any system with sequential user behavior data (e-commerce, healthcare, game analytics, etc.).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Pipeline: From LMS Logs to Sequences](#2-data-pipeline-from-lms-logs-to-sequences)
   - [2.1 Raw Event Logs](#21-raw-event-logs)
   - [2.2 Transforming Logs to Sequences](#22-transforming-logs-to-sequences)
   - [2.3 Handling Multiple Courses and Sessions](#23-handling-multiple-courses-and-sessions)
   - [2.4 Server-Side vs Client-Side Processing](#24-server-side-vs-client-side-processing)
3. [Backend Integration](#3-backend-integration)
   - [3.1 Node.js / Express API](#31-nodejs--express-api)
   - [3.2 API Endpoints Design](#32-api-endpoints-design)
   - [3.3 Caching Analysis Results](#33-caching-analysis-results)
4. [Frontend Integration](#4-frontend-integration)
   - [4.1 Client-Side Analysis (Browser)](#41-client-side-analysis-browser)
   - [4.2 Web Worker for Heavy Computation](#42-web-worker-for-heavy-computation)
5. [Dashboard Components](#5-dashboard-components)
   - [5.1 Network Visualization](#51-network-visualization)
   - [5.2 Centrality Bar Chart](#52-centrality-bar-chart)
   - [5.3 Transition Heatmap](#53-transition-heatmap)
   - [5.4 Pattern Discovery Table](#54-pattern-discovery-table)
   - [5.5 Cluster Summary Panel](#55-cluster-summary-panel)
   - [5.6 State Frequency Distribution](#56-state-frequency-distribution)
   - [5.7 Group Comparison View](#57-group-comparison-view)
6. [Complete Dashboard Layout](#6-complete-dashboard-layout)
7. [Interactive Controls](#7-interactive-controls)
   - [7.1 Model Type Selector](#71-model-type-selector)
   - [7.2 Pruning Threshold Slider](#72-pruning-threshold-slider)
   - [7.3 Cluster Count Selector](#73-cluster-count-selector)
   - [7.4 Pattern Discovery Filters](#74-pattern-discovery-filters)
   - [7.5 Group Selector](#75-group-selector)
8. [Performance Considerations](#8-performance-considerations)
9. [Real-World LMS Scenarios](#9-real-world-lms-scenarios)
   - [9.1 Moodle Integration](#91-moodle-integration)
   - [9.2 Canvas LMS Integration](#92-canvas-lms-integration)
   - [9.3 Custom LMS](#93-custom-lms)
10. [Deployment Checklist](#10-deployment-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     LMS Platform                         │
│  (Moodle, Canvas, custom)                               │
│                                                          │
│  Event logs: user_id, timestamp, activity_type, ...      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Data Pipeline (ETL)                         │
│                                                          │
│  1. Query event logs from DB / API                       │
│  2. Group by (student, session/day)                      │
│  3. Sort by timestamp within each group                  │
│  4. Map event types to state labels                      │
│  5. Output: SequenceData[][]                             │
└──────────────────────┬──────────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│  Backend API     │  │  Client-Side     │
│  (Node.js)       │  │  (Browser)       │
│                  │  │                  │
│  • dynajs runs   │  │  • dynajs runs   │
│    on server     │  │    in browser    │
│  • Caches results│  │  • Web Worker    │
│  • Serves JSON   │  │    for heavy ops │
│  • Handles auth  │  │  • Instant UI    │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│                  Dashboard UI                            │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │ Network    │ │ Centrality │ │ Transition Heatmap  │   │
│  │ Graph      │ │ Bar Chart  │ │                     │   │
│  └────────────┘ └────────────┘ └────────────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │ Patterns   │ │ Clusters   │ │ Group Comparison    │   │
│  │ Table      │ │ Summary    │ │                     │   │
│  └────────────┘ └────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Two deployment strategies:**

1. **Server-side analysis** (recommended for large datasets): dynajs runs on the server. The API returns pre-computed JSON. Best when you have >1000 students or need to cache results.

2. **Client-side analysis** (recommended for interactivity): dynajs runs in the browser (optionally in a Web Worker). Best when users need real-time parameter adjustments (pruning threshold, model type, etc.) with <500 sequences.

Both strategies can be combined: server pre-computes the base model, client handles interactive filtering and parameter changes.

---

## 2. Data Pipeline: From LMS Logs to Sequences

### 2.1 Raw Event Logs

LMS platforms generate event logs like:

```
| user_id | timestamp           | event_type      | resource_id | course_id |
|---------|---------------------|-----------------|-------------|-----------|
| u001    | 2024-09-15 08:30:00 | page_view       | mod_page_12 | CS101     |
| u001    | 2024-09-15 08:35:00 | video_play      | mod_vid_03  | CS101     |
| u001    | 2024-09-15 08:52:00 | quiz_attempt    | mod_quiz_01 | CS101     |
| u001    | 2024-09-15 09:10:00 | forum_post      | mod_forum_5 | CS101     |
| u002    | 2024-09-15 09:00:00 | page_view       | mod_page_12 | CS101     |
| u002    | 2024-09-15 09:15:00 | page_view       | mod_page_13 | CS101     |
...
```

### 2.2 Transforming Logs to Sequences

The key transformation: **group by student, sort by time, extract the activity type as the state label**.

```typescript
// Node.js / server-side data pipeline

interface EventLog {
  user_id: string;
  timestamp: string;
  event_type: string;
  course_id: string;
}

/**
 * Map raw LMS event types to meaningful activity labels.
 * Customize this mapping for your LMS.
 */
function mapEventToState(event: EventLog): string {
  const typeMap: Record<string, string> = {
    'page_view':       'Reading',
    'resource_view':   'Reading',
    'video_play':      'Video',
    'video_pause':     'Video',
    'quiz_attempt':    'Quiz',
    'quiz_submit':     'Quiz',
    'forum_view':      'Forum',
    'forum_post':      'Forum',
    'forum_reply':     'Forum',
    'assignment_view': 'Assignment',
    'assignment_submit': 'Assignment',
    'file_download':   'Download',
    'chat_message':    'Chat',
  };
  return typeMap[event.event_type] ?? 'Other';
}

/**
 * Transform raw event logs into dynajs SequenceData format.
 *
 * Strategy: group by user, sort by timestamp, extract state labels.
 * Optional: split into sessions based on time gaps.
 */
function logsToSequences(
  logs: EventLog[],
  options?: {
    courseId?: string;
    sessionGapMinutes?: number; // Split sessions by inactivity gap
    maxStepsPerSession?: number; // Cap sequence length
    collapseRepeats?: boolean;  // Remove consecutive duplicates
  }
): { sequences: (string | null)[][]; userIds: string[]; groups?: string[] } {
  const courseId = options?.courseId;
  const sessionGap = (options?.sessionGapMinutes ?? 30) * 60 * 1000;
  const maxSteps = options?.maxStepsPerSession ?? 50;
  const collapse = options?.collapseRepeats ?? false;

  // Filter by course if specified
  let filtered = courseId ? logs.filter(l => l.course_id === courseId) : logs;

  // Group by user
  const byUser = new Map<string, EventLog[]>();
  for (const log of filtered) {
    if (!byUser.has(log.user_id)) byUser.set(log.user_id, []);
    byUser.get(log.user_id)!.push(log);
  }

  const sequences: (string | null)[][] = [];
  const userIds: string[] = [];

  for (const [userId, userLogs] of byUser) {
    // Sort by timestamp
    userLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Split into sessions by time gap
    let currentSession: string[] = [];
    let lastTime = 0;

    for (const log of userLogs) {
      const time = new Date(log.timestamp).getTime();
      const state = mapEventToState(log);

      if (lastTime > 0 && (time - lastTime) > sessionGap) {
        // Gap detected — flush current session
        if (currentSession.length >= 2) {
          sequences.push(currentSession.slice(0, maxSteps));
          userIds.push(userId);
        }
        currentSession = [];
      }

      // Optionally collapse consecutive repeats
      if (collapse && currentSession.length > 0 &&
          currentSession[currentSession.length - 1] === state) {
        lastTime = time;
        continue;
      }

      currentSession.push(state);
      lastTime = time;
    }

    // Flush last session
    if (currentSession.length >= 2) {
      sequences.push(currentSession.slice(0, maxSteps));
      userIds.push(userId);
    }
  }

  // Pad to equal length (dynajs handles ragged arrays, but equal length is cleaner)
  const maxLen = Math.max(...sequences.map(s => s.length));
  const padded = sequences.map(s => {
    const row: (string | null)[] = [...s];
    while (row.length < maxLen) row.push(null);
    return row;
  });

  return { sequences: padded, userIds };
}
```

### 2.3 Handling Multiple Courses and Sessions

```typescript
/**
 * Build sequences with course and performance group metadata.
 */
function buildCourseAnalysisData(
  logs: EventLog[],
  grades: Map<string, number>, // user_id -> final grade (0-100)
  courseId: string,
) {
  const { sequences, userIds } = logsToSequences(logs, {
    courseId,
    sessionGapMinutes: 30,
    collapseRepeats: true,
  });

  // Create performance groups based on grades
  const groups = userIds.map(uid => {
    const grade = grades.get(uid) ?? 0;
    if (grade >= 80) return 'High';
    if (grade >= 60) return 'Medium';
    return 'Low';
  });

  return { sequences, userIds, groups };
}
```

### 2.4 Server-Side vs Client-Side Processing

**Server-side** (recommended for production):
```
DB → SQL query → Node.js pipeline → dynajs analysis → JSON API → Frontend renders
```

**Client-side** (recommended for prototyping):
```
DB → API returns raw sequences as JSON → Browser runs dynajs → Renders directly
```

**Hybrid** (best of both):
```
DB → Server pre-computes base model → Client adjusts parameters interactively
```

---

## 3. Backend Integration

### 3.1 Node.js / Express API

```typescript
// server.ts
import express from 'express';
import {
  tna, ftna, ctna, atna, buildModel,
  centralities, prune, summary,
  clusterData, stateFrequencies, statePresence,
  discoverPatterns,
  groupTna, groupFtna, groupCtna, groupAtna,
  groupApply,
} from 'dynajs';
import type { TNA, SequenceData, ModelType } from 'dynajs';

const app = express();
app.use(express.json());

// ── Helper: build model by type ──────────────────────────────────────

function buildByType(sequences: SequenceData, type: ModelType, options?: any): TNA {
  switch (type) {
    case 'frequency': return ftna(sequences, options);
    case 'co-occurrence': return ctna(sequences, options);
    case 'attention': return atna(sequences, options);
    default: return tna(sequences, options);
  }
}

// ── Serialize dynajs results to JSON-safe objects ────────────────────

function serializeModel(model: TNA) {
  return {
    weights: model.weights.to2D(),
    inits: Array.from(model.inits),
    labels: model.labels,
    type: model.type,
    scaling: model.scaling,
    summary: summary(model),
  };
}

function serializeCentralities(result: ReturnType<typeof centralities>) {
  const measures: Record<string, number[]> = {};
  for (const [key, values] of Object.entries(result.measures)) {
    measures[key] = Array.from(values);
  }
  return {
    labels: result.labels,
    measures,
    groups: result.groups,
  };
}

// ── API Endpoints ────────────────────────────────────────────────────

/**
 * POST /api/analysis/model
 * Build a TNA model from sequence data.
 *
 * Body: {
 *   sequences: string[][],
 *   type?: 'relative' | 'frequency' | 'co-occurrence' | 'attention',
 *   scaling?: string | string[],
 *   beginState?: string,
 *   endState?: string,
 *   beta?: number,
 * }
 */
app.post('/api/analysis/model', (req, res) => {
  try {
    const { sequences, type = 'relative', scaling, beginState, endState, beta } = req.body;

    const model = buildByType(sequences, type, { scaling, beginState, endState, beta });

    res.json({
      model: serializeModel(model),
      frequencies: stateFrequencies(sequences),
      presence: statePresence(sequences),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/centralities
 * Compute centralities for given sequences.
 *
 * Body: {
 *   sequences: string[][],
 *   type?: ModelType,
 *   normalize?: boolean,
 *   loops?: boolean,
 * }
 */
app.post('/api/analysis/centralities', (req, res) => {
  try {
    const { sequences, type = 'relative', normalize = false, loops = false } = req.body;
    const model = buildByType(sequences, type);
    const result = centralities(model, { normalize, loops });

    res.json(serializeCentralities(result));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/prune
 * Build and prune a model.
 *
 * Body: {
 *   sequences: string[][],
 *   type?: ModelType,
 *   threshold?: number,
 * }
 */
app.post('/api/analysis/prune', (req, res) => {
  try {
    const { sequences, type = 'relative', threshold = 0.1 } = req.body;
    const model = buildByType(sequences, type);
    const pruned = prune(model, threshold) as TNA;

    res.json({
      original: serializeModel(model),
      pruned: serializeModel(pruned),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/cluster
 * Cluster sequences.
 *
 * Body: {
 *   sequences: string[][],
 *   k: number,
 *   dissimilarity?: string,
 *   method?: string,
 * }
 */
app.post('/api/analysis/cluster', (req, res) => {
  try {
    const { sequences, k, dissimilarity = 'hamming', method = 'pam' } = req.body;
    const result = clusterData(sequences, k, { dissimilarity, method });

    res.json({
      assignments: result.assignments,
      silhouette: result.silhouette,
      sizes: result.sizes,
      method: result.method,
      dissimilarity: result.dissimilarity,
      distance: result.distance.to2D(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/patterns
 * Discover sequential patterns.
 *
 * Body: {
 *   sequences: string[][],
 *   type?: 'ngram' | 'gapped' | 'repeated',
 *   len?: number[],
 *   gap?: number[],
 *   minFreq?: number,
 *   minSupport?: number,
 *   group?: string[],
 *   start?: string[],
 *   end?: string[],
 *   contain?: string[],
 *   pattern?: string,
 * }
 */
app.post('/api/analysis/patterns', (req, res) => {
  try {
    const { sequences, ...options } = req.body;
    const result = discoverPatterns(sequences, options);

    res.json({
      patterns: result.patterns,
      totalPatterns: result.patterns.length,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/groups
 * Build and analyze group models.
 *
 * Body: {
 *   sequences: string[][],
 *   groups: string[],
 *   type?: ModelType,
 *   threshold?: number,
 * }
 */
app.post('/api/analysis/groups', (req, res) => {
  try {
    const { sequences, groups, type = 'relative', threshold = 0.1 } = req.body;

    // Build group models
    let grouped;
    switch (type) {
      case 'frequency': grouped = groupFtna(sequences, groups); break;
      case 'co-occurrence': grouped = groupCtna(sequences, groups); break;
      case 'attention': grouped = groupAtna(sequences, groups); break;
      default: grouped = groupTna(sequences, groups); break;
    }

    // Serialize each group's model
    const models = groupApply(grouped, (m) => serializeModel(m));

    // Centralities per group (stacked)
    const cent = centralities(grouped, { normalize: true });

    // Prune each group
    const pruned = prune(grouped, threshold) as Record<string, TNA>;
    const prunedModels: Record<string, any> = {};
    for (const [name, m] of Object.entries(pruned)) {
      prunedModels[name] = serializeModel(m);
    }

    res.json({
      models,
      prunedModels,
      centralities: serializeCentralities(cent),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/full
 * Complete analysis in one request.
 *
 * Body: {
 *   sequences: string[][],
 *   groups?: string[],
 *   type?: ModelType,
 *   threshold?: number,
 *   clusterK?: number,
 *   patternLengths?: number[],
 * }
 */
app.post('/api/analysis/full', (req, res) => {
  try {
    const {
      sequences, groups, type = 'relative',
      threshold = 0.1, clusterK = 3,
      patternLengths = [2, 3, 4],
    } = req.body;

    const model = buildByType(sequences, type);
    const pruned = prune(model, threshold) as TNA;
    const cent = centralities(model, { normalize: true });
    const freq = stateFrequencies(sequences);
    const presence = statePresence(sequences);

    let clusterResult = null;
    if (sequences.length >= clusterK + 1) {
      const cr = clusterData(sequences, clusterK);
      clusterResult = {
        assignments: cr.assignments,
        silhouette: cr.silhouette,
        sizes: cr.sizes,
      };
    }

    const patterns = discoverPatterns(sequences, {
      len: patternLengths,
      group: groups ?? null,
    });

    let groupModels = null;
    let groupCentralities = null;
    if (groups) {
      const grouped = groupTna(sequences, groups);
      groupModels = groupApply(grouped, (m) => serializeModel(m));
      groupCentralities = serializeCentralities(centralities(grouped, { normalize: true }));
    }

    res.json({
      model: serializeModel(model),
      pruned: serializeModel(pruned),
      centralities: serializeCentralities(cent),
      frequencies: freq,
      presence,
      clusters: clusterResult,
      patterns: patterns.patterns,
      groupModels,
      groupCentralities,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Analysis API on :3001'));
```

### 3.2 API Endpoints Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/full` | POST | Complete analysis (model + centralities + clusters + patterns) |
| `/api/analysis/model` | POST | Build a single TNA model |
| `/api/analysis/centralities` | POST | Compute centralities |
| `/api/analysis/prune` | POST | Prune a model |
| `/api/analysis/cluster` | POST | Cluster sequences |
| `/api/analysis/patterns` | POST | Discover patterns |
| `/api/analysis/groups` | POST | Group analysis |

### 3.3 Caching Analysis Results

For an LMS with stable data (grades don't change minute by minute), cache analysis results:

```typescript
import { createHash } from 'crypto';

const analysisCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCacheKey(sequences: any, options: any): string {
  const input = JSON.stringify({ sequences, options });
  return createHash('md5').update(input).digest('hex');
}

function cachedAnalysis(sequences: any, options: any, compute: () => any): any {
  const key = getCacheKey(sequences, options);
  const cached = analysisCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = compute();
  analysisCache.set(key, { result, timestamp: Date.now() });
  return result;
}

// Usage in endpoint:
app.post('/api/analysis/model', (req, res) => {
  const result = cachedAnalysis(req.body.sequences, req.body, () => {
    const model = buildByType(req.body.sequences, req.body.type ?? 'relative');
    return serializeModel(model);
  });
  res.json(result);
});
```

---

## 4. Frontend Integration

### 4.1 Client-Side Analysis (Browser)

dynajs works directly in the browser. For dashboards where users interactively adjust parameters, run analysis client-side:

```typescript
// analysis-client.ts — runs in the browser
import {
  tna, ftna, ctna, atna,
  centralities, prune, summary,
  clusterData, stateFrequencies,
  discoverPatterns,
  groupTna, groupApply,
} from 'dynajs';
import type { TNA, ModelType, SequenceData } from 'dynajs';

export interface AnalysisParams {
  type: ModelType;
  threshold: number;
  clusterK: number;
  patternLengths: number[];
  normalize: boolean;
  groups?: string[];
  beta?: number;
}

export interface AnalysisResult {
  model: TNA;
  prunedModel: TNA;
  centralities: ReturnType<typeof centralities>;
  frequencies: Record<string, number>;
  clusters: ReturnType<typeof clusterData> | null;
  patterns: ReturnType<typeof discoverPatterns>;
  summary: Record<string, unknown>;
}

/**
 * Run complete analysis on the client side.
 * Call this when the user changes any parameter.
 */
export function runAnalysis(
  sequences: SequenceData,
  params: AnalysisParams,
): AnalysisResult {
  // Build model
  let model: TNA;
  switch (params.type) {
    case 'frequency': model = ftna(sequences); break;
    case 'co-occurrence': model = ctna(sequences); break;
    case 'attention': model = atna(sequences, { beta: params.beta }); break;
    default: model = tna(sequences); break;
  }

  // Prune
  const prunedModel = prune(model, params.threshold) as TNA;

  // Centralities
  const cent = centralities(model, { normalize: params.normalize });

  // Frequencies
  const freq = stateFrequencies(sequences);

  // Clusters
  let clusters: ReturnType<typeof clusterData> | null = null;
  if (sequences.length >= params.clusterK + 1) {
    clusters = clusterData(sequences, params.clusterK);
  }

  // Patterns
  const patterns = discoverPatterns(sequences, {
    len: params.patternLengths,
    group: params.groups ?? null,
  });

  return {
    model,
    prunedModel,
    centralities: cent,
    frequencies: freq,
    clusters,
    patterns,
    summary: summary(model),
  };
}
```

### 4.2 Web Worker for Heavy Computation

For datasets with >200 sequences, run dynajs in a Web Worker to avoid blocking the UI:

```typescript
// analysis.worker.ts
import {
  tna, ftna, ctna, atna,
  centralities, prune, summary,
  clusterData, stateFrequencies,
  discoverPatterns,
} from 'dynajs';

self.onmessage = (event) => {
  const { sequences, params } = event.data;

  try {
    // Build model
    let model;
    switch (params.type) {
      case 'frequency': model = ftna(sequences); break;
      case 'co-occurrence': model = ctna(sequences); break;
      case 'attention': model = atna(sequences, { beta: params.beta }); break;
      default: model = tna(sequences); break;
    }

    const prunedModel = prune(model, params.threshold);
    const cent = centralities(model, { normalize: params.normalize });
    const freq = stateFrequencies(sequences);
    const patterns = discoverPatterns(sequences, { len: params.patternLengths });

    let clusters = null;
    if (sequences.length >= params.clusterK + 1) {
      const cr = clusterData(sequences, params.clusterK);
      clusters = {
        assignments: cr.assignments,
        silhouette: cr.silhouette,
        sizes: cr.sizes,
      };
    }

    // Serialize (can't send Matrix through postMessage)
    self.postMessage({
      type: 'result',
      data: {
        model: {
          weights: model.weights.to2D(),
          inits: Array.from(model.inits),
          labels: model.labels,
          type: model.type,
          summary: summary(model),
        },
        pruned: {
          weights: (prunedModel as any).weights.to2D(),
        },
        centralities: {
          labels: cent.labels,
          measures: {
            InStrength: Array.from(cent.measures.InStrength),
            Betweenness: Array.from(cent.measures.Betweenness),
          },
        },
        frequencies: freq,
        clusters,
        patterns: patterns.patterns,
      },
    });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message });
  }
};
```

```typescript
// Using the worker from the main thread
const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });

function analyzeInWorker(sequences: string[][], params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      if (event.data.type === 'result') resolve(event.data.data);
      else reject(new Error(event.data.error));
    };
    worker.postMessage({ sequences, params });
  });
}

// Usage
const result = await analyzeInWorker(sequences, {
  type: 'relative',
  threshold: 0.15,
  clusterK: 3,
  patternLengths: [2, 3],
  normalize: true,
});
```

---

## 5. Dashboard Components

The following examples use vanilla JavaScript with common charting libraries. Adapt to your framework (React, Vue, Svelte, etc.).

### 5.1 Network Visualization

Use **Cytoscape.js** or **D3.js** to render the transition network. Each state is a node, each transition is a directed edge with weight proportional to thickness.

```typescript
// Cytoscape.js example
import cytoscape from 'cytoscape';

function renderNetwork(
  container: HTMLElement,
  weights: number[][],   // model.weights.to2D()
  labels: string[],
  inStrength: number[],  // centralities.measures.InStrength
  threshold: number,     // pruning threshold
) {
  const elements: any[] = [];

  // Nodes — size proportional to InStrength
  const maxInStr = Math.max(...inStrength);
  labels.forEach((label, i) => {
    elements.push({
      data: {
        id: label,
        label,
        size: 20 + (inStrength[i] / (maxInStr || 1)) * 40,
        inStrength: inStrength[i].toFixed(3),
      },
    });
  });

  // Edges — width proportional to weight
  for (let i = 0; i < labels.length; i++) {
    for (let j = 0; j < labels.length; j++) {
      const w = weights[i][j];
      if (w >= threshold && i !== j) {
        elements.push({
          data: {
            source: labels[i],
            target: labels[j],
            weight: w,
            width: 1 + w * 8,
            label: w.toFixed(2),
          },
        });
      }
    }
  }

  cytoscape({
    container,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'width': 'data(size)',
          'height': 'data(size)',
          'background-color': '#4A90D9',
          'color': '#333',
          'font-size': '12px',
          'text-valign': 'center',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 'data(width)',
          'line-color': '#999',
          'target-arrow-color': '#999',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'text-opacity': 0.7,
        },
      },
    ],
    layout: { name: 'circle' },
  });
}
```

### 5.2 Centrality Bar Chart

```typescript
// Chart.js example
import { Chart } from 'chart.js/auto';

function renderCentralityChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  inStrength: number[],
  betweenness: number[],
) {
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'InStrength',
          data: inStrength,
          backgroundColor: 'rgba(74, 144, 217, 0.7)',
        },
        {
          label: 'Betweenness',
          data: betweenness,
          backgroundColor: 'rgba(255, 159, 64, 0.7)',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Node Centrality Measures' },
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Score' } },
      },
    },
  });
}
```

### 5.3 Transition Heatmap

```typescript
// Using Plotly.js
import Plotly from 'plotly.js-dist-min';

function renderHeatmap(
  container: HTMLElement,
  weights: number[][],
  labels: string[],
) {
  Plotly.newPlot(container, [{
    z: weights,
    x: labels,
    y: labels,
    type: 'heatmap',
    colorscale: 'Blues',
    hoverongaps: false,
    text: weights.map(row => row.map(v => v.toFixed(3))),
    texttemplate: '%{text}',
    textfont: { size: 11 },
  }], {
    title: 'Transition Matrix',
    xaxis: { title: 'To', side: 'bottom' },
    yaxis: { title: 'From', autorange: 'reversed' },
    width: 500,
    height: 500,
  });
}
```

### 5.4 Pattern Discovery Table

```html
<!-- HTML structure -->
<table id="patterns-table">
  <thead>
    <tr>
      <th>Pattern</th>
      <th>Length</th>
      <th>Frequency</th>
      <th>Support</th>
      <th>Lift</th>
      <th>Proportion</th>
    </tr>
  </thead>
  <tbody></tbody>
</table>
```

```typescript
function renderPatternTable(
  tableBody: HTMLTableSectionElement,
  patterns: Array<{
    pattern: string;
    length: number;
    frequency: number;
    support: number;
    lift: number;
    proportion: number;
    pValue?: number;
  }>,
) {
  tableBody.innerHTML = '';

  for (const p of patterns.slice(0, 50)) { // Show top 50
    const row = document.createElement('tr');

    // Color-code the pattern string
    const patternCell = document.createElement('td');
    const states = p.pattern.split('->');
    patternCell.innerHTML = states
      .map(s => `<span class="state-badge state-${s.toLowerCase()}">${s}</span>`)
      .join('<span class="arrow"> → </span>');
    row.appendChild(patternCell);

    // Other columns
    const addCell = (value: string) => {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    };

    addCell(String(p.length));
    addCell(String(p.frequency));
    addCell(p.support.toFixed(3));
    addCell(p.lift.toFixed(2));
    addCell((p.proportion * 100).toFixed(1) + '%');

    // Highlight significant patterns
    if (p.pValue !== undefined && p.pValue < 0.05) {
      row.classList.add('significant');
    }

    tableBody.appendChild(row);
  }
}
```

### 5.5 Cluster Summary Panel

```typescript
function renderClusterSummary(
  container: HTMLElement,
  clusters: {
    assignments: number[];
    silhouette: number;
    sizes: number[];
  },
  sequences: string[][],
  labels: string[],
) {
  const k = clusters.sizes.length;

  let html = `
    <div class="cluster-header">
      <h3>${k} Clusters</h3>
      <p>Silhouette Score: <strong>${clusters.silhouette.toFixed(3)}</strong>
        ${clusters.silhouette > 0.5 ? '(Good)' :
          clusters.silhouette > 0.25 ? '(Fair)' : '(Weak)'}</p>
    </div>
    <div class="cluster-grid">
  `;

  for (let c = 1; c <= k; c++) {
    const indices = clusters.assignments
      .map((a, i) => a === c ? i : -1)
      .filter(i => i >= 0);

    // Count state frequencies within this cluster
    const stateCounts: Record<string, number> = {};
    for (const idx of indices) {
      for (const val of sequences[idx]) {
        if (val) stateCounts[val] = (stateCounts[val] ?? 0) + 1;
      }
    }

    // Sort by count descending
    const topStates = Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    html += `
      <div class="cluster-card">
        <h4>Cluster ${c}</h4>
        <p class="cluster-size">${clusters.sizes[c - 1]} students (${(clusters.sizes[c - 1] / clusters.assignments.length * 100).toFixed(0)}%)</p>
        <div class="top-states">
          <strong>Top activities:</strong>
          <ul>
            ${topStates.map(([state, count]) =>
              `<li>${state}: ${count} occurrences</li>`
            ).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;
}
```

### 5.6 State Frequency Distribution

```typescript
// Chart.js donut chart
function renderFrequencyChart(
  canvas: HTMLCanvasElement,
  frequencies: Record<string, number>,
) {
  const labels = Object.keys(frequencies);
  const values = Object.values(frequencies);
  const total = values.reduce((a, b) => a + b, 0);

  const colors = [
    '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12',
    '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB',
  ];

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
      }],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Activity Distribution' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}
```

### 5.7 Group Comparison View

```typescript
// Side-by-side heatmaps for group comparison
function renderGroupComparison(
  container: HTMLElement,
  groupModels: Record<string, { weights: number[][]; labels: string[] }>,
) {
  container.innerHTML = '';

  for (const [groupName, model] of Object.entries(groupModels)) {
    const div = document.createElement('div');
    div.className = 'group-panel';
    div.innerHTML = `<h4>${groupName}</h4>`;

    const plotDiv = document.createElement('div');
    plotDiv.style.width = '400px';
    plotDiv.style.height = '400px';
    div.appendChild(plotDiv);
    container.appendChild(div);

    // Use same color scale across groups for comparability
    Plotly.newPlot(plotDiv, [{
      z: model.weights,
      x: model.labels,
      y: model.labels,
      type: 'heatmap',
      colorscale: 'Blues',
      zmin: 0,
      zmax: 1,  // Fixed scale for comparability
    }], {
      title: groupName,
      width: 400,
      height: 400,
      margin: { t: 40, b: 60, l: 80, r: 20 },
    });
  }
}
```

---

## 6. Complete Dashboard Layout

```html
<!DOCTYPE html>
<html>
<head>
  <title>Learning Analytics Dashboard</title>
  <style>
    .dashboard {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto;
      gap: 20px;
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .panel {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
    }

    .panel-full { grid-column: 1 / -1; }

    .controls {
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
      padding: 15px 20px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .control-group label {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
    }

    .state-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .arrow { color: #999; font-size: 14px; }

    .significant { background-color: #fff3cd; }

    .cluster-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
    }

    .cluster-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px;
    }

    .group-panel {
      display: inline-block;
      vertical-align: top;
      margin: 10px;
    }

    #patterns-table {
      width: 100%;
      border-collapse: collapse;
    }

    #patterns-table th, #patterns-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
      text-align: left;
    }

    #patterns-table th {
      background: #f8f9fa;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>Learning Analytics Dashboard</h1>

  <!-- Controls -->
  <div class="controls" id="controls">
    <div class="control-group">
      <label>Model Type</label>
      <select id="model-type">
        <option value="relative">Relative (TNA)</option>
        <option value="frequency">Frequency (FTNA)</option>
        <option value="co-occurrence">Co-occurrence (CTNA)</option>
        <option value="attention">Attention (ATNA)</option>
      </select>
    </div>
    <div class="control-group">
      <label>Pruning Threshold</label>
      <input type="range" id="threshold" min="0" max="0.5" step="0.01" value="0.1">
      <span id="threshold-value">0.10</span>
    </div>
    <div class="control-group">
      <label>Clusters (k)</label>
      <input type="number" id="cluster-k" min="2" max="10" value="3">
    </div>
    <div class="control-group">
      <label>Pattern Lengths</label>
      <select id="pattern-lengths" multiple>
        <option value="2" selected>2</option>
        <option value="3" selected>3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    </div>
    <div class="control-group">
      <label>Group By</label>
      <select id="group-by">
        <option value="">None</option>
        <option value="performance">Performance</option>
        <option value="cluster">Cluster</option>
      </select>
    </div>
    <button id="analyze-btn" onclick="runDashboard()">Analyze</button>
  </div>

  <!-- Dashboard Grid -->
  <div class="dashboard">
    <div class="panel" id="network-panel">
      <h3>Transition Network</h3>
      <div id="network" style="height: 400px;"></div>
    </div>

    <div class="panel" id="centrality-panel">
      <h3>Centrality Measures</h3>
      <canvas id="centrality-chart"></canvas>
    </div>

    <div class="panel" id="heatmap-panel">
      <h3>Transition Matrix</h3>
      <div id="heatmap"></div>
    </div>

    <div class="panel" id="frequency-panel">
      <h3>Activity Distribution</h3>
      <canvas id="frequency-chart"></canvas>
    </div>

    <div class="panel panel-full" id="cluster-panel">
      <h3>Learner Clusters</h3>
      <div id="clusters"></div>
    </div>

    <div class="panel panel-full" id="pattern-panel">
      <h3>Sequential Patterns</h3>
      <table id="patterns-table">
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Length</th>
            <th>Frequency</th>
            <th>Support</th>
            <th>Lift</th>
            <th>Proportion</th>
          </tr>
        </thead>
        <tbody id="patterns-body"></tbody>
      </table>
    </div>

    <div class="panel panel-full" id="group-panel" style="display:none;">
      <h3>Group Comparison</h3>
      <div id="group-comparison"></div>
    </div>
  </div>

  <script type="module">
    // Import and wire up all the rendering functions shown above.
    // Call runDashboard() whenever controls change.
  </script>
</body>
</html>
```

---

## 7. Interactive Controls

### 7.1 Model Type Selector

```typescript
// Re-run analysis when model type changes
document.getElementById('model-type')!.addEventListener('change', (e) => {
  const type = (e.target as HTMLSelectElement).value as ModelType;
  // Re-build model, re-compute centralities, re-render network + heatmap
  const model = buildByType(sequences, type);
  updateDashboard(model);
});
```

### 7.2 Pruning Threshold Slider

The pruning slider is the most interactive control — it only affects the network visualization, not the underlying model. This makes it very fast to update.

```typescript
const slider = document.getElementById('threshold') as HTMLInputElement;
const label = document.getElementById('threshold-value')!;

slider.addEventListener('input', (e) => {
  const threshold = parseFloat((e.target as HTMLInputElement).value);
  label.textContent = threshold.toFixed(2);

  // Only re-render the network — no need to rebuild the model
  const pruned = prune(currentModel, threshold) as TNA;
  renderNetwork(
    document.getElementById('network')!,
    pruned.weights.to2D(),
    pruned.labels,
    currentCentralities.measures.InStrength,
    0, // already pruned
  );
});
```

### 7.3 Cluster Count Selector

```typescript
document.getElementById('cluster-k')!.addEventListener('change', (e) => {
  const k = parseInt((e.target as HTMLInputElement).value);
  if (k < 2 || k > sequences.length - 1) return;

  const result = clusterData(sequences, k);
  renderClusterSummary(
    document.getElementById('clusters')!,
    result, sequences, currentModel.labels,
  );
});
```

### 7.4 Pattern Discovery Filters

```typescript
function updatePatterns() {
  const select = document.getElementById('pattern-lengths') as HTMLSelectElement;
  const lengths = Array.from(select.selectedOptions).map(o => parseInt(o.value));

  const groupBy = (document.getElementById('group-by') as HTMLSelectElement).value;
  const groups = groupBy === 'performance' ? performanceGroups :
                 groupBy === 'cluster' ? currentClusters?.assignments.map(String) :
                 undefined;

  const result = discoverPatterns(sequences, {
    len: lengths,
    group: groups ?? null,
    minFreq: 2,
    minSupport: 0.05,
  });

  renderPatternTable(
    document.getElementById('patterns-body') as HTMLTableSectionElement,
    result.patterns,
  );
}
```

### 7.5 Group Selector

```typescript
document.getElementById('group-by')!.addEventListener('change', (e) => {
  const groupBy = (e.target as HTMLSelectElement).value;
  const groupPanel = document.getElementById('group-panel')!;

  if (!groupBy) {
    groupPanel.style.display = 'none';
    return;
  }

  groupPanel.style.display = 'block';

  let groups: string[];
  if (groupBy === 'performance') {
    groups = performanceGroups;
  } else if (groupBy === 'cluster') {
    if (!currentClusters) return;
    groups = currentClusters.assignments.map(String);
  } else {
    return;
  }

  const grouped = groupTna(sequences, groups);
  const models = groupApply(grouped, (m) => ({
    weights: m.weights.to2D(),
    labels: m.labels,
  }));

  renderGroupComparison(
    document.getElementById('group-comparison')!,
    models,
  );

  // Also update patterns with group chi-squared
  updatePatterns();
});
```

---

## 8. Performance Considerations

| Dataset Size | Recommended Approach | Notes |
|-------------|---------------------|-------|
| < 100 sequences | Client-side, main thread | Instant (<50ms) |
| 100–500 sequences | Client-side, Web Worker | Avoids UI jank (100–500ms) |
| 500–5000 sequences | Server-side with caching | Model builds in 1–5s |
| > 5000 sequences | Server-side, pre-computed | Cache aggressively, paginate patterns |

**Bottlenecks by operation:**

| Operation | Complexity | Typical Time (500 seqs, 8 states) |
|-----------|-----------|----------------------------------|
| `tna()` / `ftna()` | O(n × L) | ~5ms |
| `ctna()` | O(n × L²) | ~20ms |
| `centralities()` | O(S³) where S = states | ~1ms |
| `clusterData()` | O(n² × L) distance + O(n² × k) PAM | ~200ms |
| `discoverPatterns()` | O(n × L × |lengths|) | ~50ms |

**Tips:**
- Pruning threshold changes only affect display — no re-computation needed
- Cache the base model; only re-build when data or model type changes
- For clustering, pre-compute the distance matrix once and re-use it
- Pattern discovery is the most expensive for long sequences; limit `len` to `[2, 3]` for interactive use

---

## 9. Real-World LMS Scenarios

### 9.1 Moodle Integration

Moodle stores event logs in `mdl_logstore_standard_log`. Query relevant fields:

```sql
SELECT
  userid AS user_id,
  timecreated AS timestamp,
  component,
  action,
  target,
  courseid AS course_id
FROM mdl_logstore_standard_log
WHERE courseid = :course_id
  AND timecreated BETWEEN :start AND :end
ORDER BY userid, timecreated;
```

**Mapping Moodle components to states:**

```typescript
function moodleEventToState(component: string, action: string, target: string): string {
  // Moodle component-based mapping
  const componentMap: Record<string, string> = {
    'mod_page':       'Reading',
    'mod_resource':   'Reading',
    'mod_book':       'Reading',
    'mod_url':        'Reading',
    'mod_label':      'Reading',
    'core':           'Navigation',
    'mod_quiz':       'Quiz',
    'mod_assign':     'Assignment',
    'mod_forum':      'Forum',
    'mod_glossary':   'Glossary',
    'mod_wiki':       'Wiki',
    'mod_workshop':   'Workshop',
    'mod_feedback':   'Feedback',
    'mod_choice':     'Choice',
    'mod_data':       'Database',
    'mod_lesson':     'Lesson',
    'mod_scorm':      'SCORM',
    'mod_h5pactivity': 'Interactive',
    'mod_lti':        'External Tool',
    'mod_chat':       'Chat',
    'mod_bigbluebuttonbn': 'Video Conference',
  };

  // Check for video-specific targets
  if (target === 'course_module' && action === 'viewed') {
    return componentMap[component] ?? 'Other';
  }

  return componentMap[component] ?? 'Other';
}
```

**Fetching grades for group labels:**

```sql
SELECT
  g.userid AS user_id,
  g.finalgrade / gi.grademax * 100 AS percentage
FROM mdl_grade_grades g
JOIN mdl_grade_items gi ON g.itemid = gi.id
WHERE gi.courseid = :course_id
  AND gi.itemtype = 'course';
```

### 9.2 Canvas LMS Integration

Canvas exposes event data via the **Canvas Data 2 API** or **Live Events**. Use the REST API to get enrollment and grade data:

```typescript
// Canvas API client
async function getCanvasSequences(courseId: string, token: string) {
  const baseUrl = 'https://your-canvas.instructure.com/api/v1';
  const headers = { Authorization: `Bearer ${token}` };

  // Get enrollments
  const enrollments = await fetch(
    `${baseUrl}/courses/${courseId}/enrollments?type[]=StudentEnrollment&per_page=100`,
    { headers }
  ).then(r => r.json());

  // Get page views per student (Canvas Analytics API)
  const sequences: string[][] = [];
  const userIds: string[] = [];
  const grades: string[] = [];

  for (const enrollment of enrollments) {
    const userId = enrollment.user_id;

    // Get student's activity stream
    const activity = await fetch(
      `${baseUrl}/users/${userId}/page_views?per_page=100`,
      { headers }
    ).then(r => r.json());

    // Map to states
    const sequence = activity
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((event: any) => mapCanvasEventToState(event));

    if (sequence.length >= 2) {
      sequences.push(sequence);
      userIds.push(userId);

      // Grade group
      const score = enrollment.grades?.current_score ?? 0;
      grades.push(score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low');
    }
  }

  return { sequences, userIds, grades };
}

function mapCanvasEventToState(event: any): string {
  const url = event.url ?? '';
  if (url.includes('/pages/'))      return 'Reading';
  if (url.includes('/files/'))      return 'Reading';
  if (url.includes('/quizzes/'))    return 'Quiz';
  if (url.includes('/assignments/')) return 'Assignment';
  if (url.includes('/discussion_topics/')) return 'Forum';
  if (url.includes('/modules/'))    return 'Navigation';
  if (url.includes('/grades'))      return 'Grades';
  if (url.includes('/conferences/')) return 'Video Conference';
  return 'Other';
}
```

### 9.3 Custom LMS

If you're building a custom LMS, instrument your application to emit events:

```typescript
// Event emitter in your LMS application
interface LearningEvent {
  userId: string;
  sessionId: string;
  timestamp: number;
  activityType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

class LearningAnalytics {
  private events: LearningEvent[] = [];

  trackEvent(event: LearningEvent) {
    this.events.push(event);

    // Batch insert to database every 100 events
    if (this.events.length >= 100) {
      this.flush();
    }
  }

  private async flush() {
    const batch = this.events.splice(0);
    await fetch('/api/events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  }

  // Call from your LMS UI components:
  //   analytics.trackEvent({ userId, sessionId, timestamp: Date.now(), activityType: 'Reading', resourceId: 'page-123' })
}

// Database schema (PostgreSQL)
/*
CREATE TABLE learning_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  timestamp BIGINT NOT NULL,
  activity_type VARCHAR(32) NOT NULL,
  resource_id VARCHAR(128),
  course_id VARCHAR(64) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_user_course ON learning_events(user_id, course_id, timestamp);
CREATE INDEX idx_events_course_time ON learning_events(course_id, timestamp);
*/

// Query to extract sequences
/*
SELECT user_id, session_id, activity_type, timestamp
FROM learning_events
WHERE course_id = $1
ORDER BY user_id, session_id, timestamp;
*/
```

---

## 10. Deployment Checklist

### Before Launch

- [ ] **Data pipeline tested**: Verify your event-to-sequence transformation produces sensible data. Check for edge cases: empty sequences, single-event sessions, null values.
- [ ] **State labels finalized**: Map all event types to a manageable set of 4–12 state labels. Too many states make the network unreadable; too few lose nuance.
- [ ] **Performance tested**: Run analysis on your expected data size. If >500 sequences, use server-side processing or Web Workers.
- [ ] **Error handling**: Handle empty datasets, insufficient sequences for clustering (need at least k+1), and invalid parameters gracefully.
- [ ] **Browser compatibility**: dynajs uses ES2022 features (Float64Array, Map, Set). Works in all modern browsers. If you need IE11, use the CJS build with polyfills.

### Data Quality Checks

```typescript
import { prepareData } from 'dynajs';

function validateData(sequences: (string | null)[][]) {
  const data = prepareData(sequences);
  const stats = data.statistics;

  const warnings: string[] = [];

  if (stats.nSessions < 10) {
    warnings.push(`Only ${stats.nSessions} sequences — results may not be reliable`);
  }
  if (stats.nUniqueActions < 3) {
    warnings.push(`Only ${stats.nUniqueActions} unique states — consider finer activity granularity`);
  }
  if (stats.nUniqueActions > 15) {
    warnings.push(`${stats.nUniqueActions} unique states — consider grouping similar activities`);
  }
  if (stats.meanSequenceLength < 3) {
    warnings.push(`Mean sequence length is ${stats.meanSequenceLength.toFixed(1)} — very short sequences`);
  }

  return { valid: warnings.length === 0, warnings, stats };
}
```

### Recommended Defaults for LMS Dashboards

| Parameter | Recommended Value | Reason |
|-----------|------------------|--------|
| Model type | `'relative'` | Probabilities are most intuitive for educators |
| Pruning threshold | `0.10` | Removes noise while keeping meaningful transitions |
| Cluster k | `3` | Low/Medium/High is a natural grouping |
| Dissimilarity | `'hamming'` | Fast, interpretable, works well for equal-length sequences |
| Pattern lengths | `[2, 3]` | Longer patterns have very low support in typical LMS data |
| Min support | `0.05` | 5% of learners must exhibit the pattern |
| Session gap | `30 minutes` | Standard inactivity timeout for web sessions |
| Collapse repeats | `true` | "Reading, Reading, Reading" → "Reading" reduces noise |

### Security Considerations

- Never expose raw student data in the frontend. Aggregate before sending.
- Use authentication on all API endpoints.
- Rate-limit the analysis endpoints (analysis is CPU-intensive).
- Anonymize user IDs in the dashboard unless the viewer has appropriate permissions.
- Comply with FERPA (US), GDPR (EU), or your jurisdiction's student data privacy laws.
