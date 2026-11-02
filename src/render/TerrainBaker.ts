import type { Workstation } from '../architecture/types';
import { ValueNoise, bayer, clamp01, hash2, mulberry32, quantize } from './pixel/Noise';
import { PixelCanvas, hex, type RGB } from './pixel/PixelCanvas';

/** World coordinates (800x540) are rendered on a 2x-upscaled logical pixel grid. */
export const PIXEL_SCALE = 2;

export interface TreeInfo {
  /** Canopy centre in logical pixels. */
  x: number;
  y: number;
  r: number;
}

export interface SwayTuft {
  x: number;
  y: number;
  h: number;
}

export interface BakedScene {
  /** Everything at ground level (drawn below characters). */
  ground: HTMLCanvasElement;
  /** Tree canopies (drawn above characters so they can walk "behind" trees). */
  foreground: HTMLCanvasElement;
  trees: TreeInfo[];
  tufts: SwayTuft[];
}

interface Pt {
  x: number;
  y: number;
}

interface PathFeature {
  pts: Pt[];
  hw: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ── Palettes ────────────────────────────────────────────────────────────────
const GRASS = ['#3b6332', '#47753a', '#558641', '#64974a', '#77a854'].map(hex);
const GRASS_HI = hex('#95c364');
const DIRT = ['#7a5f41', '#937551', '#a98b60', '#bfa271', '#d0b685'].map(hex);
const DIRT_DARK = hex('#654d35');
const CLIFF = ['#2f2118', '#463123', '#5c432f', '#73573b'].map(hex);
const LEAF = ['#1b2e1f', '#26432a', '#335b2f', '#467638', '#609444', '#84b556'].map(hex);
const LEAF_OUTLINE = hex('#121f16');
const LEAF_SPARKLE = hex('#a9d46c');
const BARK = ['#2c1d14', '#46301f', '#61442e', '#7a5739'].map(hex);
const BARK_OUTLINE = hex('#1a110b');
const STONE = ['#23282c', '#394147', '#545e65', '#748189', '#9eabb1'].map(hex);
const STONE_OUTLINE = hex('#15181b');
const MOSS = ['#46692f', '#679140'].map(hex);
const SHADOW = hex('#16251d');
const WOOD = {
  light: hex('#b07c4a'),
  mid: hex('#9a6a3e'),
  alt: hex('#8d5f36'),
  grain: hex('#7a4f2c'),
  dark: hex('#5e3c22'),
  gap: hex('#3e2614'),
  outline: hex('#2a1a10'),
};
const LIGHT = { x: -0.5, y: -0.65, z: 0.57 };

const FLOWER_COLORS: ReadonlyArray<readonly [RGB, RGB]> = [
  [hex('#f4f1ea'), hex('#f2c94c')],
  [hex('#f7d84a'), hex('#b5651d')],
  [hex('#e98fb0'), hex('#f7e27a')],
  [hex('#b9a3e8'), hex('#f7e27a')],
  [hex('#f08a5d'), hex('#ffe08a')],
];

const ANVIL_ROWS = [
  'kkkkkkkkk...',
  'kHHHHHHHHkkk',
  'kMMMMMMMMMMk',
  '.kkMMMMMkkk.',
  '...kMMMk....',
  '..kMMMMMk...',
  '..kkkkkkk...',
];
const ANVIL_PALETTE = { k: hex('#14171b'), H: hex('#aab5bd'), M: hex('#4f5a63') };

const BARREL_ROWS = ['.kkkkk.', 'kLLLLLk', 'kIIIIIk', 'kwWwWdk', 'kwWwWdk', 'kIIIIIk', 'kwWwWdk', '.kkkkk.'];
const BARREL_PALETTE = {
  k: hex('#1f140c'),
  L: hex('#6e4828'),
  I: hex('#3b3f44'),
  w: hex('#a26c3d'),
  W: hex('#8a5a32'),
  d: hex('#5e3c22'),
};

// ── Geometry helpers ────────────────────────────────────────────────────────
function catmullRom(points: readonly Pt[], samplesPerSegment = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function distToSegment(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

function makePath(points: readonly Pt[], hw: number): PathFeature {
  const pts = catmullRom(points);
  return {
    pts,
    hw,
    minX: Math.min(...pts.map((p) => p.x)) - hw - 4,
    maxX: Math.max(...pts.map((p) => p.x)) + hw + 4,
    minY: Math.min(...pts.map((p) => p.y)) - hw - 4,
    maxY: Math.max(...pts.map((p) => p.y)) + hw + 4,
  };
}

const toLogical = (p: Pt): Pt => ({ x: Math.round(p.x / PIXEL_SCALE), y: Math.round(p.y / PIXEL_SCALE) });

// ── Baker ───────────────────────────────────────────────────────────────────
class SceneBaker {
  private readonly ground: PixelCanvas;
  private readonly fg: PixelCanvas;
  private readonly noise: ValueNoise;
  private readonly rand: () => number;
  private readonly dirt: Uint8Array;
  private readonly blocked: Uint8Array;
  private readonly cliff: Int16Array;
  private readonly trees: TreeInfo[] = [];
  private readonly tufts: SwayTuft[] = [];
  private readonly w: number;
  private readonly h: number;
  private static readonly FACE_H = 9;

  constructor(w: number, h: number, seed: number) {
    this.w = w;
    this.h = h;
    this.ground = new PixelCanvas(w, h);
    this.fg = new PixelCanvas(w, h);
    this.noise = new ValueNoise(seed);
    this.rand = mulberry32(seed ^ 0x9e3779b9);
    this.dirt = new Uint8Array(w * h);
    this.blocked = new Uint8Array(w * h);
    this.cliff = new Int16Array(w);
  }

  public bake(stations: readonly Workstation[]): BakedScene {
    const fire = stations.find((s) => s.id === 'camp_fire');
    const forge = stations.find((s) => s.id === 'forge_anvil');
    const desk = stations.find((s) => s.id === 'writing_desk');
    const fireP = fire ? toLogical(fire.position) : null;
    const forgeP = forge ? toLogical(forge.position) : null;
    const deskP = desk ? toLogical(desk.position) : null;

    this.computeCliff();
    this.paintGrass();

    const paths: PathFeature[] = [
      makePath(
        [
          { x: 214, y: -12 },
          { x: 222, y: 30 },
          { x: 244, y: 75 },
          { x: 268, y: 115 },
          { x: 278, y: 155 },
          { x: 264, y: 200 },
          { x: 246, y: 240 },
          { x: 238, y: 290 },
        ],
        13,
      ),
    ];
    const clearings: { x: number; y: number; r: number }[] = [];
    if (fireP) {
      clearings.push({ x: fireP.x, y: fireP.y + 4, r: 23 });
      paths.push(
        makePath(
          [fireP, { x: fireP.x + 28, y: fireP.y - 6 }, { x: fireP.x + 56, y: fireP.y - 9 }, { x: 272, y: 126 }],
          6,
        ),
      );
      if (deskP) {
        paths.push(
          makePath(
            [fireP, { x: fireP.x - 22, y: fireP.y + 18 }, { x: fireP.x - 50, y: fireP.y + 34 }, { x: deskP.x + 6, y: deskP.y }],
            4,
          ),
        );
      }
    }
    if (forgeP) {
      paths.push(makePath([{ x: 256, y: forgeP.y + 1 }, { x: forgeP.x - 6, y: forgeP.y + 2 }], 4));
    }

    this.paintDirt(paths, clearings);
    this.paintRuts(paths[0]);
    this.paintCliff();
    if (forgeP) this.paintFlagstones(forgeP.x, forgeP.y + 3, 14);
    if (deskP) this.paintDeck(deskP.x, deskP.y);
    this.paintPebbles();

    if (fireP) this.paintCampfire(fireP.x, fireP.y);
    if (fireP) {
      this.paintLog(fireP.x - 32, fireP.y + 16, 16);
      this.paintLog(fireP.x + 8, fireP.y - 20, 16);
    }
    if (forgeP) this.paintForge(forgeP.x, forgeP.y);
    if (deskP) this.paintDesk(deskP.x, deskP.y);
    this.paintSignpost(258, 142);

    const rocks: [number, number, number, boolean][] = [
      [247, 40, 7, true],
      [168, 108, 5, false],
      [345, 182, 9, true],
      [312, 232, 6, false],
      [150, 240, 8, true],
      [60, 95, 5, false],
      [330, 40, 4, false],
      [205, 222, 3, false],
      [96, 140, 4, true],
    ];
    for (const [x, y, r, mossy] of rocks) this.paintRock(x, y, r, mossy);

    this.paintStump(334, 126);
    this.paintLog(44, 238, 16);

    for (const [x, y] of [
      [300, 214],
      [305, 219],
      [297, 221],
      [338, 108],
    ]) {
      this.paintMushroom(x, y, false);
    }
    for (const [x, y] of [
      [44, 178],
      [49, 182],
      [125, 52],
    ]) {
      this.paintMushroom(x, y, true);
    }

    for (const [x, y] of [
      [44, 152],
      [360, 154],
      [378, 232],
      [92, 268],
      [134, 32],
      [48, 46],
      [10, 226],
      [306, 268],
    ]) {
      this.paintFern(x, y);
    }

    this.paintGroundCover();

    const trees: [number, number, number][] = [
      [22, 44, 24],
      [68, 34, 27],
      [116, 24, 22],
      [154, 8, 18],
      [26, 150, 25],
      [18, 222, 27],
      [66, 270, 24],
      [386, 58, 28],
      [372, 150, 25],
      [392, 226, 27],
      [326, 278, 24],
    ];
    const bushes: [number, number, number][] = [
      [140, 215, 9],
      [330, 200, 8],
      [196, 44, 8],
      [356, 246, 9],
      [160, 92, 8],
      [92, 200, 7],
    ];
    const all = [
      ...trees.map(([x, y, r]) => ({ x, y, r, bush: false })),
      ...bushes.map(([x, y, r]) => ({ x, y, r, bush: true })),
    ].sort((a, b) => a.y - b.y);
    for (const t of all) this.paintTree(t.x, t.y, t.r, t.bush);

    return {
      ground: this.ground.toCanvas(),
      foreground: this.fg.toCanvas(),
      trees: this.trees,
      tufts: this.tufts,
    };
  }

  // ── Masks ─────────────────────────────────────────────────────────────────
  private idx(x: number, y: number): number {
    return y * this.w + x;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  private block(x: number, y: number, w: number, h: number): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.blocked[this.idx(xx, yy)] = 1;
    }
  }

  private inCliffFace(x: number, y: number): boolean {
    const top = this.cliff[x];
    return y >= top - 1 && y < top + SceneBaker.FACE_H + 2;
  }

  private isGrass(x: number, y: number): boolean {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    return !this.dirt[i] && !this.blocked[i] && !this.inCliffFace(x, y);
  }

  // ── Terrain ───────────────────────────────────────────────────────────────
  private computeCliff(): void {
    for (let x = 0; x < this.w; x++) {
      if (x > 178) {
        this.cliff[x] = -1000;
        continue;
      }
      let y = 62 + Math.sin(x * 0.07) * 4 + (this.noise.noise(x * 0.12, 3.7) - 0.5) * 6;
      if (x > 132) y -= ((x - 132) / 44) ** 2 * 72;
      this.cliff[x] = Math.round(y);
    }
  }

  private paintGrass(): void {
    const { noise } = this;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let v = noise.fbm(x * 0.035, y * 0.035, 4) * 0.7 + noise.fbm(x * 0.22 + 50, y * 0.22 + 50, 2) * 0.3;
        v = (v - 0.22) / 0.56;
        if (y < this.cliff[x]) v += 0.14; // sunlit plateau
        let i = quantize(v, GRASS.length, x, y, 1.2);
        // Leafy micro texture: little highlight/shadow pixel pairs like hand-painted grass tiles.
        const leaf = hash2(x, y);
        if (leaf < 0.05) i = Math.min(GRASS.length - 1, i + 1);
        else if (leaf > 0.95) i = Math.max(0, i - 1);
        this.ground.set(x, y, GRASS[i]);
      }
    }
  }

  private paintDirt(paths: readonly PathFeature[], clearings: readonly { x: number; y: number; r: number }[]): void {
    const { noise } = this;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let field = Infinity;
        for (const p of paths) {
          if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
          let d = Infinity;
          for (let i = 0; i < p.pts.length - 1; i++) d = Math.min(d, distToSegment(x, y, p.pts[i], p.pts[i + 1]));
          field = Math.min(field, d - p.hw);
        }
        for (const c of clearings) field = Math.min(field, Math.hypot(x - c.x, (y - c.y) * 1.2) - c.r);
        if (field > 4) continue;

        const e = field + (noise.fbm(x * 0.18 + 20, y * 0.18, 2) - 0.5) * 4.5;
        if (e < 0) {
          let v = noise.fbm(x * 0.08 + 7, y * 0.08, 3) * 0.6 + noise.noise(x * 0.6, y * 0.6) * 0.4;
          v = (v - 0.2) / 0.6;
          if (e > -1.2) v -= 0.4; // worn, shadowed rim
          else if (e > -2.6) v -= 0.18;
          this.ground.set(x, y, DIRT[quantize(v, DIRT.length, x, y, 1)]);
          this.dirt[this.idx(x, y)] = 1;
          // Grass blades poking into the path edge.
          if (e > -1.4 && hash2(x + 999, y) < 0.22) {
            this.ground.set(x, y, GRASS[2]);
            this.ground.set(x, y - 1, GRASS[3]);
          }
        } else if (e < 1.8) {
          this.ground.blend(x, y, SHADOW, e < 0.9 ? 0.28 : 0.14);
        }
      }
    }
  }

  private paintRuts(path: PathFeature): void {
    for (let i = 0; i < path.pts.length - 1; i++) {
      const a = path.pts[i];
      const b = path.pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      for (const side of [-1, 1]) {
        for (let t = 0; t < 1; t += 0.25) {
          const x = Math.round(a.x + (b.x - a.x) * t + nx * side * path.hw * 0.42);
          const y = Math.round(a.y + (b.y - a.y) * t + ny * side * path.hw * 0.42);
          if (this.inBounds(x, y) && this.dirt[this.idx(x, y)] && this.noise.noise(x * 0.3, y * 0.3) > 0.35) {
            this.ground.blend(x, y, DIRT_DARK, 0.4);
          }
        }
      }
    }
  }

  private paintCliff(): void {
    const FACE_H = SceneBaker.FACE_H;
    for (let x = 0; x < this.w; x++) {
      const top = this.cliff[x];
      if (top < -50) continue;
      const drip = Math.floor(hash2(x, 77) * 3);
      for (let k = 0; k < FACE_H; k++) {
        const y = top + k;
        let v = 0.75 - (k / FACE_H) * 0.45 + (this.noise.noise(x * 0.5, y * 0.9) - 0.5) * 0.5;
        if (this.noise.noise(x * 0.8, 99) > 0.72) v -= 0.35; // vertical cracks
        if ((k + Math.floor(this.noise.noise(x * 0.2, 5) * 3)) % 4 === 0) v -= 0.12; // strata
        this.ground.set(x, y, CLIFF[quantize(v, CLIFF.length, x, y, 1)]);
      }
      this.ground.set(x, top - 1, GRASS_HI);
      this.ground.set(x, top, GRASS[3]);
      for (let k = 1; k <= drip; k++) this.ground.set(x, top + k, GRASS[k === drip ? 1 : 2]);
      for (let k = 0; k < 3; k++) this.ground.blend(x, top + FACE_H + k, SHADOW, 0.45 - k * 0.14);
    }
    // Hanging roots.
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(this.rand() * 170);
      const top = this.cliff[x];
      if (top < 0) continue;
      const len = 3 + Math.floor(this.rand() * 4);
      for (let k = 2; k < 2 + len; k++) this.ground.set(x + (k > 4 ? 1 : 0), top + k, BARK[2]);
    }
  }

  private paintPebbles(): void {
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(this.rand() * this.w);
      const y = Math.floor(this.rand() * this.h);
      if (!this.inBounds(x, y) || !this.dirt[this.idx(x, y)] || this.blocked[this.idx(x, y)]) continue;
      if (this.rand() < 0.55) {
        this.ground.set(x, y, this.rand() < 0.5 ? DIRT[4] : DIRT[0]);
        continue;
      }
      const big = this.rand() < 0.4;
      const body = this.rand() < 0.5 ? STONE[2] : hex('#8c7c62');
      this.ground.set(x + 1, y + 1, DIRT_DARK);
      this.ground.set(x, y, body);
      if (big) {
        this.ground.set(x + 1, y, body);
        this.ground.set(x, y + 1, body);
        this.ground.set(x + 2, y + 1, DIRT_DARK);
        this.ground.set(x + 1, y + 2, DIRT_DARK);
        this.ground.set(x + 1, y + 1, STONE[1]);
      }
      this.ground.set(x, y, STONE[4]);
    }
  }

  private paintGroundCover(): void {
    // Clover patches.
    for (let i = 0; i < 22; i++) {
      const cx = Math.floor(this.rand() * this.w);
      const cy = Math.floor(this.rand() * this.h);
      for (let j = 0; j < 5; j++) {
        const x = cx + Math.floor((this.rand() - 0.5) * 10);
        const y = cy + Math.floor((this.rand() - 0.5) * 6);
        if (!this.isGrass(x, y) || !this.isGrass(x + 1, y + 1)) continue;
        this.ground.set(x, y, GRASS[4]);
        this.ground.set(x + 1, y, GRASS_HI);
        this.ground.set(x, y + 1, GRASS[4]);
        this.ground.set(x + 1, y + 1, GRASS[1]);
      }
    }

    // Grass tufts.
    for (let i = 0; i < 520; i++) {
      const x = Math.floor(this.rand() * this.w);
      const y = Math.floor(this.rand() * this.h);
      if (!this.isGrass(x, y)) continue;
      this.paintTuft(x, y);
    }

    // Tall swaying tufts are animated at runtime, not baked.
    for (let i = 0; i < 220 && this.tufts.length < 46; i++) {
      const x = Math.floor(this.rand() * this.w);
      const y = Math.floor(this.rand() * this.h);
      if (!this.isGrass(x, y) || !this.isGrass(x, y - 5)) continue;
      this.tufts.push({ x, y, h: 4 + Math.floor(this.rand() * 3) });
      this.ground.set(x - 1, y + 1, GRASS[0]);
      this.ground.set(x, y + 1, GRASS[0]);
      this.ground.set(x + 1, y + 1, GRASS[0]);
    }

    // Wildflower clusters.
    for (let i = 0; i < 32; i++) {
      const cx = Math.floor(this.rand() * this.w);
      const cy = Math.floor(this.rand() * this.h);
      if (!this.isGrass(cx, cy)) continue;
      const [petal, centre] = FLOWER_COLORS[Math.floor(this.rand() * FLOWER_COLORS.length)];
      const count = 3 + Math.floor(this.rand() * 4);
      for (let j = 0; j < count; j++) {
        const x = cx + Math.round((this.rand() - 0.5) * 11);
        const y = cy + Math.round((this.rand() - 0.5) * 7);
        if (!this.isGrass(x, y) || !this.isGrass(x, y + 1)) continue;
        this.ground.set(x, y + 1, GRASS[0]);
        this.ground.set(x, y + 2, GRASS[1]);
        if (this.rand() < 0.5) {
          this.ground.set(x - 1, y, petal);
          this.ground.set(x + 1, y, petal);
          this.ground.set(x, y - 1, petal);
          this.ground.set(x, y + 1, petal);
          this.ground.set(x, y, centre);
        } else {
          this.ground.set(x, y, petal);
          this.ground.set(x + 1, y, centre);
        }
      }
    }
  }

  private paintTuft(x: number, y: number): void {
    const n = 3 + Math.floor(this.rand() * 3);
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2;
      const hgt = 2 + Math.floor(this.rand() * 2);
      for (let k = 0; k < hgt; k++) {
        const px = Math.round(x + off + off * 0.5 * (k / hgt));
        const c = k === 0 ? GRASS[0] : k === hgt - 1 ? GRASS_HI : GRASS[3];
        this.ground.set(px, y - k, c);
      }
    }
  }

  // ── Props ─────────────────────────────────────────────────────────────────
  private paintShadow(cx: number, cy: number, rx: number, ry: number, alpha: number, target = this.ground): void {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        if (d > 0.7 && bayer(x, y) < (d - 0.7) / 0.3) continue;
        target.blend(x, y, SHADOW, alpha);
      }
    }
  }

  private paintFlagstones(cx: number, cy: number, r: number): void {
    const mortar = hex('#3f3a36');
    for (let y = cy - r - 1; y <= cy + r + 1; y++) {
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.25) + (this.noise.noise(x * 0.4, y * 0.4) - 0.5) * 3;
        if (d > r + 1.5) continue;
        if (d > r) {
          this.ground.blend(x, y, SHADOW, 0.35);
          continue;
        }
        const row = Math.floor(y / 4);
        const off = (((row % 2) + 2) % 2) * 3;
        const col = Math.floor((x + off) / 6);
        const ly = ((y % 4) + 4) % 4;
        const lx = (((x + off) % 6) + 6) % 6;
        if (ly === 0 || lx === 0) {
          this.ground.set(x, y, mortar);
        } else {
          let v = 0.45 + hash2(col, row) * 0.35 + (this.noise.noise(x * 0.8, y * 0.8) - 0.5) * 0.2;
          if (ly === 1) v += 0.2;
          if (lx === 5 || ly === 3) v -= 0.15;
          if (d > r - 1.5) v -= 0.2;
          this.ground.set(x, y, STONE[1 + quantize(v, 4, x, y, 0.8)]);
        }
        this.blocked[this.idx(Math.max(0, Math.min(this.w - 1, x)), Math.max(0, Math.min(this.h - 1, y)))] = 1;
      }
    }
  }

  private paintDeck(dx: number, dy: number): void {
    const x0 = dx - 15;
    const y0 = dy - 16;
    const w = 30;
    const h = 22;
    for (let y = y0; y < y0 + h; y++) {
      const row = Math.floor((y - y0) / 4);
      const k = (y - y0) % 4;
      const seam = x0 + ((row * 11 + 7) % (w - 4)) + 2;
      for (let x = x0; x < x0 + w; x++) {
        let c = row % 2 ? WOOD.mid : WOOD.alt;
        if (k === 3 || x === seam) c = WOOD.gap;
        else if (k === 0) c = WOOD.light;
        else if (this.noise.noise(x * 0.5, y * 3) > 0.68) c = WOOD.grain;
        if ((x === seam - 1 || x === seam + 1) && k === 1) c = WOOD.outline;
        if (x === x0 || x === x0 + w - 1) c = WOOD.outline;
        this.ground.set(x, y, c);
      }
    }
    for (let x = x0; x < x0 + w; x++) {
      this.ground.set(x, y0 - 1, WOOD.outline);
      this.ground.set(x, y0 + h, WOOD.dark);
      this.ground.set(x, y0 + h + 1, WOOD.dark);
      this.ground.set(x, y0 + h + 2, WOOD.outline);
      this.ground.blend(x + 2, y0 + h + 3, SHADOW, 0.4);
    }
    this.block(x0 - 1, y0 - 1, w + 2, h + 4);
  }

  private paintCampfire(fx: number, fy: number): void {
    // Ash bed.
    for (let y = fy - 6; y <= fy + 6; y++) {
      for (let x = fx - 8; x <= fx + 8; x++) {
        const d = ((x - fx) / 7) ** 2 + ((y - fy) / 5) ** 2;
        if (d >= 1) continue;
        const v = this.noise.noise(x * 0.9, y * 0.9);
        this.ground.set(x, y, hex(v > 0.6 ? '#5a524c' : v > 0.35 ? '#3e3733' : '#2a2421'));
      }
    }
    // Stone ring.
    const stones = 11;
    for (let i = 0; i < stones; i++) {
      const a = (i / stones) * Math.PI * 2;
      const sx = Math.round(fx + Math.cos(a) * 9) - 1;
      const sy = Math.round(fy + Math.sin(a) * 6.5) - 1;
      this.ground.rect(sx - 1, sy - 1, 5, 4, STONE_OUTLINE);
      this.ground.rect(sx, sy, 3, 1, STONE[3]);
      this.ground.set(sx, sy, STONE[4]);
      this.ground.rect(sx, sy + 1, 3, 1, STONE[2]);
      this.ground.set(sx + 2, sy + 1, STONE[1]);
    }
    // Crossed logs.
    const logLine = (x0: number, y0: number, x1: number, y1: number) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps);
        const y = Math.round(y0 + ((y1 - y0) * s) / steps);
        const charred = s < 2 || s > steps - 2;
        this.ground.set(x, y, charred ? hex('#1e1714') : BARK[3]);
        this.ground.set(x, y + 1, charred ? hex('#140f0d') : BARK[1]);
      }
    };
    logLine(fx - 6, fy + 1, fx + 5, fy - 2);
    logLine(fx - 5, fy - 2, fx + 5, fy + 2);
    // Glowing coals.
    for (const [x, y, c] of [
      [fx - 1, fy, '#ff7a2a'],
      [fx + 1, fy + 1, '#ffb14a'],
      [fx, fy + 2, '#e8452c'],
      [fx + 2, fy - 1, '#ff7a2a'],
    ] as const) {
      this.ground.set(x, y, hex(c));
    }
    this.block(fx - 11, fy - 9, 23, 18);
  }

  private paintLog(x0: number, y: number, len: number): void {
    for (let x = x0; x < x0 + len; x++) {
      this.ground.blend(x + 1, y + 3, SHADOW, 0.45);
      this.ground.blend(x + 1, y + 4, SHADOW, 0.25);
      this.ground.set(x, y - 3, BARK_OUTLINE);
      const furrow = this.noise.noise(x * 0.9, y) > 0.66;
      this.ground.set(x, y - 2, furrow ? BARK[2] : BARK[3]);
      this.ground.set(x, y - 1, furrow ? BARK[1] : BARK[2]);
      this.ground.set(x, y, BARK[1]);
      this.ground.set(x, y + 1, BARK[0]);
      this.ground.set(x, y + 2, BARK_OUTLINE);
      if (this.noise.fbm(x * 0.4 + 30, y, 2) > 0.6) this.ground.set(x, y - 2, MOSS[1]);
    }
    // End grain.
    const ex = x0 + len;
    const ring = [hex('#c49a64'), hex('#9a7244')];
    for (let k = -2; k <= 1; k++) {
      this.ground.set(ex, y + k, ring[Math.abs(k) % 2]);
      this.ground.set(ex + 1, y + k, ring[0]);
    }
    this.ground.set(ex + 1, y - 1, ring[1]);
    for (let k = -3; k <= 2; k++) this.ground.set(ex + 2, y + k, BARK_OUTLINE);
    for (let k = -3; k <= 2; k++) this.ground.set(x0 - 1, y + k, BARK_OUTLINE);
    this.block(x0 - 1, y - 3, len + 3, 7);
  }

  private paintForge(fx: number, fy: number): void {
    // Stump the anvil sits on.
    this.paintShadow(fx + 2, fy + 3, 8, 3, 0.45);
    for (let y = fy - 3; y <= fy + 2; y++) {
      for (let x = fx - 5; x <= fx + 3; x++) {
        const u = (x - (fx - 5)) / 8;
        let c = BARK[u < 0.3 ? 3 : u < 0.7 ? 2 : 1];
        if (y === fy - 3) c = hex('#b88a55');
        if (x === fx - 5 || x === fx + 3 || y === fy + 2) c = BARK_OUTLINE;
        this.ground.set(x, y, c);
      }
    }
    this.ground.drawRows(ANVIL_ROWS, ANVIL_PALETTE, fx - 6, fy - 9);
    // Barrel and a hammer leaning on the stump.
    this.paintShadow(fx + 14, fy + 1, 5, 2, 0.4);
    this.ground.drawRows(BARREL_ROWS, BARREL_PALETTE, fx + 10, fy - 7);
    for (let k = 0; k < 6; k++) this.ground.set(fx - 7, fy - 4 + k, hex('#7a4a26'));
    this.ground.rect(fx - 9, fy - 5, 5, 2, hex('#5a646c'));
    this.ground.set(fx - 9, fy - 5, hex('#9aa6ae'));
    this.block(fx - 10, fy - 10, 28, 14);
  }

  private paintDesk(dx: number, dy: number): void {
    const o = WOOD.outline;
    this.ground.rect(dx - 11, dy - 13, 22, 11, o);
    this.ground.rect(dx - 10, dy - 12, 20, 6, hex('#a8743f'));
    this.ground.rect(dx - 10, dy - 12, 20, 1, hex('#c48d52'));
    this.ground.rect(dx - 10, dy - 6, 20, 3, WOOD.dark);
    this.ground.rect(dx - 9, dy - 3, 2, 3, o);
    this.ground.rect(dx + 7, dy - 3, 2, 3, o);
    for (let x = dx - 9; x < dx + 11; x++) this.ground.blend(x, dy, SHADOW, 0.35);
    // Parchment with writing.
    this.ground.rect(dx - 7, dy - 11, 7, 4, hex('#efe6c8'));
    this.ground.rect(dx - 6, dy - 10, 4, 1, hex('#9a8f72'));
    this.ground.rect(dx - 6, dy - 8, 5, 1, hex('#9a8f72'));
    // Stack of books.
    this.ground.rect(dx + 1, dy - 11, 5, 2, hex('#8a2f2f'));
    this.ground.rect(dx + 1, dy - 12, 5, 1, hex('#2f4f8a'));
    this.ground.rect(dx + 2, dy - 13, 4, 1, hex('#4f7a3a'));
    this.ground.set(dx + 1, dy - 11, hex('#e8d9b0'));
    // Ink pot + quill.
    this.ground.rect(dx - 9, dy - 11, 2, 2, hex('#1b1424'));
    this.ground.set(dx - 9, dy - 11, hex('#4a5a8a'));
    this.ground.set(dx - 8, dy - 12, hex('#f4f4f4'));
    this.ground.set(dx - 7, dy - 13, hex('#f4f4f4'));
    // Candle (flame is animated).
    this.ground.rect(dx + 7, dy - 9, 3, 1, hex('#c9a24a'));
    this.ground.rect(dx + 8, dy - 11, 1, 2, hex('#f2e8d0'));
    // Stool.
    this.ground.rect(dx - 3, dy + 2, 6, 3, o);
    this.ground.rect(dx - 2, dy + 2, 4, 1, hex('#a8743f'));
    this.ground.rect(dx - 2, dy + 3, 4, 1, WOOD.dark);
  }

  private paintSignpost(sx: number, sy: number): void {
    this.paintShadow(sx + 3, sy + 1, 5, 2, 0.4);
    for (let y = sy - 9; y <= sy; y++) {
      this.ground.set(sx, y, BARK[2]);
      this.ground.set(sx + 1, y, BARK[1]);
    }
    this.ground.rect(sx - 6, sy - 13, 13, 6, WOOD.outline);
    this.ground.rect(sx - 5, sy - 12, 11, 4, hex('#a8743f'));
    this.ground.rect(sx - 5, sy - 12, 11, 1, hex('#c48d52'));
    this.ground.set(sx + 7, sy - 11, WOOD.outline);
    this.ground.set(sx + 7, sy - 10, WOOD.outline);
    this.ground.set(sx + 6, sy - 11, hex('#a8743f'));
    this.ground.set(sx + 6, sy - 10, hex('#a8743f'));
    for (let x = sx - 3; x <= sx + 3; x += 2) this.ground.set(x, sy - 10, hex('#3a2414'));
    this.block(sx - 6, sy - 13, 14, 15);
  }

  private paintRock(cx: number, cy: number, r: number, mossy: boolean): void {
    this.paintShadow(cx + r * 0.35, cy + r * 0.6, r * 1.15, r * 0.5, 0.45);
    const blobs = [
      { x: cx, y: cy, rx: r, ry: r * 0.78, z: r * 0.3 },
      { x: cx - r * 0.45, y: cy + r * 0.2, rx: r * 0.6, ry: r * 0.5, z: 0 },
      { x: cx + r * 0.5, y: cy + r * 0.15, rx: r * 0.55, ry: r * 0.45, z: 0 },
    ];
    const x0 = Math.floor(cx - r * 1.2 - 1);
    const y0 = Math.floor(cy - r - 1);
    const bw = Math.ceil(r * 2.4) + 3;
    const bh = Math.ceil(r * 2) + 3;
    const mask = new Uint8Array(bw * bh);

    for (let y = y0; y < y0 + bh; y++) {
      for (let x = x0; x < x0 + bw; x++) {
        let best = -Infinity;
        let nx = 0;
        let ny = 0;
        let nz = 0;
        for (const b of blobs) {
          const dx = (x + 0.5 - b.x) / b.rx;
          const dy = (y + 0.5 - b.y) / b.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 1) continue;
          const hgt = Math.sqrt(1 - d2) * b.rx + b.z;
          if (hgt > best) {
            best = hgt;
            nx = dx;
            ny = dy;
            nz = Math.sqrt(1 - d2);
          }
        }
        if (best === -Infinity) continue;
        mask[(y - y0) * bw + (x - x0)] = 1;
        // Faceted look: snap normals to a coarse grid.
        nx = Math.round(nx * 2.5) / 2.5;
        ny = Math.round(ny * 2.5) / 2.5;
        nz = Math.round(nz * 2.5) / 2.5;
        const len = Math.hypot(nx, ny, nz) || 1;
        let v = ((nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z) / len) * 0.5 + 0.5;
        v += (this.noise.noise(x * 0.7, y * 0.7) - 0.5) * 0.25;
        if (mossy && ny < -0.2 && this.noise.fbm(x * 0.4 + 9, y * 0.4, 2) > 0.48) {
          this.ground.set(x, y, MOSS[v > 0.6 ? 1 : 0]);
        } else {
          this.ground.set(x, y, STONE[quantize(v, STONE.length, x, y, 0.8)]);
        }
      }
    }
    this.outlineMask(mask, x0, y0, bw, bh, STONE_OUTLINE, this.ground);

    // Crack.
    if (r >= 5) {
      let x = Math.round(cx - r * 0.2);
      let y = Math.round(cy - r * 0.3);
      for (let s = 0; s < r; s++) {
        const mi = (y - y0) * bw + (x - x0);
        if (mi >= 0 && mi < mask.length && mask[mi]) this.ground.set(x, y, STONE[0]);
        x += this.rand() < 0.6 ? 1 : 0;
        y += 1;
      }
    }
    this.block(x0, y0, bw, bh);
  }

  private paintStump(x: number, y: number): void {
    this.paintShadow(x + 3, y + 1, 7, 3, 0.45);
    for (let yy = y - 4; yy <= y; yy++) {
      for (let xx = x - 4; xx <= x + 4; xx++) {
        const u = (xx - (x - 4)) / 8;
        this.ground.set(xx, yy, BARK[u < 0.3 ? 3 : u < 0.7 ? 2 : 1]);
      }
      this.ground.set(x - 5, yy, BARK_OUTLINE);
      this.ground.set(x + 5, yy, BARK_OUTLINE);
    }
    for (let yy = y - 7; yy <= y - 4; yy++) {
      for (let xx = x - 4; xx <= x + 4; xx++) {
        const d = Math.hypot((xx - x) / 4.5, (yy - (y - 5.5)) / 2);
        if (d > 1) continue;
        this.ground.set(xx, yy, d > 0.8 ? hex('#5a3a22') : Math.floor(d * 4) % 2 ? hex('#a97d4a') : hex('#c99d63'));
      }
    }
    // Roots + base outline.
    this.ground.set(x - 6, y, BARK[1]);
    this.ground.set(x + 6, y, BARK[0]);
    for (let xx = x - 6; xx <= x + 6; xx++) this.ground.set(xx, y + 1, BARK_OUTLINE);
    this.block(x - 6, y - 8, 13, 10);
  }

  private paintMushroom(x: number, y: number, red: boolean): void {
    const cap = red ? ['#8f2a20', '#c8402f', '#e8705a'].map(hex) : ['#8f6d44', '#c9a46c', '#ead2a0'].map(hex);
    const out = hex('#2e2018');
    this.ground.blend(x + 1, y + 1, SHADOW, 0.45);
    this.ground.blend(x + 2, y + 1, SHADOW, 0.3);
    this.ground.set(x, y, hex('#c9bc9e'));
    this.ground.set(x, y - 1, hex('#efe4cc'));
    for (let dx = -2; dx <= 2; dx++) this.ground.set(x + dx, y - 2, cap[0]);
    for (let dx = -2; dx <= 2; dx++) this.ground.set(x + dx, y - 3, dx === 2 ? cap[0] : cap[1]);
    for (let dx = -1; dx <= 1; dx++) this.ground.set(x + dx, y - 4, cap[1]);
    this.ground.set(x - 1, y - 4, cap[2]);
    this.ground.set(x - 1, y - 3, cap[2]);
    if (red) {
      this.ground.set(x + 1, y - 4, hex('#f4efe6'));
      this.ground.set(x - 2, y - 3, hex('#f4efe6'));
    }
    for (const [ox, oy] of [
      [-3, -3],
      [3, -3],
      [-3, -2],
      [3, -2],
      [-2, -4],
      [2, -4],
      [-1, -5],
      [0, -5],
      [1, -5],
    ]) {
      this.ground.set(x + ox, y + oy, out);
    }
    this.block(x - 3, y - 5, 7, 7);
  }

  private paintFern(x: number, y: number): void {
    for (const a0 of [-2.6, -2.1, -1.57, -1.05, -0.55]) {
      const a = a0 + (this.rand() - 0.5) * 0.2;
      const len = 5 + Math.floor(this.rand() * 4);
      for (let t = 0; t <= len; t++) {
        const px = Math.round(x + Math.cos(a) * t);
        const py = Math.round(y + Math.sin(a) * t * 0.75 + t * t * 0.05);
        this.ground.set(px, py, t < len * 0.5 ? LEAF[2] : LEAF[3]);
        if (t > 0 && t % 2 === 0 && t < len) {
          this.ground.set(px, py - 1, LEAF[4]);
          this.ground.set(px, py + 1, LEAF[1]);
        }
      }
    }
    this.block(x - 8, y - 8, 17, 10);
  }

  private paintTrunk(bx: number, by: number, r: number): void {
    const tw = Math.max(4, Math.round(r * 0.22));
    const left = Math.round(bx - tw / 2);
    const top = Math.round(by - r * 0.62);
    for (let y = top; y <= by; y++) {
      for (let i = 0; i < tw; i++) {
        const x = left + i;
        const u = i / (tw - 1);
        let k = u < 0.25 ? 3 : u < 0.55 ? 2 : u < 0.85 ? 1 : 0;
        if (this.noise.noise(x * 1.3, y * 0.35) > 0.68) k = Math.max(0, k - 1);
        this.ground.set(x, y, BARK[k]);
      }
      this.ground.set(left - 1, y, BARK_OUTLINE);
      this.ground.set(left + tw, y, BARK_OUTLINE);
    }
    this.ground.set(left - 2, by, BARK[2]);
    this.ground.set(left - 1, by, BARK[2]);
    this.ground.set(left + tw, by, BARK[1]);
    this.ground.set(left + tw + 1, by, BARK[0]);
    for (let x = left - 3; x <= left + tw + 2; x++) this.ground.set(x, by + 1, BARK_OUTLINE);
    this.ground.set(left - 3, by, BARK_OUTLINE);
    this.ground.set(left + tw + 2, by, BARK_OUTLINE);
    this.block(left - 3, top, tw + 6, by - top + 2);
  }

  private paintTree(bx: number, by: number, r: number, bush: boolean): void {
    const target = bush ? this.ground : this.fg;
    this.paintShadow(bx + r * 0.3, by + (bush ? r * 0.2 : 1), r * (bush ? 1.0 : 1.05), r * 0.42, 0.42);
    if (!bush) this.paintTrunk(bx, by, r);

    const cx = bx;
    const cy = by - (bush ? r * 0.5 : r * 0.78);
    const blobs = [{ x: cx, y: cy, r: r * 0.62, z: r * 0.35 }];
    const n = bush ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rand() * 0.6;
      const d = r * (0.32 + this.rand() * 0.18);
      blobs.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.85, r: r * (0.36 + this.rand() * 0.14), z: 0 });
    }

    const x0 = Math.floor(cx - r - 2);
    const y0 = Math.floor(cy - r - 2);
    const bw = Math.ceil(r * 2) + 5;
    const bh = Math.ceil(r * 2) + 5;
    const mask = new Uint8Array(bw * bh);
    const seed = this.rand() * 100;

    for (let y = y0; y < y0 + bh; y++) {
      for (let x = x0; x < x0 + bw; x++) {
        let best = -Infinity;
        let hit = -1;
        for (let i = 0; i < blobs.length; i++) {
          const b = blobs[i];
          const dx = x + 0.5 - b.x;
          const dy = y + 0.5 - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= b.r * b.r) continue;
          const hgt = Math.sqrt(b.r * b.r - d2) + b.z;
          if (hgt > best) {
            best = hgt;
            hit = i;
          }
        }
        if (hit < 0) continue;
        mask[(y - y0) * bw + (x - x0)] = 1;
        const b = blobs[hit];
        const nx = (x + 0.5 - b.x) / b.r;
        const ny = (y + 0.5 - b.y) / b.r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let v = (nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z) * 0.5 + 0.5;
        v += (this.noise.fbm(x * 0.3 + seed, y * 0.3 + seed, 3) - 0.5) * 0.6; // leaf clumps
        v -= Math.max(0, (y - cy) / r) * 0.22;
        target.set(x, y, LEAF[quantize(clamp01(v), LEAF.length, x, y, 0.9)]);
        if (v > 0.82 && hash2(x, y + 31) < 0.25) target.set(x, y, LEAF_SPARKLE);
      }
    }
    this.outlineMask(mask, x0, y0, bw, bh, LEAF_OUTLINE, target);

    if (this.rand() < 0.35) {
      const berry = this.rand() < 0.5 ? hex('#d9493a') : hex('#f4efe6');
      for (let k = 0; k < 9; k++) {
        const x = Math.round(cx + (this.rand() - 0.5) * r * 1.2);
        const y = Math.round(cy + (this.rand() - 0.7) * r * 0.9);
        if (!mask[(y - y0) * bw + (x - x0)]) continue;
        target.set(x, y, berry);
        target.set(x, y + 1, LEAF[1]);
      }
    }

    // Fallen leaves scattered in the shade.
    for (let k = 0; k < (bush ? 4 : 12); k++) {
      const a = this.rand() * Math.PI * 2;
      const x = Math.round(bx + r * 0.3 + Math.cos(a) * r * (0.6 + this.rand() * 0.5));
      const y = Math.round(by + 2 + Math.sin(a) * r * 0.35);
      if (!this.isGrass(x, y)) continue;
      this.ground.set(x, y, [hex('#b08a3a'), hex('#c99a3e'), hex('#8a9a3a'), hex('#a8582a')][k % 4]);
    }

    if (!bush) this.trees.push({ x: cx, y: cy, r });
    else this.block(x0, y0, bw, bh);
  }

  private outlineMask(mask: Uint8Array, x0: number, y0: number, bw: number, bh: number, color: RGB, target: PixelCanvas): void {
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < bw && y < bh && mask[y * bw + x] === 1;
    for (let y = -1; y <= bh; y++) {
      for (let x = -1; x <= bw; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) target.set(x0 + x, y0 + y, color);
      }
    }
  }
}

/** Procedurally bakes the static parts of the clearing into two pixel layers. */
export function bakeScene(width: number, height: number, stations: readonly Workstation[], seed = 1337): BakedScene {
  return new SceneBaker(width, height, seed).bake(stations);
}

