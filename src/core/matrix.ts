/**
 * Matrix class wrapping Float64Array with row-major layout.
 * Designed for small matrices (typically 9x9 to ~30x30) used in TNA.
 */
export class Matrix {
  readonly data: Float64Array;
  readonly rows: number;
  readonly cols: number;

  constructor(rows: number, cols: number, data?: Float64Array | number[]) {
    this.rows = rows;
    this.cols = cols;
    if (data) {
      this.data = data instanceof Float64Array ? data : new Float64Array(data);
      if (this.data.length !== rows * cols) {
        throw new Error(
          `Data length ${this.data.length} doesn't match ${rows}x${cols}=${rows * cols}`,
        );
      }
    } else {
      this.data = new Float64Array(rows * cols);
    }
  }

  /** Create from a 2D array. */
  static from2D(arr: number[][]): Matrix {
    const rows = arr.length;
    if (rows === 0) return new Matrix(0, 0);
    const cols = arr[0]!.length;
    const data = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        data[i * cols + j] = arr[i]![j]!;
      }
    }
    return new Matrix(rows, cols, data);
  }

  /** Create a matrix filled with a value. */
  static fill(rows: number, cols: number, value: number): Matrix {
    const data = new Float64Array(rows * cols);
    data.fill(value);
    return new Matrix(rows, cols, data);
  }

  /** Create a zero matrix. */
  static zeros(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols);
  }

  /** Get element at (i, j). */
  get(i: number, j: number): number {
    return this.data[i * this.cols + j]!;
  }

  /** Set element at (i, j). */
  set(i: number, j: number, value: number): void {
    this.data[i * this.cols + j] = value;
  }

  /** Deep copy. */
  clone(): Matrix {
    return new Matrix(this.rows, this.cols, new Float64Array(this.data));
  }

  /** Convert to 2D array. */
  to2D(): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.get(i, j));
      }
      result.push(row);
    }
    return result;
  }

  /** Transpose. */
  transpose(): Matrix {
    const result = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(j, i, this.get(i, j));
      }
    }
    return result;
  }

  /** Scalar multiply. */
  scale(s: number): Matrix {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      result.data[i] = this.data[i]! * s;
    }
    return result;
  }

  /** Element-wise apply. */
  map(fn: (value: number, i: number, j: number) => number): Matrix {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.set(i, j, fn(this.get(i, j), i, j));
      }
    }
    return result;
  }

  /** Sum of all elements. */
  sum(): number {
    let s = 0;
    for (let i = 0; i < this.data.length; i++) {
      s += this.data[i]!;
    }
    return s;
  }

  /** Row sums as array. */
  rowSums(): Float64Array {
    const sums = new Float64Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let s = 0;
      for (let j = 0; j < this.cols; j++) {
        s += this.get(i, j);
      }
      sums[i] = s;
    }
    return sums;
  }

  /** Column sums as array. */
  colSums(): Float64Array {
    const sums = new Float64Array(this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        sums[j]! += this.get(i, j);
      }
    }
    return sums;
  }

  /** Get diagonal as array. */
  diag(): Float64Array {
    const n = Math.min(this.rows, this.cols);
    const d = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      d[i] = this.get(i, i);
    }
    return d;
  }

  /** Set diagonal values. */
  setDiag(value: number): Matrix {
    const result = this.clone();
    const n = Math.min(this.rows, this.cols);
    for (let i = 0; i < n; i++) {
      result.set(i, i, value);
    }
    return result;
  }

  /** Max element. */
  max(): number {
    let m = -Infinity;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i]! > m) m = this.data[i]!;
    }
    return m;
  }

  /** Min element. */
  min(): number {
    let m = Infinity;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i]! < m) m = this.data[i]!;
    }
    return m;
  }

  /** Count elements matching a predicate. */
  count(predicate: (v: number) => boolean): number {
    let c = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (predicate(this.data[i]!)) c++;
    }
    return c;
  }

  /** Flatten to array in row-major order. */
  flatten(): Float64Array {
    return new Float64Array(this.data);
  }

  /** Get a row as array. */
  row(i: number): Float64Array {
    const result = new Float64Array(this.cols);
    for (let j = 0; j < this.cols; j++) {
      result[j] = this.get(i, j);
    }
    return result;
  }

  /** Get a column as array. */
  col(j: number): Float64Array {
    const result = new Float64Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      result[i] = this.get(i, j);
    }
    return result;
  }

  /** Is square? */
  get isSquare(): boolean {
    return this.rows === this.cols;
  }

  /** Mean of non-zero elements. */
  meanNonZero(): number {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i]! > 0) {
        sum += this.data[i]!;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }
}

// ---- Utility functions ----

/** Row normalize a matrix (each row sums to 1). */
export function rowNormalize(mat: Matrix): Matrix {
  const result = mat.clone();
  for (let i = 0; i < mat.rows; i++) {
    let rowSum = 0;
    for (let j = 0; j < mat.cols; j++) {
      rowSum += mat.get(i, j);
    }
    if (rowSum === 0) rowSum = 1;
    for (let j = 0; j < mat.cols; j++) {
      result.set(i, j, mat.get(i, j) / rowSum);
    }
  }
  return result;
}

/** Min-max normalization to [0, 1]. */
export function minmaxScale(mat: Matrix): Matrix {
  const minVal = mat.min();
  const maxVal = mat.max();
  if (maxVal === minVal) return Matrix.zeros(mat.rows, mat.cols);
  const range = maxVal - minVal;
  return mat.map((v) => (v - minVal) / range);
}

/** Divide by maximum value. */
export function maxScale(mat: Matrix): Matrix {
  const maxVal = mat.max();
  if (maxVal === 0) return mat.clone();
  return mat.map((v) => v / maxVal);
}

/** Convert to ranks (1-based, average ties). */
export function rankScale(mat: Matrix): Matrix {
  const flat = Array.from(mat.data);
  const n = flat.length;

  const indexed = flat.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Float64Array(n);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && indexed[j]!.v === indexed[i]!.v) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      const idx = indexed[k]!.i;
      if (indexed[k]!.v === 0) {
        ranks[idx] = 0;
      } else {
        ranks[idx] = avgRank;
      }
    }
    i = j;
  }

  return new Matrix(mat.rows, mat.cols, ranks);
}

/** Apply one or more scaling methods to a matrix. */
export function applyScaling(
  mat: Matrix,
  scaling: string | string[] | null | undefined,
): { weights: Matrix; applied: string[] } {
  if (!scaling) return { weights: mat.clone(), applied: [] };

  const methods = typeof scaling === 'string' ? [scaling] : scaling;
  let result = mat.clone();
  const applied: string[] = [];

  for (const method of methods) {
    const m = method.toLowerCase();
    switch (m) {
      case 'minmax':
        result = minmaxScale(result);
        applied.push('minmax');
        break;
      case 'max':
        result = maxScale(result);
        applied.push('max');
        break;
      case 'rank':
        result = rankScale(result);
        applied.push('rank');
        break;
      default:
        throw new Error(`Unknown scaling method: ${method}`);
    }
  }

  return { weights: result, applied };
}
