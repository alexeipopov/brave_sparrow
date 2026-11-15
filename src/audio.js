export class Sound {
  constructor() { this.context = null; this.enabled = true; this.nextNote = 0; this.note = 0; }
  async unlock() {
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.gain = this.context.createGain(); this.gain.gain.value = this.enabled ? 0.25 : 0;
        this.gain.connect(this.context.destination);
      }
      await this.context.resume();
    } catch { /* Audio is optional when a browser disallows it. */ }
  }
  toggle() { this.enabled = !this.enabled; if (this.gain) this.gain.gain.value = this.enabled ? 0.25 : 0; return this.enabled; }
  tone(frequency, duration, type = 'sine', volume = 0.2, end = frequency) {
    if (!this.context || !this.enabled || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(end, 1), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(this.gain);
    oscillator.start(now); oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  play(type) {
    if (type === 'peck') this.tone(1200, 0.06, 'triangle', 0.16, 500);
    if (type === 'hit') this.tone(180, 0.1, 'triangle', 0.45, 70);
    if (type === 'jump') this.tone(500, 0.15, 'sine', 0.18, 1100);
    if (type === 'hurt') this.tone(220, 0.24, 'sawtooth', 0.16, 90);
    if (type === 'defeat') this.tone(420, 0.2, 'sine', 0.18, 170);
    if (type === 'clear' || type === 'wave') this.tone(784, 0.5, 'triangle', 0.25, 1047);
    if (type === 'over') this.tone(300, 0.65, 'triangle', 0.3, 100);
  }
  music(time) {
    if (time < this.nextNote) return;
    this.nextNote = time + 0.36;
    const melody = [523, 0, 659, 784, 659, 0, 587, 0, 523, 659, 880, 784, 0, 659, 587, 0];
    const f = melody[this.note++ % melody.length];
    if (f) this.tone(f, 0.26, 'sine', 0.055);
  }
}
