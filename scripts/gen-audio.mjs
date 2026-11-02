// Synthesizes most sound effects as plain PCM WAV — no external samples, so
// nothing here is borrowed from anywhere. Re-run after editing the note lists
// below to regenerate the files in android/app/src/main/res/raw.
//   node scripts/gen-audio.mjs
//
// menu_loop.mp3, music_loop.mp3 and dispatch.mp3 are licensed tracks placed
// directly in that folder instead (see assets/music/) — this script does not
// touch them, and does not generate anything with those three names.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = join(dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main', 'res', 'raw');
const SR = 44100;

// ---- low-level: a mutable sample buffer and a WAV writer ----------------

const buffer = (seconds) => new Float32Array(Math.round(seconds * SR));

function writeWav(name, samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    bytes.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(join(RAW, `${name}.wav`), bytes);
  console.log(`${name}.wav  ${(bytes.length / 1024).toFixed(0)}KB`);
}

/** Scales a buffer so its peak sits at exactly `target`, for consistent loudness across files. */
function normalize(buf, target = 0.9) {
  let peak = 0;
  for (const s of buf) peak = Math.max(peak, Math.abs(s));
  if (peak <= 0) return;
  const k = target / peak;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
}

/** A tiny fade at both ends so a clipped buffer edge never clicks. */
function declick(buf, ms = 4) {
  const n = Math.round((ms / 1000) * SR);
  for (let i = 0; i < n && i < buf.length; i++) {
    const k = i / n;
    buf[i] *= k;
    buf[buf.length - 1 - i] *= k;
  }
}

const A4 = 440;
/** Equal-tempered frequency, `n` semitones from A4 (0 = A4, -9 = C4). */
const note = (n) => A4 * 2 ** (n / 12);

/** 0→1 ADSR shaped for a one-shot hit: quick attack, then a decay to a sustain level, held until release. */
function envelope(t, dur, { attack = 0.01, release = dur * 0.6, sustain = 1 } = {}) {
  if (t < 0 || t > dur) return 0;
  if (t < attack) return (t / attack) * 1;
  const relStart = dur - release;
  if (t < relStart) return 1 - (1 - sustain) * Math.min(1, (t - attack) / Math.max(0.001, relStart - attack));
  return sustain * (1 - (t - relStart) / release);
}

const WAVE = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  triangle: (p) => 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25)),
  square: (p) => (((p % 1) + 1) % 1 < 0.5 ? 1 : -1),
};

/**
 * Additive tone mixed into `buf` from `start` for `dur` seconds. `freq` may be a
 * [from, to] sweep. `harmonics` is a list of [multiple, weight] layered on top of
 * the fundamental (weight 1).
 */
function addTone(buf, { start, dur, freq, amp = 0.3, wave = 'sine', harmonics = [], ...env }) {
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
  const i0 = Math.max(0, Math.round(start * SR));
  const i1 = Math.min(buf.length, Math.round((start + dur) * SR));
  const osc = WAVE[wave];
  let phase = 0;
  const harmPhase = harmonics.map(() => 0);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const e = envelope(t, dur, env);
    if (e <= 0) continue;
    const f = f0 + (f1 - f0) * (t / dur);
    phase += f / SR;
    let v = osc(phase);
    for (let h = 0; h < harmonics.length; h++) {
      const [mult, weight] = harmonics[h];
      harmPhase[h] += (f * mult) / SR;
      v += osc(harmPhase[h]) * weight;
    }
    buf[i] += v * amp * e;
  }
}

/**
 * White noise shaped by a one-pole lowpass whose cutoff can sweep (a rising cutoff
 * makes noise brighten over time — the core of a convincing "whoosh").
 */
function addNoise(buf, { start, dur, amp = 0.3, cutoff = [1200, 1200], ...env }) {
  const [c0, c1] = cutoff;
  const i0 = Math.max(0, Math.round(start * SR));
  const i1 = Math.min(buf.length, Math.round((start + dur) * SR));
  let lp = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const e = envelope(t, dur, env);
    const c = c0 + (c1 - c0) * (t / dur);
    const a = Math.exp((-2 * Math.PI * c) / SR); // filter coefficient for this instant's cutoff
    lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
    if (e <= 0) continue;
    buf[i] += lp * amp * e;
  }
}

// ---- one-shot effects -----------------------------------------------------

function sfxTap() {
  const buf = buffer(0.09);
  addTone(buf, { start: 0, dur: 0.05, freq: note(11), amp: 0.22, harmonics: [[2, 0.15]], attack: 0.002, release: 0.045 });
  addNoise(buf, { start: 0, dur: 0.015, amp: 0.12, cutoff: [6000, 5000], attack: 0.001, release: 0.012 });
  normalize(buf, 0.6);
  declick(buf);
  writeWav('tap', buf);
}

function sfxCapture() {
  const buf = buffer(0.3);
  const harmonics = [[2, 0.25], [3, 0.1]];
  addTone(buf, { start: 0, dur: 0.15, freq: note(27), amp: 0.32, harmonics, attack: 0.004, release: 0.13 }); // C6
  addTone(buf, { start: 0.08, dur: 0.2, freq: note(31), amp: 0.32, harmonics, attack: 0.004, release: 0.18 }); // E6
  normalize(buf, 0.85);
  declick(buf);
  writeWav('capture', buf);
}

function sfxLostTerritory() {
  const buf = buffer(0.34);
  addTone(buf, { start: 0, dur: 0.18, freq: note(-24), amp: 0.5, wave: 'square', attack: 0.002, release: 0.16 }); // low thud
  addTone(buf, { start: 0.02, dur: 0.28, freq: [500, 210], amp: 0.2, wave: 'triangle', attack: 0.01, release: 0.22 }); // falling alarm
  normalize(buf, 0.9);
  declick(buf);
  writeWav('lost_territory', buf);
}

function sfxWin() {
  const buf = buffer(1.0);
  const harmonics = [[2, 0.3], [3, 0.1]];
  const arp = [0, 4, 7, 12]; // major triad + octave
  arp.forEach((semi, i) => {
    addTone(buf, { start: i * 0.12, dur: 0.18, freq: note(-12 + semi), amp: 0.3, harmonics, attack: 0.004, release: 0.14 });
  });
  [12, 16, 19].forEach((semi) => {
    addTone(buf, { start: 0.5, dur: 0.5, freq: note(-12 + semi), amp: 0.16, harmonics, attack: 0.01, release: 0.44 });
  });
  normalize(buf, 0.9);
  declick(buf);
  writeWav('win', buf);
}

function sfxLose() {
  const buf = buffer(1.0);
  const harmonics = [[2, 0.2]];
  [-5, -8, -12].forEach((semi, i) => {
    addTone(buf, { start: i * 0.22, dur: 0.3, freq: note(semi), amp: 0.3, wave: 'triangle', harmonics, attack: 0.01, release: 0.26 });
  });
  addTone(buf, { start: 0.55, dur: 0.45, freq: note(-24), amp: 0.14, wave: 'triangle', attack: 0.02, release: 0.4 });
  normalize(buf, 0.85);
  declick(buf);
  writeWav('lose', buf);
}

function sfxReward() {
  const buf = buffer(0.24);
  const harmonics = [[3, 0.15]];
  addTone(buf, { start: 0, dur: 0.1, freq: note(22), amp: 0.3, harmonics, attack: 0.003, release: 0.09 }); // A6
  addTone(buf, { start: 0.07, dur: 0.14, freq: note(26), amp: 0.3, harmonics, attack: 0.003, release: 0.12 }); // C#7
  addNoise(buf, { start: 0, dur: 0.02, amp: 0.1, cutoff: [8000, 8000], attack: 0.001, release: 0.016 });
  normalize(buf, 0.85);
  declick(buf);
  writeWav('reward', buf);
}

function sfxPurchase() {
  const buf = buffer(0.24);
  addTone(buf, { start: 0, dur: 0.1, freq: note(-17), amp: 0.38, wave: 'square', attack: 0.002, release: 0.08 });
  addTone(buf, { start: 0.08, dur: 0.12, freq: note(16), amp: 0.26, harmonics: [[2, 0.2]], attack: 0.004, release: 0.1 });
  normalize(buf, 0.8);
  declick(buf);
  writeWav('purchase', buf);
}

/** Plays once the instant any shop item (bomb, freeze, airdrop, ...) is used — a rising whoosh plus a confirming blip. */
function sfxItemUse() {
  const buf = buffer(0.26);
  addNoise(buf, { start: 0, dur: 0.18, amp: 0.3, cutoff: [800, 4200], attack: 0.01, release: 0.14 });
  addTone(buf, { start: 0.02, dur: 0.12, freq: [260, 700], amp: 0.18, wave: 'triangle', attack: 0.01, release: 0.1 });
  addTone(buf, { start: 0.14, dur: 0.1, freq: note(19), amp: 0.16, wave: 'square', harmonics: [[2, 0.15]], attack: 0.002, release: 0.09 });
  normalize(buf, 0.85);
  declick(buf);
  writeWav('item_use', buf);
}

sfxTap();
sfxCapture();
sfxLostTerritory();
sfxWin();
sfxLose();
sfxReward();
sfxPurchase();
sfxItemUse();
