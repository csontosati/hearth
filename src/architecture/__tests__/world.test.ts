import { describe, expect, it } from 'vitest';
import { LocalBridgeAgentProvider } from '../AgentProvider';
import { WeatherService } from '../WeatherService';
import { WorldState } from '../WorldState';
import type { WeatherCondition } from '../types';

describe('Hearth Architecture & State Contracts', () => {
  const mockWeather: WeatherCondition = {
    type: 'clear',
    temperatureC: 22,
    isDaytime: true,
    cloudCoverPercent: 15,
    windSpeedKmh: 10,
    ambientTint: WeatherService.calculateAmbientTint('clear', true),
  };

  it('initializes world with default workstations and primary agent', () => {
    const world = new WorldState(mockWeather);

    expect(world.workstations.length).toBe(4);
    expect(world.agents.has('scout_1')).toBe(true);
    expect(world.agents.has('smith_1')).toBe(true);
    expect(world.agents.has('scribe_1')).toBe(true);
    expect(world.agents.has('bard_1')).toBe(true);

    const agent = world.agents.get('scout_1')!;
    expect(agent.name).toBe('Rowan');
    expect(agent.activity).toBe('idle');
  });

  it('updates agent position toward target during update tick', () => {
    const world = new WorldState(mockWeather);
    const agent = world.agents.get('scout_1')!;
    const startX = agent.position.x;

    world.setAgentTarget('scout_1', { x: startX + 50, y: agent.position.y });
    expect(agent.activity).toBe('walking');

    // Simulate 200ms
    world.update(200);

    expect(agent.position.x).toBeGreaterThan(startX);
    expect(agent.position.x).toBeLessThanOrEqual(startX + 50);
  });

  it('recommends rainy soundtrack when weather turns to rain', () => {
    const world = new WorldState(mockWeather);
    const rainWeather: WeatherCondition = {
      ...mockWeather,
      type: 'rain',
      ambientTint: WeatherService.calculateAmbientTint('rain', true),
    };

    world.updateWeather(rainWeather);

    expect(world.recommendedAudio.genre).toContain('Rainy Day');
    expect(world.recommendedAudio.query).toContain('rainy');
  });

  it('handles agent provider event streaming and dispatches tasks', async () => {
    const provider = new LocalBridgeAgentProvider();
    await provider.connect();

    const events: string[] = [];
    provider.onEvent((evt) => {
      events.push(evt.type);
    });

    await provider.dispatchTask({
      taskId: 'test_1',
      role: 'blacksmith',
      prompt: 'Check PR status',
      sourceProvider: 'cursor',
    });

    expect(events).toContain('task_started');
  });

  it('calculates dark ambient tint for nighttime regardless of weather type', () => {
    const nightTint = WeatherService.calculateAmbientTint('clear', false);
    expect(nightTint).toContain('rgba(15, 23, 42');
  });
});

