const EIGHTH = 60 / 104 / 2;
const MELODY = [
  72, 0, 76, 79, 76, 74, 72, 0, 76, 79, 81, 79, 76, 0, 74, 0,
  69, 0, 72, 76, 79, 76, 72, 0, 74, 76, 74, 72, 69, 0, 67, 0,
  65, 0, 69, 72, 76, 72, 69, 0, 72, 74, 76, 79, 76, 0, 72, 0,
  67, 0, 71, 74, 77, 74, 71, 0, 74, 76, 74, 71, 72, 0, 0, 0,
];
const CHORDS = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62]];
const hz = note => 440 * 2 ** ((note - 69) / 12);

function cooBuffer(context) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.45), context.sampleRate);
  const data = buffer.getChannelData(0);
  // Three breath-shaped syllables with a low, softly warbling throat tone.
  for (const [start, duration, pitch] of [[0, 0.22, 360], [0.28, 0.57, 405], [0.92, 0.39, 330]]) {
    let phase = 0;
    for (let i = 0; i < Math.floor(duration * context.sampleRate); i++) {
      const t = i / context.sampleRate, progress = t / duration;
      const frequency = pitch * (1 - progress * 0.18) + 7 * Math.sin(t * Math.PI * 2 * 22);
      phase += frequency * Math.PI * 2 / context.sampleRate;
      const envelope = Math.sin(Math.PI * progress) ** 0.8 * (0.88 + 0.12 * Math.sin(t * Math.PI * 2 * 28));
      data[Math.floor(start * context.sampleRate) + i] = envelope * (Math.sin(phase) * 0.68 + Math.sin(phase * 2) * 0.17 + Math.sin(phase * 3) * 0.045);
    }
  }
  return buffer;
}

export class Sound {
  constructor() {
    this.context = null; this.enabled = true; this.playing = false;
    this.voices = new Set(); this.beat = 0; this.nextBeat = 0; this.nextCoo = 2.5; this.lastCoo = -Infinity;
  }
  async unlock() {
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        const context = new Context();
        this.gain = context.createGain(); this.gain.gain.value = this.enabled ? 0.7 : 0;
        this.musicGain = context.createGain(); this.musicGain.gain.value = 0.72;
        this.musicGain.connect(this.gain);
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -14; compressor.ratio.value = 4;
        this.gain.connect(compressor); compressor.connect(context.destination);
        this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const noise = this.noise.getChannelData(0);
        for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
        this.coo = cooBuffer(context);
        this.context = context;
      }
      if (this.context.state !== 'running') await this.context.resume();
    } catch { /* A blocked audio device must never prevent playing. */ }
  }
  get audible() { return this.enabled && this.context?.state === 'running'; }
  stopVoices() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.voices) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, 0.008);
      voice.source.stop(now + 0.04);
    }
    this.nextBeat = 0;
  }
  setPlaying(playing) { this.playing = playing; if (!playing) this.stopVoices(); }
  reset() { this.stopVoices(); this.beat = 0; this.nextCoo = 2.5; this.lastCoo = -Infinity; }
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopVoices();
    if (this.gain) this.gain.gain.setTargetAtTime(this.enabled ? 0.7 : 0, this.context.currentTime, 0.015);
    return this.enabled;
  }
  voice(source, duration, volume, when, destination, filter = null, pan = 0) {
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner(); panner.pan.value = pan;
    source.connect(filter || gain); if (filter) filter.connect(gain);
    gain.connect(panner); panner.connect(destination || this.gain);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    const voice = { source, gain };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); filter?.disconnect(); this.voices.delete(voice); };
    source.start(when); source.stop(when + duration);
  }
  tone(frequency, duration, type = 'sine', volume = 0.2, end = frequency, when = this.context?.currentTime, destination) {
    if (!this.audible || this.voices.size >= 48) return;
    const oscillator = this.context.createOscillator(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(end, when + duration);
    this.voice(oscillator, duration, volume, when, destination);
  }
  rustle(duration, volume, frequency, when = this.context?.currentTime, destination) {
    if (!this.audible || this.voices.size >= 48) return;
    const source = this.context.createBufferSource(); source.buffer = this.noise;
    const filter = this.context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 0.7;
    this.voice(source, duration, volume, when, destination, filter);
  }
  pigeon(pan = 0, deep = false) {
    if (!this.audible || this.voices.size >= 48 || this.context.currentTime - this.lastCoo < 1.6) return;
    this.lastCoo = this.context.currentTime;
    const source = this.context.createBufferSource(); source.buffer = this.coo;
    source.playbackRate.value = (deep ? 0.8 : 0.96) + Math.random() * 0.1;
    const duration = this.coo.duration / source.playbackRate.value;
    // The buffer already has its own syllable envelopes; keep the phrase audible to its end.
    const gain = this.context.createGain(); gain.gain.value = 0.26;
    const panner = this.context.createStereoPanner(); panner.pan.value = pan;
    source.connect(gain); gain.connect(panner); panner.connect(this.gain);
    const voice = { source, gain }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice); };
    source.start(); source.stop(this.context.currentTime + duration);
  }
  play(type) {
    if (!this.audible) return;
    const variation = 0.92 + Math.random() * 0.16;
    if (type === 'peck') { this.rustle(0.065, 0.23, 2400); this.tone(960 * variation, 0.045, 'triangle', 0.14, 450); }
    if (type === 'hit') { this.rustle(0.085, 0.65, 1450); this.tone(230 * variation, 0.14, 'sine', 0.55, 75); this.tone(700 * variation, 0.055, 'triangle', 0.2, 240); }
    if (type === 'jump') { this.rustle(0.14, 0.16, 1700); this.tone(650, 0.14, 'sine', 0.15, 1450); }
    if (type === 'hurt') { this.rustle(0.16, 0.35, 800); this.tone(310, 0.3, 'triangle', 0.42, 90); }
    if (type === 'defeat') { this.rustle(0.32, 0.24, 1900); this.pigeon(0, true); }
    if (type === 'clear' || type === 'wave') {
      [72, 76, 79].forEach((note, i) => this.tone(hz(note), 0.3, 'triangle', 0.2, hz(note), this.context.currentTime + i * 0.09));
    }
    if (type === 'over') {
      [67, 64, 60].forEach((note, i) => this.tone(hz(note), 0.45, 'triangle', 0.2, hz(note), this.context.currentTime + i * 0.18));
    }
  }
  update(time, enemies) {
    if (!this.audible || !this.playing) return;
    const now = this.context.currentTime;
    // Schedule against the audio clock, and skip missed beats after a stalled frame.
    if (this.nextBeat < now - 0.1) this.nextBeat = now + 0.02;
    while (this.nextBeat < now + 0.12) {
      const tick = this.beat % MELODY.length, when = this.nextBeat;
      const chord = CHORDS[Math.floor(tick / 16)];
      if (MELODY[tick]) {
        const f = hz(MELODY[tick]);
        this.tone(f, 0.25, 'triangle', 0.16, f, when, this.musicGain);
        this.tone(f * 2, 0.12, 'sine', 0.025, f * 2, when, this.musicGain);
      }
      if (tick % 4 === 0) this.tone(hz(chord[0]), 0.46, 'sine', 0.3, hz(chord[0]), when, this.musicGain);
      if (tick % 4 === 2) for (const n of chord.slice(1)) this.tone(hz(n), 0.2, 'triangle', 0.055, hz(n), when, this.musicGain);
      if (tick % 2 === 0) this.rustle(0.045, 0.055, 5200, when, this.musicGain);
      if (tick % 8 === 4) this.rustle(0.09, 0.12, 1500, when, this.musicGain);
      this.beat++; this.nextBeat += EIGHTH;
    }
    if (time >= this.nextCoo) {
      const pigeons = enemies.filter(e => !e.dead && e.x >= 0 && e.x <= 1280);
      if (pigeons.length) {
        const pigeon = pigeons[Math.floor(Math.random() * pigeons.length)];
        this.pigeon((pigeon.x / 1280 - 0.5) * 1.2, pigeon.kind === 'boss');
        this.nextCoo = time + 3 + Math.random() * 2;
      }
    }
  }
}
