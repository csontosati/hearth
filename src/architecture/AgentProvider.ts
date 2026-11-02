import type { AgentEvent, AgentTaskRequest, IAgentProvider } from './types';

export class LocalBridgeAgentProvider implements IAgentProvider {
  public readonly name: string;
  private listeners: Set<(event: AgentEvent) => void> = new Set();
  private connected = false;

  constructor(providerName = 'Antigravity / Local Bridge') {
    this.name = providerName;
  }

  public async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    this.listeners.clear();
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public onEvent(callback: (event: AgentEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public emitEvent(event: AgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public async dispatchTask(request: AgentTaskRequest): Promise<void> {
    if (!this.connected) {
      throw new Error(`Provider ${this.name} is not connected.`);
    }

    // Emit initial task started event
    this.emitEvent({
      eventId: `evt_${Date.now()}_start`,
      agentId: request.role,
      role: request.role,
      type: 'task_started',
      message: `Starting task: "${request.prompt}" via ${request.sourceProvider}`,
      timestamp: Date.now(),
    });

    // Simulate agent progress for Day 1 validation
    setTimeout(() => {
      this.emitEvent({
        eventId: `evt_${Date.now()}_thought`,
        agentId: request.role,
        role: request.role,
        type: 'thought',
        message: `Analyzing context and planning execution...`,
        timestamp: Date.now(),
      });
    }, 1500);

    setTimeout(() => {
      this.emitEvent({
        eventId: `evt_${Date.now()}_complete`,
        agentId: request.role,
        role: request.role,
        type: 'task_completed',
        message: `Completed task: "${request.prompt}"!`,
        timestamp: Date.now(),
      });
    }, 3500);
  }
}

