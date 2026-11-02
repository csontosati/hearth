import type {
  AgentEvent,
  AgentModel,
  Position,
  WeatherCondition,
  Workstation,
} from './types';

export class WorldState {
  public agents: Map<string, AgentModel> = new Map();
  public workstations: Workstation[] = [];
  public weather: WeatherCondition;
  public latestEvent: AgentEvent | null = null;
  public recommendedAudio: { title: string; genre: string; query: string };

  constructor(initialWeather: WeatherCondition) {
    this.weather = initialWeather;
    this.recommendedAudio = this.getAudioForWeather(initialWeather);
    this.initDefaultWorld();
  }

  private initDefaultWorld(): void {
    // 4 core workstations based on the RPG clearing
    this.workstations = [
      {
        id: 'camp_fire',
        role: 'scout',
        name: 'Campfire',
        position: { x: 380, y: 270 },
        description: 'Where the Scout and Bard gather around the warm coals.',
      },
      {
        id: 'forge_anvil',
        role: 'blacksmith',
        name: 'Iron Forge',
        position: { x: 580, y: 190 },
        description: 'Where the Blacksmith hammers out code builds and PR checks.',
      },
      {
        id: 'writing_desk',
        role: 'scribe',
        name: 'Scribe Desk',
        position: { x: 220, y: 360 },
        description: 'Where the Scribe drafts documentation, logs, and plans.',
      },
      {
        id: 'guard_post',
        role: 'knight',
        name: 'North Post',
        position: { x: 490, y: 110 },
        description: 'Where the Knight keeps watch over the sanctuary path.',
      },
    ];

    // Guild Members / AI Agents
    const agentsList: AgentModel[] = [
      {
        id: 'scout_1',
        name: 'Rowan',
        role: 'scout',
        position: { x: 340, y: 280 },
        targetPosition: null,
        activity: 'idle',
        assignedWorkstationId: 'camp_fire',
        energy: 100,
      },
      {
        id: 'smith_1',
        name: 'Brann',
        role: 'blacksmith',
        position: { x: 560, y: 190 },
        targetPosition: null,
        activity: 'idle',
        assignedWorkstationId: 'forge_anvil',
        energy: 95,
      },
      {
        id: 'scribe_1',
        name: 'Elowen',
        role: 'scribe',
        position: { x: 220, y: 340 },
        targetPosition: null,
        activity: 'idle',
        assignedWorkstationId: 'writing_desk',
        energy: 90,
      },
      {
        id: 'bard_1',
        name: 'Lyric',
        role: 'bard',
        position: { x: 420, y: 280 },
        targetPosition: null,
        activity: 'idle',
        assignedWorkstationId: 'camp_fire',
        energy: 100,
      },
    ];

    for (const a of agentsList) {
      this.agents.set(a.id, a);
    }
  }

  public updateWeather(weather: WeatherCondition): void {
    this.weather = weather;
    this.recommendedAudio = this.getAudioForWeather(weather);
  }

  public getAudioForWeather(weather: WeatherCondition): { title: string; genre: string; query: string } {
    if (!weather.isDaytime) {
      return {
        title: 'Deep Midnight Lo-Fi & Ambient Stargazing',
        genre: 'Nocturnal Chillhop',
        query: 'lofi hip hop night chill focus beats',
      };
    }
    if (weather.type === 'rain' || weather.type === 'storm') {
      return {
        title: 'Raindrops & Gentle Piano Focus',
        genre: 'Rainy Day Acoustic Jazz',
        query: 'rainy day lofi chill study beats',
      };
    }
    if (weather.type === 'snow') {
      return {
        title: 'Winter Hearth Cozy Fireside',
        genre: 'Winter Ambient Acoustic',
        query: 'cozy cabin winter ambient lofi',
      };
    }
    return {
      title: 'Warm Sunny Breeze RPG Village',
      genre: 'Pastoral Stardew / Zelda Lo-Fi',
      query: 'cozy fantasy town rpg lofi beats',
    };
  }

  public handleAgentEvent(event: AgentEvent): void {
    this.latestEvent = event;
    const agent = Array.from(this.agents.values()).find((a) => a.role === event.role) ?? this.agents.get('scout_1');
    if (!agent) return;

    if (event.type === 'task_started') {
      // Find workstation
      const station = this.workstations.find((w) => w.role === event.role) ?? this.workstations[0];
      agent.targetPosition = { ...station.position };
      agent.activity = 'walking';
      agent.currentTaskTitle = event.message;
    } else if (event.type === 'task_completed') {
      agent.activity = 'celebrating';
      setTimeout(() => {
        if (agent.activity === 'celebrating') {
          agent.activity = 'idle';
        }
      }, 2500);
    }
  }

  public setAgentTarget(agentId: string, target: Position): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.targetPosition = target;
    agent.activity = 'walking';
  }

  /**
   * Deterministic physics / tick update for character movement.
   */
  public update(deltaMs: number): void {
    const speedPixelsPerSec = 90;
    const moveStep = (speedPixelsPerSec * deltaMs) / 1000;

    for (const agent of this.agents.values()) {
      if (!agent.targetPosition) continue;

      const dx = agent.targetPosition.x - agent.position.x;
      const dy = agent.targetPosition.y - agent.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= Math.max(3, moveStep)) {
        // Arrived at destination
        agent.position.x = agent.targetPosition.x;
        agent.position.y = agent.targetPosition.y;
        agent.targetPosition = null;
        agent.activity = agent.currentTaskTitle ? 'working' : 'idle';
      } else {
        // Step forward
        agent.position.x += (dx / dist) * moveStep;
        agent.position.y += (dy / dist) * moveStep;
        agent.activity = 'walking';
      }
    }
  }
}
