# Hearth — Agent Working Rules

## Project and scope

Hearth is a 16-bit retro RPG companion application running in a browser viewport. It visualizes background autonomous coding agents (Antigravity, Cursor, OpenAI, and local bridges) as physical characters performing work at guild workstations, with ambient lighting and music dynamically synchronized to local weather telemetry.

These instructions apply to any AI coding agent editing this repository. All remote git operations, branch publishing, pull requests, and merges require explicit human maintainer authorization.

### Architecture boundaries
- **Simulation Loop (`src/architecture/WorldState.ts`):** Deterministic state machine governing character positions, pathfinding, activity states (`idle`, `working`, `walking`, `celebrating`), workstation assignments, and ambient day/night tinting.
- **Rasterizer Engine (`src/render/TerrainBaker.ts`, `src/render/PixelRenderer.ts`):** Procedural terrain generation, 2.5D tree canopies with depth sorting, ASCII-defined character sprites, and particle weather rendering.
- **Decoupled Providers (`src/architecture/`):**
  - `IAgentProvider`: Adapts external event streams from local bridges or AI services into synchronous world events without coupling to the render loop.
  - `IWeatherProvider`: Keyless Open-Meteo telemetry integration with computed ambient lighting and precipitation states.
- **Retro UI HUD (`index.html`, `src/style.css`):** 16-bit dialog boxes, pixel-art speech bubbles, and audio stream controls.

## Setup and verification

Requires Node.js 22+ and npm. Run from repository root:

```bash
npm install
npm test
npm run build
```

To run the local companion in development mode:

```bash
npm run dev
```

All pull requests and agent edits must pass `npm test` (Vitest unit tests) and `npm run build` (TypeScript compiler and Vite production bundle) cleanly with zero errors before being submitted for maintainer review.

## Five review standards

1. **No invisible glyphs or misaligned sprite rows.**
   - **Applies to:** `src/render/pixel/**`, `src/render/PixelRenderer.ts`, `src/render/TerrainBaker.ts` and sprite test suites.
   - **Rule:** Sprites are defined in code as ASCII art matrices so that pixel art remains diffable and reviewable in version control. Every row of every character frame must measure exactly 16 characters wide (`CHARACTER_WIDTH = 16`), every frame must contain exactly 21 rows (`CHARACTER_HEIGHT = 21`), and every character glyph (except the transparency dot `'.'`) must have an explicit hex color mapping in the character's `palette` dictionary. Any addition or alteration of sprites must be accompanied by automated validation tests in `src/architecture/__tests__/sprites.test.ts`.
   - **Why:** The canvas rasterizer skips unregistered glyphs as transparent pixels without throwing runtime exceptions. An unmapped glyph or missing column silently breaks pixel alignment and causes invisible character features.

2. **Strict decoupling of simulation loop and network I/O.**
   - **Applies to:** `src/architecture/WorldState.ts`, `src/render/**`
   - **Rule:** The 60 FPS animation loop and state ticks must remain synchronous and deterministic. Never invoke `fetch()`, WebSockets, or external asynchronous network calls directly inside `WorldState`, `PixelRenderer`, or `TerrainBaker`. All external I/O belongs exclusively in decoupled adapter classes implementing `IAgentProvider` or `IWeatherProvider`, which push synchronous events into the world via `onEvent`.
   - **Why:** Network latency, connection timeouts, or streaming stalls must never pause canvas rendering, drop frames, or introduce non-deterministic state that complicates testing.

3. **Mandatory lifecycle teardown and timer cleanup.**
   - **Applies to:** `src/architecture/AgentProvider.ts`, `src/main.ts`, `src/render/PixelRenderer.ts`
   - **Rule:** Hearth is designed as an ambient, long-running pinned companion application. Any class or controller that initiates `setTimeout`, `setInterval`, animation frame requests, or DOM listeners must implement an explicit `disconnect()` or `destroy()` method. Teardown must cancel all pending timer handles and empty pending event queues. Delayed task callbacks must verify the task ID remains active before dispatching completion events.
   - **Why:** Lingering asynchronous timers cause memory leaks and trigger ghost task completions after an agent has disconnected or switched workstations.

4. **Preserve authentic 16-bit styling via design tokens.**
   - **Applies to:** `src/style.css`, `index.html`, and UI overlay components.
   - **Rule:** All UI surfaces must use defined CSS custom properties (`--parchment`, `--wood-dark`, `--gold-trim`, `--panel-border-outer`). Typography must use pixel bitmap fonts (`'Press Start 2P'`, `'Silkscreen'`). Canvas elements must enforce `image-rendering: pixelated`. Do not use modern smooth web styling such as CSS blur filters, smooth drop shadows, off-token hex colors, or rounded border radii exceeding 4px on pixelated panels.
   - **Why:** Hearth's core design requirement is visual fidelity to 16-bit SNES and GBA era aesthetics; modern web styling immediately breaks immersion.

5. **Zero type escapes and test coverage for domain state.**
   - **Applies to:** Repository-wide (`src/**`)
   - **Rule:** Do not use `any` type casts to bypass TypeScript checks. Any modification to domain entities (`src/architecture/types.ts`), character activity state transitions, or weather ambient math must include corresponding Vitest tests in `src/architecture/__tests__/`. Code must pass both `npm test` and `tsc` with zero errors and zero warnings.
   - **Why:** Type safety and regression tests ensure that multi-agent integrations can evolve without breaking character behavior or corrupting the simulation state.

## Most opinionated rule for Qodo Day 2

> **Preserve authentic 16-bit styling via design tokens:** all UI surfaces must use defined CSS custom properties, retro bitmap fonts, and pixelated canvas rendering, prohibiting modern smooth web styling like CSS blur filters, smooth drop shadows, off-token hex colors, and rounded corners exceeding 4px.

**Why this exists:** When coding agents generate or adjust web UI, they almost universally default to modern SaaS conventions: smooth border radii, blurred translucent cards, modern sans-serif fonts, and ad-hoc hex colors. In Hearth, the entire value proposition is delivering an authentic 16-bit retro RPG sanctuary that feels like an SNES or Game Boy Advance classic. A single smooth rounded button or blurry drop shadow breaks visual immersion. This rule establishes our design token palette (`--parchment`, `--wood-dark`, `--gold-trim`) and bitmap font constraints as non-negotiable boundaries across all styling and markup.

