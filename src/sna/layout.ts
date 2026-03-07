/**
 * Force-directed layout algorithms: Spring and Fruchterman-Reingold.
 */
import type { TNA, LayoutResult, LayoutAlgorithm } from '../core/types.js';

/**
 * Compute a 2D force-directed layout for a TNA network.
 *
 * @param algorithm - 'spring' (default) or 'fr' (Fruchterman-Reingold)
 * @param iterations - Number of simulation steps (default 300)
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

  // Initialize positions deterministically (golden angle spiral)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n) * Math.min(width, height) * 0.4;
    const theta = i * goldenAngle;
    x[i] = width / 2 + r * Math.cos(theta);
    y[i] = height / 2 + r * Math.sin(theta);
  }

  if (algo === 'fr') {
    fruchtermanReingold(model, x, y, n, iterations, width, height);
  } else {
    spring(model, x, y, n, iterations, width, height);
  }

  // Normalize to [0, 1]
  normalize(x, y, n);

  return { x, y, labels: [...model.labels] };
}

function spring(
  model: TNA,
  x: Float64Array,
  y: Float64Array,
  n: number,
  iterations: number,
  width: number,
  height: number,
): void {
  const area = width * height;
  const k = Math.sqrt(area / n);
  const centerX = width / 2;
  const centerY = height / 2;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = (1 - iter / iterations) * width / 10;
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ddx = x[i]! - x[j]!;
        const ddy = y[i]! - y[j]!;
        const dist = Math.max(Math.sqrt(ddx * ddx + ddy * ddy), 0.01);
        const force = (k * k) / dist;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] = dx[i]! + fx;
        dy[i] = dy[i]! + fy;
        dx[j] = dx[j]! - fx;
        dy[j] = dy[j]! - fy;
      }
    }

    // Attraction along edges
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
        dx[i] = dx[i]! + fx;
        dy[i] = dy[i]! + fy;
      }
    }

    // Centering force
    for (let i = 0; i < n; i++) {
      dx[i] = dx[i]! + (centerX - x[i]!) * 0.01;
      dy[i] = dy[i]! + (centerY - y[i]!) * 0.01;
    }

    // Apply with temperature clamping
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

function fruchtermanReingold(
  model: TNA,
  x: Float64Array,
  y: Float64Array,
  n: number,
  iterations: number,
  width: number,
  height: number,
): void {
  const area = width * height;
  const k = Math.sqrt(area / n);
  let temp = width / 10;

  for (let iter = 0; iter < iterations; iter++) {
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);

    // Repulsive forces between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ddx = x[i]! - x[j]!;
        const ddy = y[i]! - y[j]!;
        const dist = Math.max(Math.sqrt(ddx * ddx + ddy * ddy), 0.01);
        const force = (k * k) / dist;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[i] = dx[i]! + fx;
        dy[i] = dy[i]! + fy;
        dx[j] = dx[j]! - fx;
        dy[j] = dy[j]! - fy;
      }
    }

    // Attractive forces along edges
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
        dx[i] = dx[i]! + fx;
        dy[i] = dy[i]! + fy;
      }
    }

    // Clamp displacement to temperature
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

function normalize(x: Float64Array, y: Float64Array, n: number): void {
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
