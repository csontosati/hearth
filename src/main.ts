import { LocalBridgeAgentProvider } from './architecture/AgentProvider';
import { WeatherService } from './architecture/WeatherService';
import { WorldState } from './architecture/WorldState';
import { PixelRenderer } from './render/PixelRenderer';
import type { WeatherCondition } from './architecture/types';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  const weatherService = new WeatherService();
  const initialWeather: WeatherCondition = await weatherService.fetchCurrentWeather();

  const world = new WorldState(initialWeather);
  const renderer = new PixelRenderer(canvas);
  const agentProvider = new LocalBridgeAgentProvider();
  await agentProvider.connect();

  // Wire agent events into world state
  agentProvider.onEvent((event) => {
    world.handleAgentEvent(event);
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

  // Button handlers
  document.getElementById('btn-scout')?.addEventListener('click', () => {
    agentProvider.dispatchTask({
      taskId: `task_${Date.now()}`,
      role: 'scout',
      prompt: 'Scouting web for trending agent models',
      sourceProvider: 'antigravity',
    });
  });

  document.getElementById('btn-smith')?.addEventListener('click', () => {
    agentProvider.dispatchTask({
      taskId: `task_${Date.now()}`,
      role: 'blacksmith',
      prompt: 'Refactoring test suites & running Qodo review',
      sourceProvider: 'cursor',
    });
  });

  document.getElementById('btn-scribe')?.addEventListener('click', () => {
    agentProvider.dispatchTask({
      taskId: `task_${Date.now()}`,
      role: 'scribe',
      prompt: 'Updating project roadmap & daily architecture logs',
      sourceProvider: 'openai',
    });
  });

  document.getElementById('btn-bard')?.addEventListener('click', () => {
    agentProvider.dispatchTask({
      taskId: `task_${Date.now()}`,
      role: 'bard',
      prompt: 'Composing a lively acoustic tavern melody',
      sourceProvider: 'local',
    });
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
