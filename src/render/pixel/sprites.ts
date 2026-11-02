/**
 * Chibi pixel-art character sprites (big heads, dark outlines, tiny bodies),
 * defined as ASCII art so they stay readable and reviewable in code.
 */

export interface SpriteDef {
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
}

export type CharacterFrame = 'idle' | 'blink' | 'walkA' | 'walkB';
export type CharacterFrames = Readonly<Record<CharacterFrame, SpriteDef>>;

/** Sprite size in logical pixels. Feet sit on the bottom row. */
export const CHARACTER_WIDTH = 16;
export const CHARACTER_HEIGHT = 21;

/*
 * Template legend:
 *  k outline   X headwear / hair   x headwear highlight   h fringe   s skin   S skin shade
 *  e eye       r blush             m mouth                Y outerwear / sleeves
 *  c clothes   C clothes shade     a accent               l belt     p pants  b boots
 */
const BODY_TEMPLATE: readonly string[] = [
  '.....kkkkkk.....',
  '...kkXXXXXXkk...',
  '..kXXXxxxXXXXk..',
  '.kXXxxXXXXXXXXk.',
  '.kXXhhhhhhhhXXk.',
  'kXXhhhhhhhhhhXXk',
  'kXhsssssssssshXk',
  'kXsssessssessSXk',
  'kXsssessssessSXk',
  'kXrssssmmssssrXk',
  '.kXSSssssssSSXk.',
  '..kkXkSSSSkXkk..',
  '.kYYcccaacccYYk.',
  'kYYcccccccccCYYk',
  'kYscccccccccCsYk',
  'kYYllllalllllYYk',
  '.kYYccccCCCCYYk.',
  '..kYYppkkppYYk..',
];

const LEGS: Readonly<Record<'idle' | 'walkA' | 'walkB', readonly string[]>> = {
  idle: ['...kkppkkppkk...', '....kbbkkbbk....', '....kkkkkkkk....'],
  walkA: ['...kkppkkbbk....', '...kbbkkkkkk....', '...kkkk.........'],
  walkB: ['....kbbkkppkk...', '....kkkkkkbbk...', '.........kkkk...'],
};

interface CharacterSpec {
  palette: Readonly<Record<string, string>>;
  /** Row index → replacement row, for beards, glasses, robes... */
  overrides?: Readonly<Record<number, string>>;
}

function buildCharacter(spec: CharacterSpec): CharacterFrames {
  const body = BODY_TEMPLATE.map((row, i) => spec.overrides?.[i] ?? row);
  const blinkBody = body.map((row, i) => {
    if (i === 7) return row.replaceAll('e', 's');
    if (i === 8) return row.replaceAll('e', 'k');
    return row;
  });
  const make = (rows: readonly string[], legs: readonly string[]): SpriteDef => ({
    rows: [...rows, ...legs],
    palette: spec.palette,
  });
  return {
    idle: make(body, LEGS.idle),
    blink: make(blinkBody, LEGS.idle),
    walkA: make(body, LEGS.walkA),
    walkB: make(body, LEGS.walkB),
  };
}

const BASE_PALETTE = {
  k: '#1b1424',
  e: '#1b1424',
  s: '#f3c6a0',
  S: '#d69a72',
  r: '#f09a8a',
  m: '#b5674e',
  p: '#4a3b2e',
  b: '#2c1f18',
};

/** Rowan the Scout — green ranger hood and travelling cloak. */
export const SCOUT = buildCharacter({
  palette: {
    ...BASE_PALETTE,
    X: '#3f7a3a',
    x: '#62a04f',
    h: '#6b3f22',
    Y: '#2f5e2d',
    c: '#c8a46a',
    C: '#a07e4c',
    a: '#e8c860',
    l: '#5a3a22',
  },
});

/** Brann the Blacksmith — bushy beard, bare arms and a leather apron. */
export const BLACKSMITH = buildCharacter({
  palette: {
    ...BASE_PALETTE,
    s: '#e3ab7c',
    S: '#b97f55',
    X: '#4a2a1a',
    x: '#6e412a',
    h: '#4a2a1a',
    B: '#9a4c24',
    Y: '#e3ab7c',
    c: '#6b4a32',
    C: '#4f3524',
    a: '#9aa3ab',
    l: '#2c1f18',
  },
  overrides: {
    9: 'kXBBssmmssssBBXk',
    10: '.kXBBBBBBBBBBXk.',
    11: '..kkXBBBBBBXkk..',
    17: '..kkcppkkppckk..',
  },
});

/** Elowen the Scribe — long pale hair, gold spectacles and a violet robe. */
export const SCRIBE = buildCharacter({
  palette: {
    ...BASE_PALETTE,
    s: '#f6d2b4',
    S: '#dcae8c',
    X: '#e6d9a8',
    x: '#fff4c8',
    h: '#d1c08a',
    g: '#c9a24a',
    Y: '#4b3274',
    c: '#7a58b0',
    C: '#5b3f8a',
    a: '#e8c860',
    l: '#c9a24a',
    p: '#5b3f8a',
    b: '#3a2a52',
  },
  overrides: {
    7: 'kXsgggsssgggSSXk',
    8: 'kXsgegsssgegSSXk',
    17: '..kYYccCCccYYk..',
  },
});

/** Lyric the Bard — flamboyant blonde minstrel with a lute and royal purple doublet. */
export const BARD = buildCharacter({
  palette: {
    ...BASE_PALETTE,
    s: '#f8d7be',
    S: '#e0b090',
    X: '#f4d03f',
    x: '#fef5b8',
    h: '#e5be26',
    Y: '#8e44ad',
    c: '#9b59b6',
    C: '#6c3483',
    a: '#e67e22',
    l: '#d35400',
    p: '#5b2c6f',
    b: '#341c40',
  },
  overrides: {
    2: '..kXXXxxxFXXXk..',
    3: '.kXXxxXXFFFXXk.',
    12: '.kYYccaaccaaYYk.',
  },
});

/** Sir Patricia the Knight — full steel plate armor with golden visor slit. */
export const KNIGHT = buildCharacter({
  palette: {
    ...BASE_PALETTE,
    s: '#95a5a6',
    S: '#7f8c8d',
    X: '#bdc3c7',
    x: '#ecf0f1',
    h: '#95a5a6',
    Y: '#7f8c8d',
    c: '#c0392b',
    C: '#962d22',
    a: '#f39c12',
    l: '#f1c40f',
    p: '#7f8c8d',
    b: '#34495e',
    v: '#f1c40f',
  },
  overrides: {
    6: 'kXhhhhvvvvhhhhXk',
    7: 'kXssssvvvvssssSXk',
    8: 'kXssssvvvvssssSXk',
    13: 'kYYccccaaccaCYYk',
  },
});

const SHEEP_PALETTE = { k: '#2a2328', w: '#f4f0e6', W: '#cbc3b2', f: '#3d353a', e: '#f4f0e6' };

export const SHEEP_IDLE: SpriteDef = {
  palette: SHEEP_PALETTE,
  rows: [
    '....kkkkkk....',
    '..kkwwwwwwkk..',
    '.kwwwwwwwwwwk.',
    'kffkwwwwwwwwWk',
    'kfefwwwwwwwwWk',
    'kfffwwwwwwwWWk',
    '.kkkwwwwwwWWk.',
    '...kWWWWWWWk..',
    '...kfk..kfk...',
    '...kk....kk...',
  ],
};

export const SHEEP_GRAZE: SpriteDef = {
  palette: SHEEP_PALETTE,
  rows: [
    '....kkkkkk....',
    '..kkwwwwwwkk..',
    '.kwwwwwwwwwwk.',
    '.kkwwwwwwwwwWk',
    'kffkwwwwwwwwWk',
    'kfefwwwwwwwWWk',
    'kfffkwwwwwWWk.',
    '.kkkkWWWWWWk..',
    '...kfk..kfk...',
    '...kk....kk...',
  ],
};

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Rasterises (and caches) a sprite into a tiny canvas, optionally mirrored. */
export function getSprite(key: string, def: SpriteDef, flip = false): HTMLCanvasElement {
  const cacheKey = flip ? `${key}:flip` : key;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;

  const height = def.rows.length;
  const width = Math.max(...def.rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create sprite context');

  def.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = def.palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? width - 1 - x : x, y, 1, 1);
    }
  });

  spriteCache.set(cacheKey, canvas);
  return canvas;
}

