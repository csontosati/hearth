import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAgentProvider } from '../AiAgentProvider';
import type { AgentEvent } from '../types';

describe('AiAgentProvider multi-account connections and teardown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls Gemini API when scout is bound to gemini with an API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Scouted 3 new open-weight models.' }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AiAgentProvider();
    await provider.connect();
    provider.setProviderConfig('gemini', 'test-gemini-key', 'gemini-2.5-flash');
    provider.setCharacterBinding('scout', 'gemini');

    const events: AgentEvent[] = [];
    provider.onEvent((evt) => events.push(evt));

    await provider.dispatchTask({
      taskId: 't_gemini',
      role: 'scout',
      prompt: 'Find new models',
      sourceProvider: 'gemini',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
    expect(events.map((e) => e.type)).toEqual(['task_started', 'thought', 'task_completed']);
    expect(events[2].message).toBe('Scouted 3 new open-weight models.');
  });

  it('calls OpenAI ChatGPT API when blacksmith is bound to openai', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'All 68 unit tests look solid.' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AiAgentProvider();
    await provider.connect();
    provider.setProviderConfig('openai', 'sk-test-openai', 'gpt-4o-mini');
    provider.setCharacterBinding('blacksmith', 'openai');

    const events: AgentEvent[] = [];
    provider.onEvent((evt) => events.push(evt));

    await provider.dispatchTask({
      taskId: 't_openai',
      role: 'blacksmith',
      prompt: 'Review test coverage',
      sourceProvider: 'openai',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.openai.com/v1/chat/completions');
    expect(events[2].message).toBe('All 68 unit tests look solid.');
  });

  it('calls Anthropic Claude API when scribe is bound to anthropic', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Updated guild architecture chronicle.' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AiAgentProvider();
    await provider.connect();
    provider.setProviderConfig('anthropic', 'sk-ant-test', 'claude-3-5-haiku-latest');
    provider.setCharacterBinding('scribe', 'anthropic');

    const events: AgentEvent[] = [];
    provider.onEvent((evt) => events.push(evt));

    await provider.dispatchTask({
      taskId: 't_claude',
      role: 'scribe',
      prompt: 'Summarize today',
      sourceProvider: 'anthropic',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.anthropic.com/v1/messages');
    expect(events[2].message).toBe('Updated guild architecture chronicle.');
  });

  it('aborts in-flight requests and cancels timers on disconnect() (Rule 3)', async () => {
    let capturedSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return new Promise(() => {
          // Never resolves unless aborted
        });
      })
    );

    const provider = new AiAgentProvider();
    await provider.connect();
    provider.setProviderConfig('gemini', 'test-key');

    void provider.dispatchTask({
      taskId: 't_abort',
      role: 'scout',
      prompt: 'Long running task',
      sourceProvider: 'gemini',
    });

    expect(capturedSignal?.aborted).toBe(false);
    await provider.disconnect();
    expect(capturedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
