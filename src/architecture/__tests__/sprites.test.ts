import { describe, expect, it } from 'vitest';
import {
  BARD,
  BLACKSMITH,
  CHARACTER_HEIGHT,
  CHARACTER_WIDTH,
  KNIGHT,
  SCRIBE,
  SCOUT,
  SHEEP_GRAZE,
  SHEEP_IDLE,
  type CharacterFrames,
} from '../../render/pixel/sprites';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isValidHexColor(color: unknown): color is string {
  return typeof color === 'string' && HEX_COLOR_PATTERN.test(color.trim());
}

describe('Character Sprites & Palette Standards ("The No Invisible Feathers Rule")', () => {
  const characters: Record<string, CharacterFrames> = {
    Scout: SCOUT,
    Blacksmith: BLACKSMITH,
    Scribe: SCRIBE,
    Bard: BARD,
    Knight: KNIGHT,
  };

  const frames: Array<'idle' | 'blink' | 'walkA' | 'walkB'> = ['idle', 'blink', 'walkA', 'walkB'];

  for (const [name, char] of Object.entries(characters)) {
    describe(`${name} sprite integrity`, () => {
      it.each(frames)('frame "%s" maintains strict 16x21 grid dimensions', (frameName) => {
        const sprite = char[frameName];
        expect(sprite.rows.length).toBe(CHARACTER_HEIGHT);

        sprite.rows.forEach((row, rowIndex) => {
          expect(
            row.length,
            `Row ${rowIndex} of ${name} (${frameName}) must have width ${CHARACTER_WIDTH}, got ${row.length}: "${row}"`
          ).toBe(CHARACTER_WIDTH);
        });
      });

      it.each(frames)('frame "%s" contains only valid hex palette colors (no invisible pixels)', (frameName) => {
        const sprite = char[frameName];

        sprite.rows.forEach((row, rowIndex) => {
          for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const charGlyph = row[colIndex];
            if (charGlyph === '.') continue;

            const color = sprite.palette[charGlyph];
            expect(
              isValidHexColor(color),
              `Invalid or missing hex color '${String(color)}' for glyph '${charGlyph}' at row ${rowIndex}, col ${colIndex} in ${name} (${frameName})`
            ).toBe(true);
          }
        });
      });
    });
  }

  describe('Sheep companion sprite integrity', () => {
    it.each([
      ['idle', SHEEP_IDLE],
      ['graze', SHEEP_GRAZE],
    ])('%s frame has uniform width and valid hex palette colors', (_, sprite) => {
      const width = sprite.rows[0].length;

      sprite.rows.forEach((row, rIdx) => {
        expect(row.length, `Sheep row ${rIdx} mismatch`).toBe(width);
        for (const glyph of row) {
          if (glyph === '.') continue;
          const color = sprite.palette[glyph];
          expect(
            isValidHexColor(color),
            `Sheep has invalid or missing hex color '${String(color)}' for glyph '${glyph}'`
          ).toBe(true);
        }
      });
    });
  });

  describe('Hex color validation helper', () => {
    it('accepts #RGB, #RRGGBB, and #RRGGBBAA hex colors', () => {
      expect(isValidHexColor('#fff')).toBe(true);
      expect(isValidHexColor('#dc2626')).toBe(true);
      expect(isValidHexColor('#11223344')).toBe(true);
    });

    it('rejects empty strings, missing hash, and invalid hex values', () => {
      expect(isValidHexColor('')).toBe(false);
      expect(isValidHexColor('   ')).toBe(false);
      expect(isValidHexColor('dc2626')).toBe(false);
      expect(isValidHexColor('#12345')).toBe(false);
      expect(isValidHexColor('#zzzzzz')).toBe(false);
      expect(isValidHexColor(undefined)).toBe(false);
    });
  });
});
