import type { WorldState } from '../architecture/WorldState';
import type { AgentModel } from '../architecture/types';
import { bakeScene, type BakedScene, PIXEL_SCALE } from './TerrainBaker';
import {
  CHARACTER_HEIGHT,
  CHARACTER_WIDTH,
  getSprite,
  SCOUT,
  BLACKSMITH,
  SCRIBE,
  BARD,
  KNIGHT,
  SHEEP_IDLE,
  SHEEP_GRAZE,
  type CharacterFrame,
} from './pixel/sprites';

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export class PixelRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTimer = 0;
  private bakedScene: BakedScene | null = null;
  private smoke: SmokeParticle[] = [];
  private sheepX = 430;
  private sheepY = 230;
  private sheepGrazeTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context from canvas');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.initSmoke();
  }

  private initSmoke(): void {
    this.smoke = [];
    for (let i = 0; i < 18; i++) {
      this.smoke.push({
        x: 380 + (Math.random() - 0.5) * 10,
        y: 260 - Math.random() * 45,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 14 - 10,
        size: Math.random() * 5 + 3,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
  }

  public render(world: WorldState, deltaMs: number): void {
    this.animTimer += deltaMs;
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Ensure baked terrain scene exists
    if (!this.bakedScene) {
      const logicalW = Math.round(width / PIXEL_SCALE);
      const logicalH = Math.round(height / PIXEL_SCALE);
      this.bakedScene = bakeScene(logicalW, logicalH, world.workstations);
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Draw High-Detail Baked Ground Scenery (Meadow, rutted dirt, cliffs, flagstones, props)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bakedScene.ground, 0, 0, width, height);

    // 2. Animated Swaying Grass Tufts
    this.drawSwayingTufts();

    // 3. Dynamic Workstation Effects (Campfire flames, candle flickers, forge glow)
    this.drawWorkstationDynamicLights(world);

    // 4. Campfire Smoke Particles
    this.drawSmokeParticles(deltaMs);

    // 5. Sheep Companion
    this.drawSheep(deltaMs);

    // 6. Chibi Pixel Characters (Sorted by Y for depth)
    this.drawCharacters(world);

    // 7. Tree Canopies Foreground Layer (Allows agents to walk behind trees)
    ctx.drawImage(this.bakedScene.foreground, 0, 0, width, height);

    // 8. Overhead UI & Speech Bubbles (Always on top of trees)
    this.drawOverheads(world);

    // 9. Weather Atmosphere & Ambient Lighting Tint
    this.drawAtmosphere(world, width, height);
  }

  private drawSwayingTufts(): void {
    if (!this.bakedScene) return;
    const ctx = this.ctx;
    ctx.fillStyle = '#95c364';

    const t = this.animTimer * 0.003;
    for (const tuft of this.bakedScene.tufts) {
      const sway = Math.round(Math.sin(t + tuft.x * 0.15) * 1.5);
      const sx = tuft.x * PIXEL_SCALE;
      const sy = tuft.y * PIXEL_SCALE;
      // Draw 2x scaled grass tip
      ctx.fillRect(sx + sway, sy - tuft.h * PIXEL_SCALE, 2, 4);
    }
  }

  private drawWorkstationDynamicLights(world: WorldState): void {
    const ctx = this.ctx;

    // Campfire Fire Animation
    const fire = world.workstations.find((s) => s.id === 'camp_fire');
    if (fire) {
      const fx = fire.position.x;
      const fy = fire.position.y;
      const flicker = Math.sin(this.animTimer * 0.015) * 2;

      // Warm radial light gradient on ground
      const glow = ctx.createRadialGradient(fx, fy, 4, fx, fy, 48 + flicker * 2);
      glow.addColorStop(0, 'rgba(255, 130, 40, 0.45)');
      glow.addColorStop(0.5, 'rgba(245, 170, 50, 0.2)');
      glow.addColorStop(1, 'rgba(245, 170, 50, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fx, fy, 48 + flicker * 2, 0, Math.PI * 2);
      ctx.fill();

      // Flame tongue pixels
      ctx.fillStyle = '#ff6a1a';
      ctx.fillRect(fx - 4, fy - 6 + flicker, 8, 8);
      ctx.fillStyle = '#ffd13b';
      ctx.fillRect(fx - 2, fy - 8 + flicker, 5, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx - 1, fy - 10 + flicker, 2, 3);
    }

    // Desk Candle flame flicker
    const desk = world.workstations.find((s) => s.id === 'writing_desk');
    if (desk) {
      const dx = desk.position.x + 16;
      const dy = desk.position.y - 20;
      const flick = Math.sin(this.animTimer * 0.02) > 0 ? 1 : 0;
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(dx, dy + flick, 2, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy - 1 + flick, 2, 1);
    }
  }

  private drawSmokeParticles(deltaMs: number): void {
    const ctx = this.ctx;
    const dt = deltaMs / 1000;

    for (const p of this.smoke) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 0.12;

      if (p.alpha <= 0 || p.y < 160) {
        p.x = 380 + (Math.random() - 0.5) * 10;
        p.y = 265;
        p.alpha = Math.random() * 0.35 + 0.15;
      }

      ctx.fillStyle = `rgba(226, 232, 240, ${Math.max(0, p.alpha)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSheep(deltaMs: number): void {
    this.sheepGrazeTimer += deltaMs;
    const isGrazing = (Math.floor(this.sheepGrazeTimer / 2500) % 2) === 1;
    const sprite = isGrazing ? SHEEP_GRAZE : SHEEP_IDLE;
    const canvas = getSprite(isGrazing ? 'sheep_graze' : 'sheep_idle', sprite);

    const ctx = this.ctx;
    const dw = canvas.width * PIXEL_SCALE;
    const dh = canvas.height * PIXEL_SCALE;

    // Drop shadow
    ctx.fillStyle = 'rgba(20, 30, 20, 0.4)';
    ctx.beginPath();
    ctx.ellipse(this.sheepX + dw / 2, this.sheepY + dh - 2, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(canvas, this.sheepX, this.sheepY, dw, dh);
  }

  private drawCharacters(world: WorldState): void {
    const ctx = this.ctx;

    // Sort agents by Y position for proper 2.5D perspective overlap
    const sorted = Array.from(world.agents.values()).sort((a, b) => a.position.y - b.position.y);

    for (const agent of sorted) {
      this.drawAgentSprite(ctx, agent);
    }
  }

  private drawAgentSprite(ctx: CanvasRenderingContext2D, agent: AgentModel): void {
    const { x, y } = agent.position;
    const isWalking = agent.activity === 'walking';

    // Select character sprite set
    let charSet = SCOUT;
    if (agent.role === 'blacksmith') charSet = BLACKSMITH;
    else if (agent.role === 'scribe') charSet = SCRIBE;
    else if (agent.role === 'bard') charSet = BARD;
    else if (agent.role === 'knight') charSet = KNIGHT;

    // Select animation frame
    let frame: CharacterFrame = 'idle';
    if (isWalking) {
      const step = Math.floor(this.animTimer / 160) % 2;
      frame = step === 0 ? 'walkA' : 'walkB';
    } else {
      // Natural blinking
      const inBlink = (this.animTimer % 3200) < 180;
      frame = inBlink ? 'blink' : 'idle';
    }

    // Facing direction
    const flip = agent.targetPosition ? agent.targetPosition.x < agent.position.x : false;
    const spriteCanvas = getSprite(`${agent.role}_${frame}`, charSet[frame], flip);

    const dw = CHARACTER_WIDTH * PIXEL_SCALE;
    const dh = CHARACTER_HEIGHT * PIXEL_SCALE;
    const drawX = Math.round(x - dw / 2);
    const drawY = Math.round(y - dh);

    // Drop shadow
    ctx.fillStyle = 'rgba(20, 30, 20, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Chibi Sprite at crisp 2x scale
    ctx.drawImage(spriteCanvas, drawX, drawY, dw, dh);
  }

  private drawOverheads(world: WorldState): void {
    const ctx = this.ctx;

    for (const agent of world.agents.values()) {
      const { x, y } = agent.position;
      const headY = y - CHARACTER_HEIGHT * PIXEL_SCALE;

      // Name & Role Tag
      this.drawNameTag(ctx, x, headY - 8, agent.name, agent.role);

      // Speech bubble if active task/thought
      if (agent.currentTaskTitle) {
        this.drawSpeechBubble(ctx, x, headY - 32, agent.currentTaskTitle);
      }
    }
  }

  private drawNameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, role: string): void {
    const tag = `${name} (${role})`;
    ctx.font = 'bold 10px monospace';
    const textW = ctx.measureText(tag).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(x - textW / 2 - 4, y - 8, textW + 8, 14);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - textW / 2 - 4, y - 8, textW + 8, 14);

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(tag, x, y + 3);
  }

  private drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    const truncated = text.length > 32 ? text.substring(0, 30) + '...' : text;
    ctx.font = 'bold 11px sans-serif';
    const textW = ctx.measureText(truncated).width;
    const pad = 8;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x - textW / 2 - pad, y - 10, textW + pad * 2, 22, 6);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 12);
    ctx.lineTo(x, y + 17);
    ctx.lineTo(x + 4, y + 12);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(truncated, x, y + 5);
  }

  private drawAtmosphere(world: WorldState, w: number, h: number): void {
    const ctx = this.ctx;

    // Ambient weather tint
    ctx.fillStyle = world.weather.ambientTint;
    ctx.fillRect(0, 0, w, h);

    // Weather particles
    if (world.weather.type === 'rain' || world.weather.type === 'storm') {
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.4)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 45; i++) {
        const rx = ((i * 41 + this.animTimer * 0.45) % (w + 40)) - 20;
        const ry = ((i * 67 + this.animTimer * 1.1) % (h + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 5, ry + 16);
        ctx.stroke();
      }
    }
  }
}
