import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBridgeAgentProvider } from '../AgentProvider';

describe('LocalBridgeAgentProvider Lifecycle & Timer Cleanup (Rule 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits task_started, thought, and task_completed in order when connected', async () => {
    const provider = new LocalBridgeAgentProvider();
    await provider.connect();

    const events: string[] = [];
    provider.onEvent((evt) => events.push(evt.type));

    await provider.dispatchTask({
      taskId: 'task_normal',
      role: 'scout',
      prompt: 'Survey the perimeter',
      sourceProvider: 'antigravity',
    });

    expect(events).toEqual(['task_started']);

    await vi.advanceTimersByTimeAsync(1500);
    expect(events).toEqual(['task_started', 'thought']);

    await vi.advanceTimersByTimeAsync(2000);
    expect(events).toEqual(['task_started', 'thought', 'task_completed']);
  });

  it('cancels pending timers and prevents ghost callbacks after disconnect()', async () => {
    const provider = new LocalBridgeAgentProvider();
    await provider.connect();

    const events: string[] = [];
    provider.onEvent((evt) => events.push(evt.type));

    await provider.dispatchTask({
      taskId: 'task_cancelled',
      role: 'blacksmith',
      prompt: 'Forge steel',
      sourceProvider: 'cursor',
    });

    expect(events).toEqual(['task_started']);
    expect(vi.getTimerCount()).toBe(2);

    await provider.disconnect();
    expect(provider.isConnected()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(5000);
    expect(events).toEqual(['task_started']);
  });
});
