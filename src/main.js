import { createGame, step, parseRecord, bestRecord } from './model.js';
import { Renderer, loadArt } from './render.js';
import { createInput } from './input.js';
import { Sound, MUSIC, COOS } from './audio.js';

const $ = id => document.getElementById(id);
const sound = new Sound();
$('sound').setAttribute('aria-pressed', 'true');
let game = createGame(), screen = 'menu', renderer, ready = false;
let record;
try { record = parseRecord(localStorage.getItem('brave-sparrow-record')); } catch { record = parseRecord(null); }
const input = createInput(() => { if (!$('audio-settings').open) screen === 'playing' ? pause() : screen === 'paused' && resume(); });
const portrait = matchMedia('(orientation: portrait)');
const count = value => value.toLocaleString('ru-RU');
let lastHud = '', announcement = '', lastSave = '';
let musicPreview = false, previewRequest = 0;
let commentaryTimer;
function hideCommentary() {
  clearTimeout(commentaryTimer);
  $('commentator').hidden = true;
  $('commentator-status').textContent = '';
}
function showCommentary(type) {
  hideCommentary();
  $('commentator-line').textContent = type === 'clear' ? 'Андрющ, красава' : 'Ну Анрющ, подвел пацанов';
  $('commentator-status').textContent = $('commentator-line').textContent;
  $('commentator').dataset.corner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'][Math.floor(Math.random() * 4)];
  $('commentator').hidden = false;
  for (const animation of $('commentator').getAnimations({ subtree: true })) animation.currentTime = 0;
  // Wall-clock time keeps the cameo short even after the game simulation stops.
  commentaryTimer = setTimeout(hideCommentary, 3000);
}
try {
  const saved = JSON.parse(localStorage.getItem('brave-sparrow-audio'));
  sound.selectMusic(saved?.music); sound.selectCoo(saved?.coo);
} catch { /* Sound choices are optional when browser storage is unavailable. */ }
for (const [id, variants] of [['music-choice', MUSIC], ['coo-choice', COOS]]) {
  for (const variant of variants) $(id).add(new Option(variant.title, variant.id));
}
function audioLabels() {
  $('music-choice').value = sound.musicVariant.id; $('coo-choice').value = sound.cooVariant.id;
  $('music-description').textContent = `${sound.musicVariant.description} · ${sound.musicVariant.bpm} BPM`;
  $('coo-description').textContent = sound.cooVariant.description;
  $('preview-music').textContent = musicPreview ? '■ Остановить музыку' : '▶ Слушать музыку';
  $('preview-music').setAttribute('aria-pressed', String(musicPreview));
}
function saveAudio() {
  try { localStorage.setItem('brave-sparrow-audio', JSON.stringify({ music: sound.musicVariant.id, coo: sound.cooVariant.id })); } catch { /* The current session can still use the choice. */ }
  audioLabels();
}
function stopPreview() { previewRequest++; musicPreview = false; sound.setPlaying(false); audioLabels(); }
function openAudio() { audioLabels(); $('audio-settings').showModal(); }
function toggleSound() {
  sound.unlock(); const enabled = sound.toggle();
  $('sound').textContent = enabled ? '♫' : '♪̸';
  $('sound').setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
  $('sound').setAttribute('aria-pressed', String(enabled));
}
async function previewReady(request) {
  if (!sound.enabled) toggleSound();
  await sound.unlock();
  if (request !== previewRequest || !$('audio-settings').open) return false;
  $('audio-status').textContent = sound.audible ? 'Выбранные варианты звучат и в бою. Выбор сохраняется.' : 'Звук недоступен. Проверь настройки звука в браузере.';
  return sound.audible;
}

function updateRecord() {
  const next = bestRecord(record, game);
  record = next;
  const data = JSON.stringify({ version: 1, wave: record.wave, kills: String(record.kills) });
  if (data === lastSave) return;
  try { localStorage.setItem('brave-sparrow-record', data); lastSave = data; } catch { /* A private browser can still play without saving. */ }
}
function recordLabel() { $('record').textContent = record.kills > 0n ? `РЕКОРД: ${record.wave} ВОЛН · ${count(record.kills)} ✦` : 'ПЕРВЫЙ ВЫЛЕТ?'; }
function show(next) {
  screen = next;
  sound.setPlaying(next === 'playing');
  input.clear();
  $('menu').hidden = next !== 'menu';
  $('pause-screen').hidden = next !== 'paused';
  $('result').hidden = next !== 'over';
  $('hud').hidden = next === 'menu';
  $('controls').hidden = next !== 'playing';
  if (next !== 'playing') $('announcement').hidden = true;
  if (next === 'menu') { hideCommentary(); recordLabel(); }
}
function start() {
  if (!ready || portrait.matches) return;
  hideCommentary();
  sound.unlock();
  game = createGame();
  renderer.particles.length = 0;
  sound.reset();
  lastHud = ''; announcement = '';
  show('playing');
  hud();
  document.activeElement?.blur();
}
function pause() { if (screen === 'playing') { show('paused'); $('resume').focus({ preventScroll: true }); } }
function resume() {
  if (screen !== 'paused' || portrait.matches || document.hidden) return;
  sound.unlock(); show('playing'); document.activeElement?.blur();
}
function home() { updateRecord(); show('menu'); $('start').focus({ preventScroll: true }); }
function gameOver() {
  const previous = record;
  updateRecord();
  $('result-wave').textContent = game.completed;
  $('result-kills').textContent = count(game.kills);
  $('new-record').hidden = record === previous;
  show('over'); sound.play('over'); $('restart').focus({ preventScroll: true });
}
function hud() {
  const key = `${game.player.hp}:${game.wave}:${game.defeated}:${game.kills}:${game.phase}`;
  if (key !== lastHud) {
    lastHud = key;
    $('hearts').textContent = Array.from({ length: 3 }, (_, i) => i < game.player.hp ? '♥' : '♡').join(' ');
    $('hearts').setAttribute('aria-label', `Здоровье: ${game.player.hp} из 3`);
    $('wave').textContent = `ВОЛНА ${game.wave}`;
    $('remaining').textContent = `${count(game.total - game.defeated)} осталось · ${count(game.total)} в стае`;
    $('score').textContent = count(game.kills);
    $('progress').style.width = `${Number(game.defeated * 10000n / game.total) / 100}%`;
  }
  if (game.phase === 'break') {
    const title = game.wave === 1 ? 'За свою скамейку!' : `Волна ${game.wave - 1} отбита!`;
    const caption = `Волна ${game.wave} · ${count(game.total)} голубей · ${Math.max(1, Math.ceil(game.breakLeft))}`;
    if (announcement !== caption) {
      $('announcement').querySelector('strong').textContent = title;
      $('announcement').querySelector('span').textContent = caption;
      announcement = caption;
    }
    $('announcement').hidden = false;
  } else $('announcement').hidden = true;
}

$('start').addEventListener('click', () => start());
$('restart').addEventListener('click', () => start());
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('pause-home').addEventListener('click', home);
$('result-home').addEventListener('click', home);
$('sound').addEventListener('click', toggleSound);
$('menu-audio').addEventListener('click', openAudio);
$('pause-audio').addEventListener('click', openAudio);
$('audio-close').addEventListener('click', () => $('audio-settings').close());
$('audio-settings').addEventListener('close', () => { stopPreview(); input.clear(); });
$('music-choice').addEventListener('change', event => { sound.selectMusic(event.target.value); saveAudio(); });
$('coo-choice').addEventListener('change', event => { sound.selectCoo(event.target.value); saveAudio(); });
$('preview-music').addEventListener('click', async () => {
  if (musicPreview) { stopPreview(); return; }
  musicPreview = true; audioLabels();
  const request = previewRequest, ready = await previewReady(request);
  if (request !== previewRequest) return;
  if (!ready) { stopPreview(); return; }
  if (musicPreview) { sound.reset(); sound.setPlaying(true); }
});
$('preview-coo').addEventListener('click', async () => { if (await previewReady(previewRequest)) { sound.lastCoo = -Infinity; sound.pigeon(); } });
// A mobile audio interruption may need another user gesture.
$('game').addEventListener('pointerdown', () => { if (screen === 'playing') sound.unlock(); });
window.addEventListener('keydown', () => { if (screen === 'playing') sound.unlock(); });
function interruptAudio() { pause(); if ($('audio-settings').open) stopPreview(); }
window.addEventListener('blur', interruptAudio);
document.addEventListener('visibilitychange', () => { if (document.hidden) interruptAudio(); });
portrait.addEventListener('change', () => { if (portrait.matches) { interruptAudio(); $('audio-settings').close(); } });
new ResizeObserver(() => renderer?.resize()).observe($('game'));
recordLabel();

let last = 0, accumulator = 0;
function frame(time) {
  const dt = last ? Math.min((time - last) / 1000, 0.1) : 0;
  last = time;
  if (screen === 'playing') {
    accumulator += dt;
    const held = input.read();
    while (accumulator >= 1 / 60) { step(game, held, 1 / 60); accumulator -= 1 / 60; }
    renderer.effects(game.events);
    for (const event of game.events) {
      if (event.type !== 'over') sound.play(event.type);
      if (event.type === 'clear') updateRecord();
      if (event.type === 'clear' || event.type === 'over') showCommentary(event.type);
    }
    game.events.length = 0;
    hud();
    if (game.phase === 'over') gameOver();
    else sound.update(game.time, game.enemies);
  } else { accumulator = 0; if (screen === 'menu') game.time += dt; if (musicPreview) sound.update(0, []); }
  renderer.draw(game, screen === 'playing' || screen === 'menu' ? dt : 0, screen === 'menu');
  requestAnimationFrame(frame);
}
try {
  renderer = new Renderer($('scene'), await loadArt());
  await $('commentator-photo').decode();
  ready = true;
  $('start').disabled = false;
  $('start').textContent = 'Защитить скамейку →';
  requestAnimationFrame(frame);
} catch (error) { console.error('Не удалось загрузить игру:', error); $('load-error').hidden = false; }
