# 🏕️ Hearth — Factory Instructions & Agent Review Standards

> *"A living 16-bit top-down RPG sanctuary where autonomous background AI agents live, work, and automate real tasks—while world weather and soundscapes sync to your actual window."*

Built for the **Qodo Hackathon: Build a Software Factory in 30 Days**.

---

## 🧭 Project Overview

**Hearth** turns invisible background agent tasks (Antigravity research, Cursor code generation, Qodo PR reviews, local CLI bridges) into a living retro RPG sanctuary running in a pinned browser tab on a second monitor.

### Sanctuary Architecture
* **Pure Simulation Loop (`src/architecture/WorldState.ts`):** Deterministic state machine managing agent locations, pathfinding, activity states (`idle`, `walking`, `working`, `celebrating`), workstation assignments, and ambient lighting.
* **Procedural 16-Bit Rasterizer (`src/render/TerrainBaker.ts`, `src/render/PixelRenderer.ts`):** Handcrafted procedural terrain generation, 2.5D tree canopies with depth sorting, ASCII-defined character sprites, and particle weather effects.
* **Decoupled Service Adapters (`src/architecture/`):**
  * `IAgentProvider`: Adapts external event streams from Antigravity, Cursor, OpenAI, or local websockets without coupling to the render loop.
  * `IWeatherProvider`: Keyless Open-Meteo telemetry integration with calculated ambient day/night color tints and weather conditions.
* **16-Bit Retro UI (`index.html`, `src/style.css`):** Nostalgic JRPG dialogue HUD, pixel-art speech bubbles, YouTube sound test engine, and CRT scanlines.

---

## 🛠️ Setup & Verification Commands

All agents and reviewers working on Hearth must use these verified commands:

```bash
# 1. Install dependencies
npm install

# 2. Run local development companion (Vite server at http://localhost:5173)
npm run dev

# 3. Run automated test suite (Vitest unit tests)
npm test

# 4. Run TypeScript typecheck and production build
npm run build
```

> **Automated Quality Gate:** Every pull request must pass both `npm test` and `npm run build` cleanly before merging.

---

## 📜 Project Rules & Review Standards

These 5 standards govern all code contributed to Hearth by human engineers, coding agents, and automated reviewers:

---

### Rule 1: The No Invisible Feathers Rule (Strict ASCII Sprite Grid & Palette Integrity)
* **Where it applies:** `src/render/pixel/**`, `src/render/PixelRenderer.ts`, `src/render/TerrainBaker.ts`
* **Why it exists:** Characters in Hearth are authored directly in code as human-readable ASCII art matrices so that sprite animations can be diffed, version-controlled, and reviewed directly in PRs. However, our canvas rasterizer skips unregistered characters as transparent pixels. In Day 1, an unmapped glyph `'F'` for the Bard's feather and a 15-character row length caused silent transparency bugs and 1px frame stretching without throwing a single compile-time error.
* **Requirement:**
  1. Every row of every character frame must measure exactly 16 characters wide (`CHARACTER_WIDTH = 16`).
  2. Every frame must have exactly 21 rows (`CHARACTER_HEIGHT = 21`).
  3. Every character glyph used in a sprite row (except the transparency dot `'.'`) must have an explicit hex color mapping in that character's `palette` object.
  4. Any new character sprite or override must include automated validation tests in `src/architecture/__tests__/sprites.test.ts`.

---

### Rule 2: The Clean Sanctuary Loop Rule (Strict Decoupling of Simulation & Network I/O)
* **Where it applies:** `src/architecture/WorldState.ts`, `src/render/**`
* **Why it exists:** Hearth runs an active 60 FPS `requestAnimationFrame` tick loop. Network latency, fetch timeouts, or asynchronous streaming from AI providers (OpenAI, Cursor, Antigravity) must never stall, block, or introduce non-deterministic state into `WorldState.update(dt)` or canvas drawing routines.
* **Requirement:**
  1. Neither `WorldState` nor any rendering class may directly execute `fetch()`, WebSocket connections, or asynchronous network calls.
  2. All external I/O must live exclusively inside decoupled adapter services (`LocalBridgeAgentProvider`, `WeatherService`, etc.) implementing `IAgentProvider` or `IWeatherProvider`.
  3. Adapters communicate with `WorldState` solely via structured, synchronous event dispatching (`onEvent`), ensuring the game loop remains 100% deterministic and unit-testable without network mocking harnesses.

---

### Rule 3: The No Ghost Callbacks Rule (Strict Lifecycle Teardown & Resource Cleanup)
* **Where it applies:** `src/architecture/AgentProvider.ts`, `src/main.ts`, `src/render/PixelRenderer.ts`
* **Why it exists:** Hearth is designed as an ambient, long-running pinned companion tab. Dangling `setTimeout`, `setInterval`, uncleaned event listeners, or uncleared particle arrays cause memory leaks and "ghost events" (e.g., delayed task completions triggering long after a user reconnected or switched workstations).
* **Requirement:**
  1. Any provider, renderer, or controller that initiates timers, animators, or event listeners must provide an explicit `disconnect()`, `destroy()`, or cleanup method.
  2. Calling `disconnect()` must cancel all pending `setTimeout` and `setInterval` handles and clear pending event queues.
  3. Delayed task callbacks must verify that the task ID is still the active task for that agent before emitting state transitions.

---

### Rule 4: The 16-Bit Atmosphere & Theme Token Rule (No Modern Smooth Web UI)
* **Where it applies:** `src/style.css`, `index.html`, and all UI HUD components
* **Why it exists:** Modern web defaults (rounded corners like `border-radius: 8px`, smooth font anti-aliasing, modern blue drop shadows, off-palette hex colors) destroy the immersion of a 16-bit SNES/GBA retro sanctuary.
* **Requirement:**
  1. All UI surfaces must use our defined CSS variables (`--parchment`, `--wood-dark`, `--gold-trim`, `--panel-border-outer`, etc.).
  2. Typography must strictly use retro bitmap fonts (`'Press Start 2P'`, `'Silkscreen'`).
  3. All `<canvas>` elements must enforce `image-rendering: pixelated`.
  4. Borders must use stepped/chunky bevels or pixel borders—never smooth CSS blur shadows (`filter: blur`) or pill roundings (`border-radius > 4px` on pixel cards).

---

### Rule 5: The Forge Verification Gate (Zero Type Escapes & Mandatory Test Coverage)
* **Where it applies:** Repository-wide (`src/**`, root configuration)
* **Why it exists:** As Hearth scales with multi-agent workflows, regressions in character activity state machines, task queuing, or weather transitions degrade the user experience. Brann the Blacksmith requires every change to be verified before merging.
* **Requirement:**
  1. Every PR modifying domain entities (`src/architecture/types.ts`), agent state transitions (`AgentActivity`), or weather math must include corresponding Vitest tests in `src/architecture/__tests__/`.
  2. Code must pass `npm test` and `npm run build` with zero TypeScript errors.
  3. Never use `any` type casts to bypass type safety; create explicit domain types or discriminated unions.
