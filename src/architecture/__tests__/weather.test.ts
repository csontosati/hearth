import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeatherService } from '../WeatherService';
import type { WeatherType } from '../types';

describe('WeatherService WMO mapping and ambient tints', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
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

  it('falls back gracefully to clear defaults when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));
    const service = new WeatherService();

    const result = await service.fetchCurrentWeather();
    expect(result.type).toBe('clear');
    expect(result.temperatureC).toBe(19);
    expect(result.ambientTint).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
  });

  it('falls back gracefully to clear defaults when Open-Meteo returns HTTP 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, statusText: 'Service Unavailable' })
    );
    const service = new WeatherService();

    const result = await service.fetchCurrentWeather();
    expect(result.type).toBe('clear');
    expect(result.temperatureC).toBe(19);
    expect(result.ambientTint).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
  });

  it('uses browser geolocation when available and falls back on error', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          success({ coords: { latitude: 47.49, longitude: 19.04 } });
        },
      },
    });

    const resolved = await WeatherService.resolveCoordinates();
    expect(resolved).toEqual({ latitude: 47.49, longitude: 19.04 });

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: unknown, error: () => void) => error(),
      },
    });

    const fallback = await WeatherService.resolveCoordinates(50.08, 14.43);
    expect(fallback).toEqual({ latitude: 50.08, longitude: 14.43 });
  });
});
