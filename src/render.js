import { WORLD } from './config.js';

export async function loadArt() {
  const art = {};
  await Promise.all(['park', 'sparrow', 'pigeon'].map(async name => {
    const image = new Image();
    image.src = new URL(`../assets/${name}.png`, import.meta.url).href;
    await image.decode();
    art[name] = image;
  }));
  return art;
}

export class Renderer {
  constructor(canvas, art) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.art = art;
    this.particles = [];
    this.shake = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }
  resize() {
    const scale = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.canvas.clientWidth * scale);
    this.canvas.height = Math.round(this.canvas.clientHeight * scale);
  }
  effects(events) {
    for (const event of events) {
      if (!['hit', 'defeat', 'hurt', 'jump'].includes(event.type)) continue;
      if (event.type === 'hurt') this.shake = 0.18;
      const count = this.reducedMotion ? 3 : event.type === 'defeat' ? 12 : 7;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: event.x, y: WORLD.ground - event.y, vx: (Math.random() - 0.5) * 250,
          vy: -70 - Math.random() * 200, life: 0.65, max: 0.65,
          angle: Math.random() * Math.PI, type: event.type,
        });
      }
    }
    if (this.particles.length > 100) this.particles.splice(0, this.particles.length - 100);
  }
  bird(image, rect, x, y, width, height, dir, angle = 0, opacity = 1, stretch = 1, tint = '') {
    const c = this.ctx;
    c.save();
    c.globalAlpha = opacity;
    c.translate(x, WORLD.ground - y);
    c.scale(dir * stretch, 1 / stretch);
    c.rotate(angle);
    if (tint) c.filter = tint;
    c.drawImage(image, ...rect, -width / 2, -height, width, height);
    c.restore();
  }
  shadow(x, y, width) {
    const c = this.ctx;
    c.fillStyle = `rgba(39,40,21,${Math.max(0.04, 0.23 - y / 800)})`;
    c.beginPath(); c.ellipse(x, WORLD.ground - 2, width / 2, 8, 0, 0, Math.PI * 2); c.fill();
  }
  draw(game, dt, menu = false) {
    const c = this.ctx;
    c.setTransform(this.canvas.width / WORLD.width, 0, 0, this.canvas.height / WORLD.height, 0, 0);
    c.clearRect(0, 0, WORLD.width, WORLD.height);
    c.save();
    this.shake = Math.max(0, this.shake - dt);
    if (this.shake && !this.reducedMotion) c.translate(Math.sin(game.time * 95) * this.shake * 18, 0);
    c.drawImage(this.art.park, 0, 0, WORLD.width, WORLD.height);
    // Small light ripples animate the painted pond without moving its shoreline.
    c.strokeStyle = 'rgba(255,248,211,0.23)'; c.lineWidth = 1.3;
    for (let i = 0; i < 14; i++) {
      const x = 355 + (i * 67) % 830;
      const y = 337 + (i * 31) % 76;
      c.beginPath(); c.ellipse(x + Math.sin(game.time + i) * 3, y, 8 + Math.sin(game.time * 1.4 + i) * 4, 1.1, 0, 0, Math.PI * 2); c.stroke();
    }
    if (menu) {
      const bob = this.reducedMotion ? 0 : Math.sin(game.time * 2) * 3;
      this.shadow(940, 0, 200);
      this.bird(this.art.sparrow, [320, 104, 1118, 683], 940, bob, 326, 200, -1);
    } else {
      for (const e of game.enemies) {
        const bob = e.state === 'walk' && !e.stun && !this.reducedMotion ? Math.abs(Math.sin(game.time * e.speed / 9 + e.id)) * 5 : 0;
        if (!e.dead) this.shadow(e.x, 0, 86 * e.scale);
        const angle = e.dead ? -0.35 : e.state === 'windup' ? -0.1 : e.state === 'charge' ? 0.16 : e.stun ? -0.15 : 0;
        const tint = e.flash > 0 ? 'brightness(1.7)' : e.kind === 'quick' ? 'hue-rotate(20deg) saturate(1.1)' : e.kind === 'boss' ? 'saturate(1.3) brightness(.85)' : '';
        this.bird(this.art.pigeon, [303, 116, 942, 830], e.x, e.y + bob, 146 * e.scale, 129 * e.scale, e.dir, angle, e.dead ? Math.max(0, e.dead / 0.8) : 1, e.kind === 'heavy' ? 1.13 : 1, tint);
        if (e.state === 'windup' && !e.dead && e.stun <= 0) {
          c.fillStyle = '#ffe5a0'; c.strokeStyle = '#773822'; c.lineWidth = 4;
          c.font = '900 31px Trebuchet MS'; c.textAlign = 'center';
          c.strokeText('!', e.x, WORLD.ground - 144 * e.scale);
          c.fillText('!', e.x, WORLD.ground - 144 * e.scale);
        }
        if (e.hp < e.maxHp && !e.dead) {
          const y = WORLD.ground - 138 * e.scale;
          c.fillStyle = '#234b49'; c.fillRect(e.x - 22, y, 44, 5);
          c.fillStyle = '#f5c76b'; c.fillRect(e.x - 22, y, 44 * e.hp / e.maxHp, 5);
        }
      }
      const p = game.player;
      this.shadow(p.x, p.y, 93);
      const bob = p.moving && p.y === 0 && !this.reducedMotion ? Math.abs(Math.sin(game.time * 20)) * 7 : 0;
      const hit = p.attack > 0 ? Math.sin(p.attack / 0.18 * Math.PI) : 0;
      const opacity = p.invulnerable > 0 && Math.floor(game.time * 14) % 2 === 0 ? 0.45 : 1;
      this.bird(this.art.sparrow, [320, 104, 1118, 683], p.x + p.dir * hit * 18, p.y + bob, 170, 104, p.dir, p.y > 0 ? -0.1 : hit * 0.07, opacity, 1 + hit * 0.12);
      if (p.attack > 0) {
        c.strokeStyle = `rgba(255,243,185,${p.attack / 0.18})`; c.lineWidth = 5;
        c.beginPath(); c.ellipse(p.x + p.dir * 91, WORLD.ground - p.y - 67, 22, 13, -0.4 * p.dir, -1.2, 1.2); c.stroke();
      }
    }
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 360 * dt; p.angle += dt * 5;
      c.save(); c.translate(p.x, p.y); c.rotate(p.angle); c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.type === 'hurt' ? '#f47b64' : p.type === 'defeat' ? '#d5d9de' : '#fff0ad';
      c.beginPath(); c.ellipse(0, 0, p.type === 'defeat' ? 8 : 5, 2.3, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    this.particles = this.particles.filter(p => p.life > 0);
    c.restore();
  }
}
