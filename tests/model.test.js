import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, spawnEnemy, peck, step, waveCount, hurtPlayer, parseRecord, bestRecord } from '../src/model.js';

test('waves use exact Fibonacci counts starting at 3, beyond Number precision', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => waveCount(i + 1)), [3n, 5n, 8n, 13n, 21n, 34n, 55n, 89n]);
  assert.equal(waveCount(100), waveCount(99) + waveCount(98));
  assert.ok(waveCount(100) > BigInt(Number.MAX_SAFE_INTEGER));
  assert.throws(() => waveCount(0), RangeError);
});

test('pecks respect facing, height, cooldown and count a defeated enemy once', () => {
  const game = createGame(); game.phase = 'combat';
  const front = spawnEnemy(game, 'normal'); front.x = game.player.x + 110;
  const behind = spawnEnemy(game, 'normal'); behind.x = game.player.x - 110;
  peck(game); peck(game);
  assert.equal(front.hp, 1); assert.equal(behind.hp, 2);
  game.player.cooldown = 0; game.player.y = 200; peck(game);
  assert.equal(front.hp, 1);
  game.player.cooldown = 0; game.player.y = 0; peck(game);
  assert.equal(game.kills, 1n);
  game.player.cooldown = 0; peck(game);
  assert.equal(game.kills, 1n);
});

test('three hearts and invulnerability prevent one attack causing repeated damage', () => {
  const game = createGame(); game.phase = 'combat';
  hurtPlayer(game, 1); hurtPlayer(game, 1);
  assert.equal(game.player.hp, 2);
  game.player.invulnerable = 0; hurtPlayer(game, 1);
  game.player.invulnerable = 0; hurtPlayer(game, 1);
  assert.equal(game.phase, 'over');
});

test('a jump leaves the ground and returns, player stays inside arena', () => {
  const game = createGame();
  step(game, { jump: true }, 1 / 60);
  assert.ok(game.player.y > 0);
  for (let i = 0; i < 90; i++) step(game, { right: true }, 1 / 60);
  assert.equal(game.player.y, 0);
  assert.ok(game.player.x <= 1215);
});

test('crowds are bounded while full wave totals stay unchanged', () => {
  const game = createGame(true); game.phase = 'combat'; game.wave = 30; game.total = waveCount(30);
  for (let i = 0; i < 1800; i++) { step(game, {}, 1 / 60); game.events.length = 0; }
  assert.equal(game.enemies.filter(e => !e.dead).length, 4);
  assert.equal(game.total, waveCount(30));
  assert.equal(game.spawned, 4n);
});

test('a completed wave advances once, including past wave five', () => {
  const game = createGame(); game.wave = 5; game.previous = 13n; game.total = 21n;
  game.spawned = 21n; game.defeated = 21n; game.phase = 'combat';
  step(game, {}, 1 / 60);
  assert.equal(game.completed, 5); assert.equal(game.wave, 6); assert.equal(game.total, 34n);
  assert.equal(game.phase, 'break'); assert.equal(game.defeated, 0n);
  step(game, {}, 1 / 60); assert.equal(game.wave, 6);
});

test('record parsing tolerates corrupt saves and ranks completed waves first', () => {
  for (const raw of [null, '{', '{}', '{"version":1,"wave":-1,"kills":"0"}']) assert.deepEqual(parseRecord(raw), { wave: 0, kills: 0n });
  assert.deepEqual(parseRecord('{"version":1,"wave":3,"kills":"16"}'), { wave: 3, kills: 16n });
  const record = { wave: 3, kills: 16n };
  assert.equal(bestRecord(record, { completed: 2, kills: 999n }), record);
  assert.deepEqual(bestRecord(record, { completed: 3, kills: 17n }), { wave: 3, kills: 17n });
});

test('the final defeated pigeon flies away during the wave break', () => {
  const game = createGame(); game.phase = 'combat'; game.spawned = 3n; game.defeated = 2n;
  const e = spawnEnemy(game, 'quick'); e.x = game.player.x + 100;
  step(game, { attack: true }, 1 / 60);
  assert.equal(game.phase, 'break');
  for (let i = 0; i < 60; i++) step(game, {}, 1 / 60);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.phase, 'break');
});
