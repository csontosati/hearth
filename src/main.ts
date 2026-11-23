import { AiAgentProvider } from './architecture/AiAgentProvider';
import { WeatherService } from './architecture/WeatherService';
import { WorldState } from './architecture/WorldState';
import { PixelRenderer } from './render/PixelRenderer';
import type { AgentRole, AiProviderId, WeatherCondition } from './architecture/types';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  const weatherService = new WeatherService();
  const initialWeather: WeatherCondition = await weatherService.fetchCurrentWeather();

  const world = new WorldState(initialWeather);
  const renderer = new PixelRenderer(canvas);
  const agentProvider = new AiAgentProvider();
  await agentProvider.connect();

  const guildLogEl = document.getElementById('guild-log');

  // Wire agent events into world state and HUD log
  agentProvider.onEvent((event) => {
    world.handleAgentEvent(event);
    if (guildLogEl) {
      guildLogEl.textContent = `[${event.role.toUpperCase()}] ${event.message}`;
    }
  });

  // UI Elements
  const weatherTextEl = document.getElementById('weather-text')!;
  const weatherIconEl = document.getElementById('weather-icon')!;
  const trackTitleEl = document.getElementById('track-title')!;
  const ytSearchLink = document.getElementById('yt-search-btn') as HTMLAnchorElement;

  function updateHud() {
    const w = world.weather;
    const icons: Record<string, string> = {
      clear: w.isDaytime ? '☀️' : '🌙',
      cloudy: '☁️',
      rain: '🌧️',
      storm: '⛈️',
      snow: '❄️',
    };
    weatherIconEl.textContent = icons[w.type] ?? '🌤️';
    weatherTextEl.textContent = `${w.temperatureC}°C ${w.type.toUpperCase()} · ${w.isDaytime ? 'DAY' : 'NIGHT'}`;

    const audio = world.recommendedAudio;
    trackTitleEl.textContent = `${audio.title.toUpperCase()}`;
    ytSearchLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(audio.query)}`;
  }

  updateHud();

  let selectedAgentId = 'scout_1';

  // Canvas click to select or move agent
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked near an agent to select
    for (const [id, agent] of world.agents) {
      const dist = Math.hypot(clickX - agent.position.x, clickY - agent.position.y);
      if (dist < 24) {
        selectedAgentId = id;
        agent.currentTaskTitle = `${agent.name} selected!`;
        setTimeout(() => {
          if (agent.currentTaskTitle === `${agent.name} selected!`) {
            agent.currentTaskTitle = undefined;
          }
        }, 1500);
        return;
      }
    }

    world.setAgentTarget(selectedAgentId, { x: clickX, y: clickY });
  });

  const promptInputEl = document.getElementById('quest-prompt-input') as HTMLInputElement | null;

  function dispatchCharacterQuest(role: AgentRole, defaultPrompt: string) {
    const customPrompt = promptInputEl?.value.trim();
    const prompt = customPrompt || defaultPrompt;
    const boundProvider = agentProvider.getBoundProvider(role);
    void agentProvider.dispatchTask({
      taskId: `task_${Date.now()}`,
      role,
      prompt,
      sourceProvider: boundProvider,
    });
  }

  // Button handlers
  document.getElementById('btn-scout')?.addEventListener('click', () => {
    dispatchCharacterQuest('scout', 'Scouting web for trending AI agent tools');
  });

  document.getElementById('btn-smith')?.addEventListener('click', () => {
    dispatchCharacterQuest('blacksmith', 'Reviewing test suites & build health');
  });

  document.getElementById('btn-scribe')?.addEventListener('click', () => {
    dispatchCharacterQuest('scribe', 'Drafting today’s concise architecture notes');
  });

  document.getElementById('btn-bard')?.addEventListener('click', () => {
    dispatchCharacterQuest('bard', 'Composing a cozy 16-bit campfire ballad');
  });

  // AI Accounts & Character Bindings Modal
  const aiModal = document.getElementById('ai-modal');
  const keyInputs: Record<'gemini' | 'openai' | 'anthropic', HTMLInputElement | null> = {
    gemini: document.getElementById('key-gemini') as HTMLInputElement | null,
    openai: document.getElementById('key-openai') as HTMLInputElement | null,
    anthropic: document.getElementById('key-anthropic') as HTMLInputElement | null,
  };
  const modelInputs: Record<'gemini' | 'openai' | 'anthropic', HTMLInputElement | null> = {
    gemini: document.getElementById('model-gemini') as HTMLInputElement | null,
    openai: document.getElementById('model-openai') as HTMLInputElement | null,
    anthropic: document.getElementById('model-anthropic') as HTMLInputElement | null,
  };
  const bindingSelects: Record<'scout' | 'blacksmith' | 'scribe' | 'bard', HTMLSelectElement | null> = {
    scout: document.getElementById('bind-scout') as HTMLSelectElement | null,
    blacksmith: document.getElementById('bind-blacksmith') as HTMLSelectElement | null,
    scribe: document.getElementById('bind-scribe') as HTMLSelectElement | null,
    bard: document.getElementById('bind-bard') as HTMLSelectElement | null,
  };

  function syncModalFromProvider() {
    const configs = agentProvider.getConfigs();
    for (const id of ['gemini', 'openai', 'anthropic'] as const) {
      if (keyInputs[id]) keyInputs[id]!.value = configs[id].apiKey;
      if (modelInputs[id]) modelInputs[id]!.value = configs[id].model;
    }
    const bindings = agentProvider.getBindings();
    for (const role of ['scout', 'blacksmith', 'scribe', 'bard'] as const) {
      if (bindingSelects[role]) bindingSelects[role]!.value = bindings[role];
    }
  }

  document.getElementById('btn-ai-accounts')?.addEventListener('click', () => {
    syncModalFromProvider();
    aiModal?.classList.remove('hidden');
  });

  document.getElementById('btn-close-ai-modal')?.addEventListener('click', () => {
    aiModal?.classList.add('hidden');
  });

  document.getElementById('btn-save-ai')?.addEventListener('click', () => {
    for (const id of ['gemini', 'openai', 'anthropic'] as const) {
      agentProvider.setProviderConfig(
        id,
        keyInputs[id]?.value ?? '',
        modelInputs[id]?.value ?? ''
      );
    }
    for (const role of ['scout', 'blacksmith', 'scribe', 'bard'] as const) {
      const val = (bindingSelects[role]?.value ?? 'local') as AiProviderId;
      agentProvider.setCharacterBinding(role, val);
    }
    if (guildLogEl) {
      guildLogEl.textContent = 'SAVED AI ACCOUNTS & CHARACTER BINDINGS LOCALLY.';
    }
    aiModal?.classList.add('hidden');
  });

  document.getElementById('btn-clear-ai')?.addEventListener('click', () => {
    for (const id of ['gemini', 'openai', 'anthropic'] as const) {
      agentProvider.setProviderConfig(id, '');
      if (keyInputs[id]) keyInputs[id]!.value = '';
    }
    if (guildLogEl) {
      guildLogEl.textContent = 'CLEARED STORED API KEYS (USING LOCAL SIM FALLBACK).';
    }
  });

  document.getElementById('btn-weather-toggle')?.addEventListener('click', () => {
    const nextType = world.weather.type === 'rain' ? 'clear' : 'rain';
    const nextTint = WeatherService.calculateAmbientTint(nextType, world.weather.isDaytime);
    world.updateWeather({
      ...world.weather,
      type: nextType,
      ambientTint: nextTint,
    });
    updateHud();
  });

  // Main animation / simulation loop
  let lastTime = performance.now();
  function gameLoop(currentTime: number) {
    const deltaMs = Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;

    world.update(deltaMs);
    renderer.render(world, deltaMs);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

bootstrap().catch((err) => {
  console.error('Failed to start Hearth sanctuary:', err);
});
