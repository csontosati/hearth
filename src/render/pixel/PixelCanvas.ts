export type RGB = readonly [number, number, number];

export function hex(color: string): RGB {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A raw RGBA pixel buffer used to bake static scenery once (ground, trees, props).
 * Working per-pixel lets us dither, shade and outline like hand-made pixel art.
 */
export class PixelCanvas {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  public set(x: number, y: number, c: RGB, alpha = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inBounds(x, y)) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = alpha;
  }

  /** Alpha-blends a colour over the existing pixel. */
  public blend(x: number, y: number, c: RGB, alpha: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inBounds(x, y)) return;
    const i = (y * this.width + x) * 4;
    if (this.data[i + 3] === 0) {
      this.set(x, y, c, Math.round(alpha * 255));
      return;
    }
    this.data[i] += (c[0] - this.data[i]) * alpha;
    this.data[i + 1] += (c[1] - this.data[i + 1]) * alpha;
    this.data[i + 2] += (c[2] - this.data[i + 2]) * alpha;
  }

  public rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }

  /** Paints an ASCII sprite; characters missing from the palette are transparent. */
  public drawRows(rows: readonly string[], palette: Readonly<Record<string, RGB>>, ox: number, oy: number): void {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = palette[row[x]];
        if (c) this.set(ox + x, oy + y, c);
      }
    });
  }

  public toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D context for baked layer');
    ctx.putImageData(new ImageData(this.data, this.width, this.height), 0, 0);
    return canvas;
  }
}

