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

      it.each(frames)('frame "%s" contains no undefined palette glyphs (no invisible pixels)', (frameName) => {
        const sprite = char[frameName];
        const validKeys = new Set([...Object.keys(sprite.palette), '.']);

        sprite.rows.forEach((row, rowIndex) => {
          for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const charGlyph = row[colIndex];
            expect(
              validKeys.has(charGlyph),
              `Unregistered glyph '${charGlyph}' at row ${rowIndex}, col ${colIndex} in ${name} (${frameName})`
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
    ])('%s frame has uniform width and valid palette keys', (_, sprite) => {
      const width = sprite.rows[0].length;
      const validKeys = new Set([...Object.keys(sprite.palette), '.']);

      sprite.rows.forEach((row, rIdx) => {
        expect(row.length, `Sheep row ${rIdx} mismatch`).toBe(width);
        for (const glyph of row) {
          expect(validKeys.has(glyph), `Sheep has undefined glyph '${glyph}'`).toBe(true);
        }
      });
    });
  });
});
