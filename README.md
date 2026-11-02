# 🏕️ Hearth — The Cozy AI Agent Sanctuary

> *"A living 16-bit top-down RPG sanctuary where your background AI agents live, work, and automate real tasks—while the world and its music sync to your actual window."*

Built for the **Qodo Hackathon: Build a Software Factory in 30 Days**.

---

## 📖 Overview

Instead of invisible CLI spinners, terminal logs, or background cron jobs, **Hearth** transforms your AI workflows into an interactive, 16-bit retro RPG companion running in a pinned browser tab on your second monitor.

Your real AI agents (connected via **Antigravity, Cursor, OpenAI, or local CLI bridges**) physically inhabit the world as charming chibi characters. When an agent starts a task, they walk across the stone flagstones to their dedicated workstation, hammer at the anvil, study ancient scrolls, or plan expeditions—displaying real-time thoughts and summaries in pixel speech bubbles.

The entire sanctuary dynamically reflects your physical surroundings:
* **Real-World Weather Sync:** Uses keyless telemetry from [Open-Meteo](https://open-meteo.com/) to match your real local weather (rain outside = rain on the pixel canopy).
* **Weather-Matched Soundscape:** An embedded 16-bit "Sound Test" engine queues dynamic YouTube ambient and lo-fi streams tailored to your current weather and time of day.

---

## 👥 Guild Personas & Agent Profiles

Every character in Hearth is a specialized autonomous agent with a unique visual appearance, workstation, and domain responsibility within your software factory:

### 🧭 Rowan the Scout
* **Factory Role:** Autonomous Research, Web Discovery & Dependency Intelligence
* **Power Source / Provider:** Antigravity / Gemini / Web Search Tools
* **Visual Appearance:** Chibi ranger in a forest-green traveling hood, leather belt with a gold buckle, dark tunic, and a sharp harvesting sickle.
* **Workstation:** **The Campfire** (where expeditions are planned over warm glowing coals).
* **Personality & Lore:** Quick-footed, inquisitive, and observant. Rowan loves venturing beyond the safety of the sanctuary to explore uncharted APIs, investigate GitHub trending repositories, and scout documentation. When given an open-ended question, Rowan scours the web and returns to the campfire with concise situational digests.
* **In-Game Behavior:** Roams the clearing, crouches by the fire, displays question-mark thought bubbles when parsing context, and strikes golden action sparks when reporting back.

---

### 🔨 Brann the Blacksmith
* **Factory Role:** Code Review, Test Synthesis & Build Integrity
* **Power Source / Provider:** Cursor / Qodo / Local CLI Bridge
* **Visual Appearance:** Burly artisan with a thick braided auburn beard, rolled-up leather apron, bare muscular arms, and heavy iron smithing hammer.
* **Workstation:** **The Iron Forge** (a heavy steel anvil mounted on an ancient oak stump over stone flagstones, complete with water cooling barrel).
* **Personality & Lore:** Gruff, meticulous, and fiercely protective of code craftsmanship. Brann doesn't tolerate brittle code, flaky tests, or silent regressions. Whenever a pull request is opened, Brann fires up the forge, runs automated test suites, and invokes Qodo reviews to inspect every weld and seam before changes merge.
* **In-Game Behavior:** Walks to the anvil, hammers furiously during test runs, wipes his brow, and emits celebratory sparks when quality gates pass.

---

### 📜 Elowen the Scribe
* **Factory Role:** Task Orchestration, Daily Standups & Architecture Logs
* **Power Source / Provider:** OpenAI / Claude / Local LLM
* **Visual Appearance:** Erudite scholar with long pale flaxen hair, delicate gold spectacles, and flowing royal violet robes.
* **Workstation:** **The Scribe Library Desk** (a hand-crafted timber deck furnished with open parchment maps, leather-bound books, an inkpot with feather quill, and a flickering candle).
* **Personality & Lore:** Calm, highly organized, and deeply contemplative. Elowen takes messy brainstorms, bug reports, and user feedback, synthesizing them into structured tasks, roadmaps, and architecture documentation. She acts as the memory and chronological conscience of your project.
* **In-Game Behavior:** Sits at her desk, dips her quill in ink, reads through open scrolls, and pops up milestone reminders.

---

### 🪕 Lyric the Bard
* **Factory Role:** Ambient Soundscape & Flow-State Accompanist
* **Power Source / Provider:** YouTube IFrame Engine & Real-Time Weather Service
* **Visual Appearance:** Flamboyant minstrel with wavy golden hair, feathered traveling cap, royal purple doublet with gold trim, and a cherrywood lute.
* **Workstation:** **The Central Hearth & Meadow Grove**.
* **Personality & Lore:** Harmonious, perceptive, and in tune with the atmosphere. Lyric monitors your actual local climate and time of day. When heavy rain rolls in, Lyric shifts the harmony to cozy rainy-day jazz and soft Rhodes piano. When the sun shines, he strikes up upbeat acoustic Stardew/Zelda-inspired melodies to keep your flow state unbroken.
* **In-Game Behavior:** Strums his lute by the campfire, nods along with the tempo, and links directly to curated streams.

---

### 🛡️ Sir Patricia the Knight Guardian
* **Factory Role:** Security Sentinel, Access Control & Secret Scanner
* **Power Source / Provider:** Pre-commit Security Scanners & Linter Guards
* **Visual Appearance:** Stoic armored knight clad head-to-toe in polished plate steel with a glowing golden visor slit and crimson heraldic tabard.
* **Workstation:** **The North Outpost Guard Station**.
* **Personality & Lore:** Unyielding, noble, and ever-vigilant. Sir Patricia stands watch over the sanctuary's northern path, ensuring no unauthorized credentials, leaked secrets, or malicious dependencies enter the codebase.
* **In-Game Behavior:** Stands at attention, salutes with a halberd, and intercepts suspect operations before they reach the guild.

---

### 🐑 Barnaby the Sheep Companion
* **Factory Role:** Sanctuary Mascot & Stress Reducer
* **Visual Appearance:** Delightfully plump meadow sheep with soft curly wool and floppy dark horns.
* **Workstation:** **The Clover Patches**.
* **Personality & Lore:** Completely unconcerned with deadlines, merge conflicts, or compiler warnings.
* **In-Game Behavior:** Wanders leisurely through the grass, alternating between resting and chewing on clover.

---

## 🎨 Retro 16-Bit Aesthetic & Engine Architecture

* **Procedural Pixel-Art Engine (`src/render/TerrainBaker.ts`):**
  * Handcrafted dithered grass, rutted wagon-wheel dirt trails, rocky strata cliff edges, and fallen autumn leaves.
  * **2.5D Canopy Depth:** Tree canopies are baked into a separate foreground layer so characters can physically walk behind and beneath the trees.
* **Authentic 16-Bit UI (`src/style.css`):**
  * Beveled wood & gold-trim RPG dialogue boxes with tactile chunky 3D buttons.
  * Typography powered by `'Press Start 2P'` and `'Silkscreen'`.
  * Subtle CRT scanline overlay and repeating tavern wood/stone floor background.
* **Decoupled Architecture (`src/architecture/`):**
  * `IAgentProvider`: Clean adapter interface supporting Antigravity, Cursor, OpenAI, or local event bridges.
  * `IWeatherProvider`: Keyless Open-Meteo weather integration with ambient tint calculations.
  * `WorldState`: Deterministic physics tick loop, delta-time interpolation, and event streaming.

---

## 🛠️ Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* npm

### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/csontosati/hearth.git
cd hearth

# Install dependencies
npm install

# Start the retro companion
npm run dev
```

Open `http://localhost:5173` in your browser.

### Running Automated Tests
```bash
npm test
```
Runs 5 automated Vitest unit tests verifying state transitions, weather ambient calculations, and event dispatching.

---

## 🗺️ 30-Day "Software Factory" Roadmap
* **Week 1 (Foundations):** 16-Bit visual world, character state machine, live weather & audio engine, and initial Qodo PR quality gate.
* **Week 2 (The Agent Bridge):** Local WebSocket / SSE bridge connecting real agent events from Antigravity and Cursor directly into character behaviors.
* **Week 3 (Multi-Agent Workflows):** Agents delegating sub-tasks to one another (Scout gathers web intelligence $\rightarrow$ passes to Scribe $\rightarrow$ Blacksmith writes and verifies code).
* **Week 4 (Sanctuary Polish):** Custom guild expansions, sound effects, inventory/tool equipping, and autonomous daily report exports.

