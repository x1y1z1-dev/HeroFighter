/**
 * Tiny procedural sound engine.
 *
 * Everything is synthesised with WebAudio, so the project stays free of binary
 * audio assets. Browsers block audio until a user gesture, so `unlock()` is
 * wired to the first pointer/key event in main.ts.
 */
class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private readonly volume = 0.45;

  constructor() {
    try {
      this.muted = window.localStorage.getItem('hf.muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Called from the first user gesture. Safe to call repeatedly. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      window.localStorage.setItem('hf.muted', this.muted ? '1' : '0');
    } catch {
      /* storage can be disabled — mute still works for the session */
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  /* ------------------------------------------------------------------ */
  /* One-shots                                                           */
  /* ------------------------------------------------------------------ */

  swing(kind: 'punch' | 'kick'): void {
    const heavy = kind === 'kick';
    this.noise(heavy ? 0.16 : 0.11, heavy ? 0.22 : 0.16, heavy ? 900 : 1500, heavy ? 260 : 700);
  }

  impact(weight: number): void {
    const power = Math.max(0.4, Math.min(1.6, weight));
    this.tone(150 * power, 48, 0.18, 'sine', 0.5 * power);
    this.noise(0.12, 0.24 * power, 1800, 300);
  }

  block(): void {
    this.tone(760, 520, 0.07, 'square', 0.16);
    this.noise(0.08, 0.14, 2600, 1400);
  }

  jump(): void {
    this.tone(300, 620, 0.09, 'triangle', 0.12);
  }

  ko(): void {
    this.tone(220, 60, 0.55, 'sawtooth', 0.22);
    this.noise(0.4, 0.12, 700, 120);
  }

  bell(): void {
    this.tone(880, 880, 0.5, 'sine', 0.18);
    this.tone(1320, 1320, 0.4, 'sine', 0.1);
  }

  ui(): void {
    this.tone(920, 1180, 0.045, 'square', 0.09);
  }

  /* ------------------------------------------------------------------ */
  /* Synthesis helpers                                                   */
  /* ------------------------------------------------------------------ */

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    const length = Math.floor(this.ctx.sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    return this.ctx;
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, gain: number, fromHz: number, toHz: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || !this.noiseBuffer || this.muted) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(fromHz, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, toHz), now + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(Math.max(0.0002, gain), now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter).connect(env).connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }
}

export const sfx = new SfxEngine();
