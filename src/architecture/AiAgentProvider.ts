import type {
  AgentEvent,
  AgentRole,
  AgentTaskRequest,
  AiProviderConfig,
  AiProviderId,
  CharacterProviderBindings,
  IAgentProvider,
} from './types';

export const DEFAULT_PROVIDER_MODELS: Record<AiProviderId, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  local: 'hearth-local-sim',
};

export const DEFAULT_CHARACTER_BINDINGS: CharacterProviderBindings = {
  scout: 'gemini',
  blacksmith: 'openai',
  scribe: 'anthropic',
  bard: 'local',
  knight: 'local',
};

const STORAGE_KEYS = {
  configs: 'hearth.ai.configs.v1',
  bindings: 'hearth.ai.bindings.v1',
} as const;

const ROLE_PERSONAS: Record<AgentRole, string> = {
  scout: 'You are Rowan the Scout in Hearth, a 16-bit RPG guild. Reply in 1-2 concise, helpful sentences.',
  blacksmith: 'You are Brann the Blacksmith in Hearth, a 16-bit RPG guild. Reply in 1-2 concise, technical sentences.',
  scribe: 'You are Elowen the Scribe in Hearth, a 16-bit RPG guild. Reply in 1-2 concise, structured sentences.',
  bard: 'You are Lyric the Bard in Hearth, a 16-bit RPG guild. Reply in 1-2 concise, warm sentences.',
  knight: 'You are the Knight guardian in Hearth, a 16-bit RPG guild. Reply in 1-2 concise sentences.',
};

function getSafeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class AiAgentProvider implements IAgentProvider {
  public readonly name = 'Hearth Multi-AI Guild Bridge';
  private listeners: Set<(event: AgentEvent) => void> = new Set();
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private activeControllers: Map<string, AbortController> = new Map();
  private activeTaskIds: Set<string> = new Set();
  private connected = false;

  private configs: Record<AiProviderId, AiProviderConfig>;
  private bindings: CharacterProviderBindings;

  constructor() {
    this.configs = this.loadConfigs();
    this.bindings = this.loadBindings();
  }

  public async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();

    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    this.activeControllers.clear();
    this.activeTaskIds.clear();
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

  public getConfigs(): Record<AiProviderId, AiProviderConfig> {
    return {
      gemini: { ...this.configs.gemini },
      openai: { ...this.configs.openai },
      anthropic: { ...this.configs.anthropic },
      local: { ...this.configs.local },
    };
  }

  public setProviderConfig(providerId: AiProviderId, apiKey: string, model?: string): void {
    this.configs[providerId] = {
      providerId,
      apiKey: apiKey.trim(),
      model: (model ?? this.configs[providerId].model).trim() || DEFAULT_PROVIDER_MODELS[providerId],
    };
    this.saveConfigs();
  }

  public getBindings(): CharacterProviderBindings {
    return { ...this.bindings };
  }

  public setCharacterBinding(role: AgentRole, providerId: AiProviderId): void {
    this.bindings[role] = providerId;
    this.saveBindings();
  }

  public getBoundProvider(role: AgentRole): AiProviderId {
    return this.bindings[role] ?? 'local';
  }

  public isProviderConfigured(providerId: AiProviderId): boolean {
    if (providerId === 'local') return true;
    return this.configs[providerId].apiKey.trim().length > 0;
  }

  public async dispatchTask(request: AgentTaskRequest): Promise<void> {
    if (!this.connected) {
      throw new Error(`Provider ${this.name} is not connected.`);
    }

    const { taskId, role, prompt } = request;
    const boundProvider = this.resolveProviderForRequest(request);
    const config = this.configs[boundProvider];
    const hasKey = boundProvider !== 'local' && config.apiKey.trim().length > 0;

    this.activeTaskIds.add(taskId);
    this.emitEvent({
      eventId: `evt_${Date.now()}_start`,
      agentId: role,
      role,
      type: 'task_started',
      message: hasKey
        ? `[${boundProvider.toUpperCase()}] ${prompt}`
        : `[LOCAL SIM] ${prompt}`,
      timestamp: Date.now(),
    });

    if (!hasKey) {
      this.scheduleLocalFallback(taskId, role, prompt, boundProvider);
      return;
    }

    const controller = new AbortController();
    this.activeControllers.set(taskId, controller);

    try {
      this.emitEvent({
        eventId: `evt_${Date.now()}_thought`,
        agentId: role,
        role,
        type: 'thought',
        message: `Consulting ${boundProvider.toUpperCase()} (${config.model})...`,
        timestamp: Date.now(),
      });

      const reply = await this.invokeProviderApi(config, role, prompt, controller.signal);
      if (!this.connected || !this.activeTaskIds.has(taskId)) {
        return;
      }

      this.activeTaskIds.delete(taskId);
      this.activeControllers.delete(taskId);
      this.emitEvent({
        eventId: `evt_${Date.now()}_complete`,
        agentId: role,
        role,
        type: 'task_completed',
        message: reply,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.activeControllers.delete(taskId);
      if (!this.connected || !this.activeTaskIds.has(taskId)) {
        return;
      }
      this.activeTaskIds.delete(taskId);

      const errorText = error instanceof Error ? error.message : 'Request failed';
      this.emitEvent({
        eventId: `evt_${Date.now()}_err`,
        agentId: role,
        role,
        type: 'task_completed',
        message: `[${boundProvider.toUpperCase()} ERROR] ${errorText}`,
        timestamp: Date.now(),
      });
    }
  }

  private resolveProviderForRequest(request: AgentTaskRequest): AiProviderId {
    const src = request.sourceProvider;
    if (src === 'gemini' || src === 'openai' || src === 'anthropic' || src === 'local') {
      return src;
    }
    return this.getBoundProvider(request.role);
  }

  private scheduleLocalFallback(
    taskId: string,
    role: AgentRole,
    prompt: string,
    intendedProvider: AiProviderId
  ): void {
    const thoughtTimer = setTimeout(() => {
      this.pendingTimers.delete(thoughtTimer);
      if (!this.connected || !this.activeTaskIds.has(taskId)) return;
      this.emitEvent({
        eventId: `evt_${Date.now()}_thought`,
        agentId: role,
        role,
        type: 'thought',
        message:
          intendedProvider === 'local'
            ? 'Working in offline guild mode...'
            : `No ${intendedProvider.toUpperCase()} key set — using offline guild mode...`,
        timestamp: Date.now(),
      });
    }, 900);
    this.pendingTimers.add(thoughtTimer);

    const completeTimer = setTimeout(() => {
      this.pendingTimers.delete(completeTimer);
      if (!this.connected || !this.activeTaskIds.has(taskId)) return;
      this.activeTaskIds.delete(taskId);
      this.emitEvent({
        eventId: `evt_${Date.now()}_complete`,
        agentId: role,
        role,
        type: 'task_completed',
        message: `Completed: "${prompt}" (connect an AI key in AI ACCOUNTS for live responses!)`,
        timestamp: Date.now(),
      });
    }, 2200);
    this.pendingTimers.add(completeTimer);
  }

  private async invokeProviderApi(
    config: AiProviderConfig,
    role: AgentRole,
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    const systemPrompt = ROLE_PERSONAS[role];

    if (config.providerId === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from Gemini`);
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || 'Gemini returned an empty response.';
    }

    if (config.providerId === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 180,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from OpenAI`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || 'ChatGPT returned an empty response.';
    }

    if (config.providerId === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        signal,
        body: JSON.stringify({
          model: config.model,
          max_tokens: 180,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from Claude`);
      }
      const data = (await res.json()) as {
        content?: Array<{ text?: string }>;
      };
      const text = data.content?.[0]?.text?.trim();
      return text || 'Claude returned an empty response.';
    }

    return `Completed: "${prompt}"`;
  }

  private loadConfigs(): Record<AiProviderId, AiProviderConfig> {
    const defaults: Record<AiProviderId, AiProviderConfig> = {
      gemini: { providerId: 'gemini', apiKey: '', model: DEFAULT_PROVIDER_MODELS.gemini },
      openai: { providerId: 'openai', apiKey: '', model: DEFAULT_PROVIDER_MODELS.openai },
      anthropic: { providerId: 'anthropic', apiKey: '', model: DEFAULT_PROVIDER_MODELS.anthropic },
      local: { providerId: 'local', apiKey: '', model: DEFAULT_PROVIDER_MODELS.local },
    };

    const storage = getSafeStorage();
    if (!storage) return defaults;

    try {
      const raw = storage.getItem(STORAGE_KEYS.configs);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<Record<AiProviderId, Partial<AiProviderConfig>>>;
      for (const id of ['gemini', 'openai', 'anthropic', 'local'] as const) {
        if (parsed[id]) {
          defaults[id] = {
            providerId: id,
            apiKey: typeof parsed[id]?.apiKey === 'string' ? parsed[id].apiKey : '',
            model: typeof parsed[id]?.model === 'string' && parsed[id].model ? parsed[id].model : DEFAULT_PROVIDER_MODELS[id],
          };
        }
      }
    } catch {
      return defaults;
    }
    return defaults;
  }

  private saveConfigs(): void {
    const storage = getSafeStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEYS.configs, JSON.stringify(this.configs));
    } catch {
      // Ignore quota errors in restricted browser contexts
    }
  }

  private loadBindings(): CharacterProviderBindings {
    const defaults: CharacterProviderBindings = { ...DEFAULT_CHARACTER_BINDINGS };
    const storage = getSafeStorage();
    if (!storage) return defaults;

    try {
      const raw = storage.getItem(STORAGE_KEYS.bindings);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<Record<AgentRole, AiProviderId>>;
      for (const role of ['scout', 'blacksmith', 'scribe', 'bard', 'knight'] as const) {
        const val = parsed[role];
        if (val === 'gemini' || val === 'openai' || val === 'anthropic' || val === 'local') {
          defaults[role] = val;
        }
      }
    } catch {
      return defaults;
    }
    return defaults;
  }

  private saveBindings(): void {
    const storage = getSafeStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEYS.bindings, JSON.stringify(this.bindings));
    } catch {
      // Ignore quota errors
    }
  }
}
