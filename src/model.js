import { WORLD, TUNING, ENEMIES } from './config.js';

export function waveCount(wave) {
  if (!Number.isSafeInteger(wave) || wave < 1) throw new RangeError('Wave must be a positive integer');
  let previous = 2n, current = 3n;
  for (let i = 1; i < wave; i++) [previous, current] = [current, previous + current];
  return current;
}

export function createGame() {
  return {
    phase: 'break', time: 0, wave: 1, completed: 0,
    previous: 2n, total: 3n, spawned: 0n, defeated: 0n, kills: 0n,
    breakLeft: 1.8, spawnTimer: 0.2, nextId: 1, enemies: [], events: [],
    player: { x: WORLD.width / 2, y: 0, vy: 0, dir: 1, hp: 3, cooldown: 0, attack: 0, invulnerable: 0, moving: false },
  };
}

export function spawnEnemy(game, kind, side = 1) {
  const stats = ENEMIES[kind];
  const enemy = {
    ...stats, kind, id: game.nextId++, maxHp: stats.hp,
    x: side > 0 ? WORLD.width + 80 : -80, dir: -side, y: 0,
    state: 'walk', timer: 0, stun: 0, knockback: 0, flash: 0, dead: 0,
  };
  game.enemies.push(enemy);
  return enemy;
}

function defeat(game, enemy) {
  if (enemy.dead) return;
  enemy.dead = 0.8;
  game.defeated++;
  game.kills++;
  game.events.push({ type: 'defeat', x: enemy.x, y: enemy.y, kind: enemy.kind });
}

export function peck(game) {
  const p = game.player;
  if (p.cooldown > 0 || game.phase !== 'combat') return;
  p.cooldown = TUNING.peckCooldown;
  p.attack = 0.18;
  game.events.push({ type: 'peck', x: p.x, y: p.y });
  for (const e of game.enemies) {
    const ahead = (e.x - p.x) * p.dir;
    if (e.dead || ahead < -12 || ahead > TUNING.peckReach + (e.scale - 1) * 45 || p.y > 106 * e.scale) continue;
    e.hp--;
    e.stun = 0.32;
    e.flash = 0.16;
    e.knockback = p.dir * (e.kind === 'boss' ? 190 : 340);
    e.state = 'recover';
    e.timer = e.recovery;
    game.events.push({ type: 'hit', x: e.x - p.dir * 40, y: p.y + 65 });
    if (e.hp <= 0) defeat(game, e);
  }
}

export function hurtPlayer(game, direction) {
  const p = game.player;
  if (p.invulnerable > 0 || game.phase !== 'combat') return;
  p.hp--;
  p.invulnerable = TUNING.invulnerability;
  p.x = Math.max(65, Math.min(WORLD.width - 65, p.x + direction * 32));
  game.events.push({ type: 'hurt', x: p.x, y: p.y + 70 });
  if (p.hp <= 0) {
    game.phase = 'over';
    game.events.push({ type: 'over' });
  }
}

function movePlayer(game, input, dt) {
  const p = game.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.attack = Math.max(0, p.attack - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  const direction = Number(!!input.right) - Number(!!input.left);
  p.moving = direction !== 0;
  if (direction) p.dir = direction;
  p.x = Math.max(65, Math.min(WORLD.width - 65, p.x + direction * TUNING.speed * dt));
  if (input.jump && p.y === 0) {
    p.vy = TUNING.jump;
    game.events.push({ type: 'jump', x: p.x, y: 0 });
  }
  p.y += p.vy * dt;
  p.vy -= TUNING.gravity * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; }
  if (input.attack) peck(game);
}

function updateEnemy(game, e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  if (e.dead) { e.dead -= dt; e.y += 260 * dt; e.x += e.dir * 130 * dt; return; }
  e.x += e.knockback * dt;
  e.knockback *= Math.exp(-8 * dt);
  e.x = Math.max(-90, Math.min(WORLD.width + 90, e.x));
  if (e.stun > 0) { e.stun -= dt; return; }
  const delta = game.player.x - e.x;
  if (e.state === 'walk') {
    e.dir = Math.sign(delta) || e.dir;
    if (Math.abs(delta) > 118 * e.scale) e.x += e.dir * e.speed * dt;
    else { e.state = 'windup'; e.timer = e.windup; }
  } else if (e.state === 'windup') {
    e.timer -= dt;
    if (e.timer <= 0) { e.state = 'charge'; e.timer = e.kind === 'boss' ? 0.55 : 0.3; }
  } else if (e.state === 'charge') {
    e.x += e.dir * e.charge * dt;
    e.timer -= dt;
    if (Math.abs(game.player.x - e.x) < 67 * e.scale && game.player.y < 67 * e.scale) hurtPlayer(game, e.dir);
    if (e.timer <= 0) { e.state = 'recover'; e.timer = e.recovery; }
  } else {
    e.timer -= dt;
    if (e.timer <= 0) e.state = 'walk';
  }
}

function spawnNext(game, dt) {
  game.spawnTimer -= dt;
  if (game.spawned >= game.total || game.spawnTimer > 0 || game.enemies.filter(e => !e.dead).length >= TUNING.maxEnemies) return;
  const index = game.spawned;
  let kind = 'normal';
  if (game.wave % 5 === 0 && index === 0n) kind = 'boss';
  else if (game.wave >= 3 && index % 7n === 4n) kind = 'heavy';
  else if (game.wave >= 2 && index % 4n === 2n) kind = 'quick';
  spawnEnemy(game, kind, index % 2n === 0n ? 1 : -1);
  game.spawned++;
  game.spawnTimer = Math.max(0.7, TUNING.spawnInterval - game.wave * 0.04);
}

export function step(game, input, dt) {
  if (game.phase === 'over') return;
  game.time += dt;
  movePlayer(game, input, dt);
  if (game.phase === 'break') {
    for (const e of game.enemies) if (e.dead) updateEnemy(game, e, dt);
    game.enemies = game.enemies.filter(e => e.hp > 0 || e.dead > 0);
    game.breakLeft -= dt;
    if (game.breakLeft <= 0) { game.phase = 'combat'; game.events.push({ type: 'wave' }); }
    return;
  }
  spawnNext(game, dt);
  for (const e of game.enemies) {
    if (game.phase === 'over') break;
    updateEnemy(game, e, dt);
  }
  // A knocked-back pigeon briefly disrupts the next one, without multiplying damage.
  for (const e of game.enemies) {
    if (e.dead || Math.abs(e.knockback) < 130) continue;
    for (const other of game.enemies) {
      if (other === e || other.dead || other.stun > 0) continue;
      if (Math.abs(e.x - other.x) < 58 && (other.x - e.x) * e.knockback > 0) {
        other.stun = 0.22; other.knockback = e.knockback * 0.45;
      }
    }
  }
  game.enemies = game.enemies.filter(e => e.hp > 0 || e.dead > 0);
  if (game.phase === 'combat' && game.defeated === game.total) {
    game.completed = game.wave;
    game.wave++;
    [game.previous, game.total] = [game.total, game.previous + game.total];
    game.spawned = 0n; game.defeated = 0n;
    game.phase = 'break'; game.breakLeft = TUNING.rest; game.spawnTimer = 0.2;
    game.events.push({ type: 'clear', wave: game.completed });
  }
}

export function parseRecord(raw) {
  try {
    const record = JSON.parse(raw);
    if (record?.version !== 1 || !Number.isSafeInteger(record.wave) || record.wave < 0 || typeof record.kills !== 'string' || !/^\d{1,1000}$/.test(record.kills)) return { wave: 0, kills: 0n };
    return { wave: record.wave, kills: BigInt(record.kills) };
  } catch { return { wave: 0, kills: 0n }; }
}

export function bestRecord(record, game) {
  return game.completed > record.wave || (game.completed === record.wave && game.kills > record.kills)
    ? { wave: game.completed, kills: game.kills } : record;
}
