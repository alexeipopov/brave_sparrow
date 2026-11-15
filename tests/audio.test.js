import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';

class Param {
  constructor(value = 1) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  constructor() {
    for (const key of ['gain', 'frequency', 'playbackRate', 'pan', 'threshold', 'ratio', 'Q']) this[key] = new Param();
    this.stops = [];
  }
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
  start(time = 0) { this.started = time; }
  stop(time) { this.stops.push(time); }
}
class Context {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.sources = []; this.destination = new Node(); }
  createGain() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createStereoPanner() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(channels, length, rate) { const data = new Float32Array(length); return { duration: length / rate, getChannelData: () => data }; }
  async resume() { this.state = 'running'; }
}
beforeEach(() => { globalThis.window = { AudioContext: Context }; });

test('audio stays optional when unavailable or autoplay is blocked', async () => {
  globalThis.window = {};
  const missing = new Sound(); await missing.unlock();
  missing.play('hit'); missing.setPlaying(true); missing.update(10, []);
  assert.equal(missing.context, null);
  globalThis.window.AudioContext = class extends Context {
    constructor() { super(); this.state = 'suspended'; }
    async resume() { throw new Error('Autoplay blocked'); }
  };
  const blocked = new Sound(); await blocked.unlock(); blocked.play('hit');
  assert.equal(blocked.context.sources.length, 0);
});

test('mute and pause stop active audio and prevent additional scheduling', async () => {
  const sound = new Sound(); await sound.unlock(); sound.setPlaying(true);
  sound.update(0, []); sound.play('hit');
  assert.ok(sound.context.sources.length > 3);
  const count = sound.context.sources.length;
  sound.setPlaying(false); sound.context.currentTime = 10; sound.update(10, []);
  assert.equal(sound.context.sources.length, count);
  assert.ok(sound.context.sources.every(source => source.stops.some(time => time <= 0.04)));
  sound.setPlaying(true); sound.toggle(); sound.play('hit'); sound.update(11, []);
  assert.equal(sound.context.sources.length, count);
  assert.equal(sound.gain.gain.value, 0);
  sound.toggle(); sound.update(12, []);
  sound.context.currentTime += 0.3; sound.update(12.3, []);
  assert.ok(sound.context.sources.length > count);
  assert.ok(sound.context.sources.length - count < 10, 'No burst of missed beats on resume');
});

test('pigeons have a finite three-syllable waveform and do not coo without enemies', async () => {
  const sound = new Sound(); await sound.unlock(); sound.setPlaying(true);
  const data = sound.coo.getChannelData(0);
  assert.ok(data.every(Number.isFinite));
  assert.ok(data.some(sample => Math.abs(sample) > 0.4));
  assert.ok(data.every(sample => Math.abs(sample) < 1));
  assert.equal(data[Math.floor(0.25 * sound.context.sampleRate)], 0);
  sound.update(4, []); assert.equal(sound.lastCoo, -Infinity);
  sound.update(4, [{ x: 900, dead: 0, kind: 'normal' }]);
  assert.equal(sound.lastCoo, 0);
  const count = sound.context.sources.length;
  sound.pigeon(); assert.equal(sound.context.sources.length, count);
  sound.context.currentTime = 2; sound.pigeon(0, true);
  assert.equal(sound.context.sources.length, count + 1);
});

test('finished voices disconnect and reset starts a fresh musical phrase', async () => {
  const sound = new Sound(); await sound.unlock(); sound.setPlaying(true);
  sound.update(3, [{ x: 500, dead: 0, kind: 'boss' }]);
  for (const source of sound.context.sources) source.onended();
  assert.equal(sound.voices.size, 0);
  assert.ok(sound.context.sources.every(source => source.disconnected));
  sound.reset(); assert.equal(sound.beat, 0); assert.equal(sound.nextCoo, 2.5);
  for (let i = 0; i < 100; i++) sound.play('hit');
  assert.equal(sound.voices.size, 48, 'Polyphony stays bounded');
});
