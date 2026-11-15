export const MUSIC = [
  {
    id: 'defense', title: 'Оборона парка', description: 'Боевой марш · упругие барабаны, тревожные струны', bpm: 132,
    chords: [[38, 50, 53, 57], [34, 46, 50, 53], [43, 55, 58, 62], [33, 45, 49, 52]],
    motif: [0, null, 7, 0, 3, null, 7, 10, 12, null, 7, 3, 0, 7, 3, null],
    bass: [0, 3, 4, 6], kick: [0, 3, 4], snare: [2, 6], cutoff: 1700, sustain: 0.9,
  },
  {
    id: 'swarm', title: 'Налёт стаи', description: 'Погоня · быстрый пульс, резкий бас и короткие сигналы', bpm: 152,
    chords: [[40, 52, 55, 59], [41, 53, 57, 60], [36, 48, 52, 55], [35, 47, 51, 54]],
    motif: [0, 12, 7, 12, 1, 12, 7, null, 0, 7, 12, 7, 1, 0, 7, 12],
    bass: [0, 1, 3, 4, 5, 7], kick: [0, 2, 4, 7], snare: [2, 6], cutoff: 2300, sustain: 0.6,
  },
  {
    id: 'laststand', title: 'Последний рубеж', description: 'Тяжёлая оборона · низкие томы и мрачная мелодия', bpm: 116,
    chords: [[36, 48, 51, 55], [32, 44, 48, 51], [29, 41, 44, 48], [31, 43, 47, 50]],
    motif: [0, null, null, 7, 12, null, 10, null, 7, null, 3, null, 1, 0, null, null],
    bass: [0, 3, 6], kick: [0, 3, 6], snare: [4], cutoff: 1000, sustain: 2.4,
  },
];
export const COOS = [
  { id: 'sentry', title: 'Дозорный', description: 'Короткое угрожающее «гу-гру-гу»', warble: 22, roughness: 0.04,
    syllables: [[0, 0.18, 320], [0.25, 0.52, 370], [0.84, 0.3, 280]] },
  { id: 'flock', title: 'Нервная стая', description: 'Частые перекаты и взволнованная трель', warble: 36, roughness: 0.1,
    syllables: [[0, 0.13, 400], [0.18, 0.15, 350], [0.38, 0.48, 425], [0.93, 0.2, 330], [1.18, 0.24, 300]] },
  { id: 'leader', title: 'Вожак', description: 'Низкое хриплое воркование с длинным раскатом', warble: 16, roughness: 0.18,
    syllables: [[0, 0.28, 250], [0.37, 0.86, 280], [1.33, 0.46, 215]] },
];
const hz = note => 440 * 2 ** ((note - 69) / 12);

function cooBuffer(context, variant) {
  const [lastStart, lastDuration] = variant.syllables.at(-1);
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * (lastStart + lastDuration + 0.06)), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (const [start, duration, pitch] of variant.syllables) {
    let phase = 0;
    for (let i = 0; i < Math.floor(duration * context.sampleRate); i++) {
      const t = i / context.sampleRate, progress = t / duration;
      const trill = Math.sin(t * Math.PI * 2 * variant.warble);
      const frequency = pitch * (1 - progress * 0.22) + (8 + variant.roughness * 60) * trill;
      phase += frequency * Math.PI * 2 / context.sampleRate;
      const envelope = Math.sin(Math.PI * progress) ** 0.8 * (0.78 + 0.22 * trill);
      const throat = Math.sin(phase) * 0.66 + Math.sin(phase * 2) * 0.17 + Math.sin(phase * 3) * 0.06;
      data[Math.floor(start * context.sampleRate) + i] = envelope * (throat + variant.roughness * Math.sin(phase * 0.5) * trill);
    }
  }
  return buffer;
}

export class Sound {
  constructor() {
    this.context = null; this.enabled = true; this.playing = false;
    this.musicVariant = MUSIC[0]; this.cooVariant = COOS[0];
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
        this.coos = new Map(COOS.map(variant => [variant.id, cooBuffer(context, variant)]));
        this.context = context;
      }
      if (this.context.state !== 'running') await this.context.resume();
    } catch { /* A blocked audio device must never prevent playing. */ }
  }
  get audible() { return this.enabled && this.context?.state === 'running'; }
  selectMusic(id) {
    const variant = MUSIC.find(item => item.id === id);
    if (!variant || variant === this.musicVariant) return;
    this.stopVoices(); this.musicVariant = variant; this.beat = 0;
  }
  selectCoo(id) { this.cooVariant = COOS.find(item => item.id === id) || this.cooVariant; }
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
  tone(frequency, duration, type = 'sine', volume = 0.2, end = frequency, when = this.context?.currentTime, destination, cutoff = 0) {
    if (!this.audible || this.voices.size >= 48) return;
    const oscillator = this.context.createOscillator(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(end, when + duration);
    const filter = cutoff ? this.context.createBiquadFilter() : null;
    if (filter) { filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = 0.6; }
    this.voice(oscillator, duration, volume, when, destination, filter);
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
    const source = this.context.createBufferSource(); source.buffer = this.coos.get(this.cooVariant.id);
    source.playbackRate.value = (deep ? 0.8 : 0.96) + Math.random() * 0.1;
    const duration = source.buffer.duration / source.playbackRate.value;
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
    const now = this.context.currentTime, track = this.musicVariant, eighth = 60 / track.bpm / 2;
    // Schedule against the audio clock, and skip missed beats after a stalled frame.
    if (this.nextBeat < now - 0.1) this.nextBeat = now + 0.02;
    while (this.nextBeat < now + 0.12) {
      const tick = this.beat % 64, when = this.nextBeat, pulse = tick % 8;
      const chord = track.chords[Math.floor(tick / 16)], note = track.motif[tick % 16];
      if (note !== null) {
        const f = hz(chord[1] + 12 + note);
        this.tone(f, eighth * track.sustain, 'sawtooth', 0.13, f, when, this.musicGain, track.cutoff);
        this.tone(f, eighth * track.sustain, 'triangle', 0.07, f, when, this.musicGain);
      }
      if (track.bass.includes(pulse)) {
        const bass = hz(chord[0]);
        this.tone(bass, eighth * 0.85, 'triangle', 0.32, bass, when, this.musicGain);
      }
      if (pulse === 0) for (const n of chord.slice(1)) this.tone(hz(n), eighth * 3, 'sawtooth', 0.035, hz(n), when, this.musicGain, 900);
      if (track.kick.includes(pulse)) this.tone(140, 0.19, 'sine', 0.55, 43, when, this.musicGain);
      if (track.snare.includes(pulse)) { this.rustle(0.1, 0.24, 1700, when, this.musicGain); this.tone(185, 0.09, 'triangle', 0.1, 90, when, this.musicGain); }
      this.rustle(0.035, pulse % 2 ? 0.035 : 0.065, 6200, when, this.musicGain);
      if (tick >= 60 && tick % 2 === 0) this.tone(125 - (tick - 60) * 9, 0.16, 'sine', 0.3, 55, when, this.musicGain);
      this.beat++; this.nextBeat += eighth;
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
