import { describe, expect, it } from 'vitest';
import { WeatherService } from '../WeatherService';
import type { WeatherType } from '../types';

describe('WeatherService WMO mapping and ambient tints', () => {
  it.each([
    [0, 'clear'],
    [1, 'clear'],
    [2, 'cloudy'],
    [3, 'cloudy'],
    [51, 'rain'],
    [61, 'rain'],
    [82, 'rain'],
    [95, 'storm'],
    [99, 'storm'],
    [71, 'snow'],
    [77, 'snow'],
    [86, 'snow'],
    [999, 'cloudy'],
  ] as Array<[number, WeatherType]>)('maps WMO code %i to "%s"', (wmoCode, expected) => {
    expect(WeatherService.mapWmoCodeToType(wmoCode)).toBe(expected);
  });

  it('returns valid rgba tints for all daytime weather types and nighttime', () => {
    const dayTypes: WeatherType[] = ['clear', 'cloudy', 'rain', 'storm', 'snow'];
    const tints = new Set(dayTypes.map((type) => WeatherService.calculateAmbientTint(type, true)));

    // rain and storm intentionally share the moody slate overlay; 4 distinct daytime overlays
    expect(tints.size).toBe(4);
    for (const tint of tints) {
      expect(tint).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
    }

    const nightTint = WeatherService.calculateAmbientTint('rain', false);
    expect(nightTint).toBe('rgba(15, 23, 42, 0.65)');
  });
});
