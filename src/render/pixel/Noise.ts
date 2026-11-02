/**
 * Deterministic randomness + noise helpers used to procedurally texture the pixel-art world.
 * Everything is seeded so the baked scene looks identical on every load.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless integer hash → [0, 1). Useful for per-tile variation. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class ValueNoise {
  private readonly perm = new Uint8Array(512);
  private readonly values = new Float32Array(256);

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      this.values[i] = rand();
      p.push(i);
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private lattice(ix: number, iy: number): number {
    return this.values[this.perm[(ix & 255) + this.perm[iy & 255]]];
  }

  /** Smooth value noise in [0, 1]. */
  public noise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.lattice(ix, iy);
    const b = this.lattice(ix + 1, iy);
    const c = this.lattice(ix, iy + 1);
    const d = this.lattice(ix + 1, iy + 1);
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  }

  /** Fractal Brownian motion: layered noise in [0, 1]. */
  public fbm(x: number, y: number, octaves = 4): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in (0, 1) for pixel (x, y). */
export function bayer(x: number, y: number): number {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Maps a continuous value in [0, 1] to a palette index, using ordered dithering between bands. */
export function quantize(v: number, levels: number, x: number, y: number, ditherStrength = 1): number {
  const scaled = clamp01(v) * (levels - 1) + (bayer(x, y) - 0.5) * ditherStrength;
  return Math.max(0, Math.min(levels - 1, Math.round(scaled)));
}

