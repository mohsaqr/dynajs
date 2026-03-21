/**
 * Network layout algorithms for TNA models.
 *
 * All algorithms output positions normalized to [0, 1].
 * Available: spring, fr, circle, grid, spectral, kamada-kawai,
 *            star, hierarchical, concentric, random.
 */
import type { TNA, LayoutResult, LayoutAlgorithm } from '../core/types.js';

/**
 * Compute a 2D layout for a TNA network.
 *
 * @param algorithm - Layout algorithm (default 'spring')
 * @param iterations - Simulation steps for iterative algorithms (default 300)
 * @param width - Layout area width (default 100)
 * @param height - Layout area height (default 100)
 */
export function layout(
  model: TNA,
  options?: {
    algorithm?: LayoutAlgorithm;
    iterations?: number;
    width?: number;
    height?: number;
  },
): LayoutResult {
  const algo = options?.algorithm ?? 'spring';
  const iterations = options?.iterations ?? 300;
  const width = options?.width ?? 100;
  const height = options?.height ?? 100;
  const n = model.weights.rows;

  const x = new Float64Array(n);
  const y = new Float64Array(n);

  if (n === 0) return { x, y, labels: [] };
  if (n === 1) return { x: new Float64Array([0.5]), y: new Float64Array([0.5]), labels: [...model.labels] };

  switch (algo) {
    case 'circle':
      circleLayout(x, y, n);
      break;
    case 'grid':
      gridLayout(x, y, n);
      break;
    case 'random':
      randomLayout(x, y, n);
      break;
    case 'concentric':
      concentricLayout(model, x, y, n);
      break;
    case 'star':
      starLayout(model, x, y, n);
      break;
    case 'hierarchical':
      hierarchicalLayout(model, x, y, n);
      break;
    case 'spectral':
      spectralLayout(model, x, y, n);
      break;
    case 'kamada-kawai':
      kamadaKawaiLayout(model, x, y, n, iterations, width, height);
      break;
    case 'fr':
      initGoldenSpiral(x, y, n, width, height);
      fruchtermanReingold(model, x, y, n, iterations, width, height);
      break;
    case 'spring':
    default:
      initGoldenSpiral(x, y, n, width, height);
      spring(model, x, y, n, iterations, width, height);
      break;
  }

  normalizePositions(x, y, n);
  return { x, y, labels: [...model.labels] };
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Symmetrized weight between i and j. */
function symWeight(model: TNA, i: number, j: number): number {
  return (model.weights.get(i, j) + model.weights.get(j, i));
}

/** Check if edge exists (either direction). */
function hasEdge(model: TNA, i: number, j: number): boolean {
  return model.weights.get(i, j) > 0 || model.weights.get(j, i) > 0;
}

/** Total degree (number of neighbors) for node i. */
function degree(model: TNA, i: number, n: number): number {
  let d = 0;
  for (let j = 0; j < n; j++) if (i !== j && hasEdge(model, i, j)) d++;
  return d;
}

/** Index of the node with the highest degree. */
function hubNode(model: TNA, n: number): number {
  let best = 0, bestD = -1;
  for (let i = 0; i < n; i++) {
    const d = degree(model, i, n);
    if (d > bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Golden-angle spiral initialization for force-directed layouts. */
function initGoldenSpiral(x: Float64Array, y: Float64Array, n: number, width: number, height: number): void {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n) * Math.min(width, height) * 0.4;
    const theta = i * goldenAngle;
    x[i] = width / 2 + r * Math.cos(theta);
    y[i] = height / 2 + r * Math.sin(theta);
  }
}

/** Normalize x,y arrays to [0, 1]. */
function normalizePositions(x: Float64Array, y: Float64Array, n: number): void {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i]! < minX) minX = x[i]!;
    if (x[i]! > maxX) maxX = x[i]!;
    if (y[i]! < minY) minY = y[i]!;
    if (y[i]! > maxY) maxY = y[i]!;
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  for (let i = 0; i < n; i++) {
    x[i] = (x[i]! - minX) / rangeX;
    y[i] = (y[i]! - minY) / rangeY;
  }
}

/* ── Non-iterative layouts ──────────────────────────────────────────── */

function circleLayout(x: Float64Array, y: Float64Array, n: number): void {
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    x[i] = 0.5 + 0.45 * Math.cos(angle);
    y[i] = 0.5 + 0.45 * Math.sin(angle);
  }
}

function gridLayout(x: Float64Array, y: Float64Array, n: number): void {
  const cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    x[i] = (i % cols) / Math.max(cols - 1, 1);
    y[i] = Math.floor(i / cols) / Math.max(Math.ceil(n / cols) - 1, 1);
  }
}

function randomLayout(x: Float64Array, y: Float64Array, n: number): void {
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < n; i++) { x[i] = rand(); y[i] = rand(); }
}

function concentricLayout(model: TNA, x: Float64Array, y: Float64Array, n: number): void {
  // Nodes sorted by degree, placed in 3 concentric rings (center = highest degree).
  const degrees = Array.from({ length: n }, (_, i) => ({ idx: i, deg: degree(model, i, n) }))
    .sort((a, b) => b.deg - a.deg);

  const ring1 = Math.max(1, Math.ceil(n * 0.2));
  const ring2 = Math.max(1, Math.ceil(n * 0.4));
  const rings = [
    { items: degrees.slice(0, ring1), r: 0.1 },
    { items: degrees.slice(ring1, ring1 + ring2), r: 0.3 },
    { items: degrees.slice(ring1 + ring2), r: 0.47 },
  ];

  for (const { items, r } of rings) {
    items.forEach(({ idx }, i) => {
      if (items.length === 1) { x[idx] = 0.5; y[idx] = 0.5; }
      else {
        const angle = (2 * Math.PI * i) / items.length - Math.PI / 2;
        x[idx] = 0.5 + r * Math.cos(angle);
        y[idx] = 0.5 + r * Math.sin(angle);
      }
    });
  }
}

function starLayout(model: TNA, x: Float64Array, y: Float64Array, n: number): void {
  // Hub at center, neighbors on inner ring, rest on outer ring.
  const hub = hubNode(model, n);
  x[hub] = 0.5; y[hub] = 0.5;

  const neighbors: number[] = [];
  const others: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === hub) continue;
    if (hasEdge(model, hub, i)) neighbors.push(i);
    else others.push(i);
  }

  neighbors.forEach((idx, i) => {
    const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2;
    x[idx] = 0.5 + 0.25 * Math.cos(angle);
    y[idx] = 0.5 + 0.25 * Math.sin(angle);
  });

  if (others.length > 0) {
    others.forEach((idx, i) => {
      const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
      x[idx] = 0.5 + 0.46 * Math.cos(angle);
      y[idx] = 0.5 + 0.46 * Math.sin(angle);
    });
  }
}

function hierarchicalLayout(model: TNA, x: Float64Array, y: Float64Array, n: number): void {
  // BFS layers from the hub node, top to bottom.
  const root = hubNode(model, n);
  const layerArr = new Array<number>(n).fill(-1);
  layerArr[root] = 0;
  const queue = [root];
  let qi = 0;
  while (qi < queue.length) {
    const v = queue[qi++]!;
    for (let w = 0; w < n; w++) {
      if (layerArr[w]! >= 0 || w === v) continue;
      if (hasEdge(model, v, w)) { layerArr[w] = layerArr[v]! + 1; queue.push(w); }
    }
  }
  let maxLayer = 0;
  for (let i = 0; i < n; i++) {
    const li = layerArr[i]!;
    if (li >= 0 && li > maxLayer) maxLayer = li;
  }
  for (let i = 0; i < n; i++) if (layerArr[i]! < 0) layerArr[i] = ++maxLayer;

  // Group nodes per layer
  const layers: number[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (let i = 0; i < n; i++) layers[layerArr[i]!]!.push(i);

  const layerCount = maxLayer + 1;
  for (let l = 0; l < layerCount; l++) {
    const nodes = layers[l]!;
    const yPos = layerCount > 1 ? l / (layerCount - 1) : 0.5;
    for (let i = 0; i < nodes.length; i++) {
      const idx = nodes[i]!;
      x[idx] = nodes.length > 1 ? i / (nodes.length - 1) : 0.5;
      y[idx] = yPos;
    }
  }
}

/* ── Spectral layout ────────────────────────────────────────────────── */

function spectralLayout(model: TNA, x: Float64Array, y: Float64Array, n: number): void {
  // x,y = two smallest non-trivial eigenvectors of the normalized Laplacian,
  // computed via power iteration on the random-walk matrix D^{-1}W.
  const deg = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += symWeight(model, i, j);
    deg[i] = s;
  }

  const removeConst = (v: Float64Array) => {
    let mean = 0;
    for (let i = 0; i < n; i++) mean += v[i]!;
    mean /= n;
    for (let i = 0; i < n; i++) v[i] = v[i]! - mean;
  };
  const norm = (v: Float64Array) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += v[i]! * v[i]!;
    const d = Math.sqrt(s) || 1;
    for (let i = 0; i < n; i++) v[i] = v[i]! / d;
  };
  const deflate = (v: Float64Array, u: Float64Array) => {
    let dot = 0;
    for (let i = 0; i < n; i++) dot += v[i]! * u[i]!;
    for (let i = 0; i < n; i++) v[i] = v[i]! - dot * u[i]!;
  };
  const powerIterate = (init: Float64Array, deflectors: Float64Array[]) => {
    const v = new Float64Array(init);
    removeConst(v); norm(v);
    const next = new Float64Array(n);
    for (let iter = 0; iter < 150; iter++) {
      for (let i = 0; i < n; i++) {
        if (deg[i]! === 0) { next[i] = v[i]!; continue; }
        let s = 0;
        for (let j = 0; j < n; j++) s += symWeight(model, i, j) * v[j]!;
        next[i] = s / deg[i]!;
      }
      removeConst(next);
      for (const d of deflectors) deflate(next, d);
      norm(next);
      for (let i = 0; i < n; i++) v[i] = next[i]!;
    }
    return v;
  };

  const init1 = new Float64Array(n);
  const init2 = new Float64Array(n);
  for (let i = 0; i < n; i++) { init1[i] = Math.sin(i * 2.71828 + 0.5); init2[i] = Math.cos(i * 1.61803 + 0.3); }

  const v1 = powerIterate(init1, []);
  const v2 = powerIterate(init2, [v1]);

  for (let i = 0; i < n; i++) { x[i] = v1[i]!; y[i] = v2[i]!; }
}

/* ── Kamada-Kawai ───────────────────────────────────────────────────── */

function kamadaKawaiLayout(
  model: TNA, x: Float64Array, y: Float64Array, n: number,
  iterations: number, width: number, height: number,
): void {
  // 1. All-pairs shortest paths (BFS, unweighted)
  // Use a flat Float64Array for strict-TS compatibility
  const dist = new Float64Array(n * n).fill(Infinity);
  const dGet = (i: number, j: number) => dist[i * n + j]!;
  const dSet = (i: number, j: number, v: number) => { dist[i * n + j] = v; };

  for (let s = 0; s < n; s++) {
    dSet(s, s, 0);
    const q = [s];
    let qi = 0;
    while (qi < q.length) {
      const v = q[qi++]!;
      for (let w = 0; w < n; w++) {
        if (dGet(s, w) < Infinity || w === v) continue;
        if (hasEdge(model, v, w)) { dSet(s, w, dGet(s, v) + 1); q.push(w); }
      }
    }
  }
  let maxDist = 0;
  for (let i = 0; i < n * n; i++)
    if (dist[i]! < Infinity && dist[i]! > maxDist) maxDist = dist[i]!;
  const fallback = maxDist + 1;
  for (let i = 0; i < n * n; i++)
    if (dist[i]! === Infinity) dist[i] = fallback;

  // 2. Initialize circle
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    x[i] = width / 2 + width * 0.3 * Math.cos(angle);
    y[i] = height / 2 + height * 0.3 * Math.sin(angle);
  }

  // 3. Ideal length proportional to graph distance
  const L0 = Math.min(width, height) * 0.8 / Math.max(maxDist, 1);

  // 4. Gradient descent
  for (let iter = 0; iter < iterations; iter++) {
    const step = 0.1 * (1 - iter / iterations);
    for (let i = 0; i < n; i++) {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = x[i]! - x[j]!;
        const dy = y[i]! - y[j]!;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const dij = dGet(i, j);
        const ideal = dij * L0;
        const k = 1 / (dij * dij);
        const force = k * (d - ideal) / d;
        gx += force * dx;
        gy += force * dy;
      }
      x[i] = x[i]! - step * gx;
      y[i] = y[i]! - step * gy;
    }
  }
}

/* ── Force-directed: Spring ─────────────────────────────────────────── */

function spring(
  model: TNA, x: Float64Array, y: Float64Array, n: number,
  iterations: number, width: number, height: number,
): void {
  const area = width * height;
  const k = Math.sqrt(area / n);
  const centerX = width / 2;
  const centerY = height / 2;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = (1 - iter / iterations) * width / 10;
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ddx = x[i]! - x[j]!;
        const ddy = y[i]! - y[j]!;
        const dist = Math.max(Math.sqrt(ddx * ddx + ddy * ddy), 0.01);
        const force = (k * k) / dist;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] = dx[i]! + fx; dy[i] = dy[i]! + fy;
        dx[j] = dx[j]! - fx; dy[j] = dy[j]! - fy;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const w = model.weights.get(i, j);
        if (w <= 0) continue;
        const ddx = x[j]! - x[i]!;
        const ddy = y[j]! - y[i]!;
        const dist = Math.max(Math.sqrt(ddx * ddx + ddy * ddy), 0.01);
        const force = (dist * dist) / k * w;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] = dx[i]! + fx; dy[i] = dy[i]! + fy;
      }
    }

    for (let i = 0; i < n; i++) {
      dx[i] = dx[i]! + (centerX - x[i]!) * 0.01;
      dy[i] = dy[i]! + (centerY - y[i]!) * 0.01;
    }

    for (let i = 0; i < n; i++) {
      const disp = Math.sqrt(dx[i]! * dx[i]! + dy[i]! * dy[i]!);
      if (disp > 0) {
        const scale = Math.min(disp, temp) / disp;
        x[i] = x[i]! + dx[i]! * scale;
        y[i] = y[i]! + dy[i]! * scale;
      }
    }
  }
}

/* ── Force-directed: Fruchterman-Reingold ───────────────────────────── */

function fruchtermanReingold(
  model: TNA, x: Float64Array, y: Float64Array, n: number,
  iterations: number, width: number, height: number,
): void {
  const area = width * height;
  const k = Math.sqrt(area / n);
  let temp = width / 10;

  for (let iter = 0; iter < iterations; iter++) {
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ddx = x[i]! - x[j]!;
        const ddy = y[i]! - y[j]!;
        const dist = Math.max(Math.sqrt(ddx * ddx + ddy * ddy), 0.01);
        const force = (k * k) / dist;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] = dx[i]! + fx; dy[i] = dy[i]! + fy;
        dx[j] = dx[j]! - fx; dy[j] = dy[j]! - fy;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const w = model.weights.get(i, j);
        if (w <= 0) continue;
        const ddx = x[j]! - x[i]!;
        const ddy = y[j]! - y[i]!;
        const dist = Math.max(Math.sqrt(ddx * ddx + ddy * ddy), 0.01);
        const force = (dist * dist) / k * w;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] = dx[i]! + fx; dy[i] = dy[i]! + fy;
      }
    }

    for (let i = 0; i < n; i++) {
      const disp = Math.sqrt(dx[i]! * dx[i]! + dy[i]! * dy[i]!);
      if (disp > 0) {
        const scale = Math.min(disp, temp) / disp;
        x[i] = x[i]! + dx[i]! * scale;
        y[i] = y[i]! + dy[i]! * scale;
      }
    }

    temp *= 0.95;
  }
}
