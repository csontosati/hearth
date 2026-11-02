/**
 * Core domain types and architecture contracts for Hearth.
 * Decouples external AI providers, weather feeds, and audio from the simulation/rendering loop.
 */

export type AgentRole = 'scout' | 'blacksmith' | 'scribe' | 'bard' | 'knight';

export type AgentActivity = 'idle' | 'walking' | 'working' | 'celebrating';

export interface Position {
  x: number;
  y: number;
}

export interface Workstation {
  id: string;
  role: AgentRole;
  name: string;
  position: Position;
  description: string;
}

export interface AgentModel {
  id: string;
  name: string;
  role: AgentRole;
  position: Position;
  targetPosition: Position | null;
  activity: AgentActivity;
  assignedWorkstationId?: string;
  currentTaskTitle?: string;
  energy: number;
}

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';

export interface WeatherCondition {
  type: WeatherType;
  temperatureC: number;
  isDaytime: boolean;
  cloudCoverPercent: number; // 0 to 100
  windSpeedKmh: number;
  ambientTint: string; // e.g., 'rgba(255, 230, 180, 0.15)' for sunny, 'rgba(40, 60, 90, 0.4)' for rain/night
}

export interface AgentTaskRequest {
  taskId: string;
  role: AgentRole;
  prompt: string;
  sourceProvider: 'openai' | 'antigravity' | 'cursor' | 'local';
}

export interface AgentEvent {
  eventId: string;
  agentId: string;
  role: AgentRole;
  type: 'task_started' | 'task_progress' | 'task_completed' | 'thought';
  message: string;
  timestamp: number;
}

export interface IAgentProvider {
  name: string;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  dispatchTask(request: AgentTaskRequest): Promise<void>;
  onEvent(callback: (event: AgentEvent) => void): () => void;
}

export interface IWeatherProvider {
  fetchCurrentWeather(latitude?: number, longitude?: number): Promise<WeatherCondition>;
}

