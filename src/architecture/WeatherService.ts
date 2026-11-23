import type { IWeatherProvider, WeatherCondition, WeatherType } from './types';

export class WeatherService implements IWeatherProvider {
  /**
   * Computes the visual ambient tint overlay based on weather type and daylight.
   */
  public static calculateAmbientTint(type: WeatherType, isDaytime: boolean): string {
    if (!isDaytime) {
      // Nighttime: Deep navy blue overlay
      return 'rgba(15, 23, 42, 0.65)';
    }

    switch (type) {
      case 'clear':
        // Warm sunny golden glow
        return 'rgba(253, 230, 138, 0.12)';
      case 'cloudy':
        // Mild cool overcast tint
        return 'rgba(148, 163, 184, 0.22)';
      case 'rain':
      case 'storm':
        // Moody slate blue-gray
        return 'rgba(71, 85, 105, 0.45)';
      case 'snow':
        // Crisp pale cyan-white tint
        return 'rgba(224, 242, 254, 0.3)';
      default:
        return 'rgba(0, 0, 0, 0)';
    }
  }

  /**
   * Translates WMO weather codes (Open-Meteo standard) into Hearth weather types.
   */
  public static mapWmoCodeToType(wmoCode: number): WeatherType {
    if (wmoCode === 0 || wmoCode === 1) return 'clear';
    if (wmoCode === 2 || wmoCode === 3) return 'cloudy';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(wmoCode)) return 'rain';
    if ([95, 96, 99].includes(wmoCode)) return 'storm';
    if ([71, 73, 75, 77, 85, 86].includes(wmoCode)) return 'snow';
    return 'cloudy';
  }

  /**
   * Resolves browser geolocation coordinates with a bounded timeout,
   * falling back to the provided defaults when unavailable or denied.
   */
  public static resolveCoordinates(
    fallbackLat = 50.08,
    fallbackLon = 14.43,
    timeoutMs = 3000
  ): Promise<{ latitude: number; longitude: number }> {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      return Promise.resolve({ latitude: fallbackLat, longitude: fallbackLon });
    }

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ latitude: fallbackLat, longitude: fallbackLon });
        }
      }, timeoutMs);

      geo.getCurrentPosition(
        (pos) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        },
        () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({ latitude: fallbackLat, longitude: fallbackLon });
          }
        },
        { timeout: timeoutMs, maximumAge: 300_000 }
      );
    });
  }

  public async fetchCurrentWeather(latitude?: number, longitude?: number): Promise<WeatherCondition> {
    try {
      const coords =
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : await WeatherService.resolveCoordinates();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,is_day,weather_code,cloud_cover,wind_speed_10m`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      
      if (!response.ok) {
        throw new Error(`Weather fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      const current = data.current;
      const type = WeatherService.mapWmoCodeToType(current.weather_code ?? 0);
      const isDaytime = current.is_day === 1;

      return {
        type,
        temperatureC: Math.round(current.temperature_2m ?? 20),
        isDaytime,
        cloudCoverPercent: current.cloud_cover ?? 10,
        windSpeedKmh: current.wind_speed_10m ?? 5,
        ambientTint: WeatherService.calculateAmbientTint(type, isDaytime),
      };
    } catch {
      // Graceful offline fallback
      const nowHours = new Date().getHours();
      const isDaytime = nowHours >= 6 && nowHours < 19;
      const type: WeatherType = 'clear';

      return {
        type,
        temperatureC: 19,
        isDaytime,
        cloudCoverPercent: 20,
        windSpeedKmh: 8,
        ambientTint: WeatherService.calculateAmbientTint(type, isDaytime),
      };
    }
  }
}

