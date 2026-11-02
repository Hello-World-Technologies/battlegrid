// src/audio.ts
//
// One place for every sound in the game.
//
//   • Two music loops — 'menu' for every non-battle screen, 'game' during a
//     battle. Only one plays at a time; switching is a pause/play, so a
//     track resumes where it left off.
//   • Short one-shot effects, each preloaded once and retriggered from the
//     start so rapid events never wait for a previous play to finish.
//
// Files live in android/app/src/main/res/raw; on Android react-native-sound
// resolves a bare filename to that folder. The player's Settings toggles are
// mirrored in through configure().
//
// Everything degrades silently: a missing or failed file just never plays.

import Sound from 'react-native-sound';

export type Track = 'menu' | 'game';
export type Sfx = 'capture' | 'lostTerritory' | 'win' | 'lose' | 'reward' | 'dispatch' | 'clash' | 'itemUse' | 'tap' | 'purchase';

const TRACK_FILE: Record<Track, string> = {
  menu: 'menu_loop.mp3',
  game: 'music_loop.mp3',
};
const TRACK_VOLUME: Record<Track, number> = { menu: 0.4, game: 0.3 };

// Most effects are synthesized (scripts/gen-audio.mjs); menu_loop, music_loop
// and dispatch are licensed tracks placed directly in the raw folder instead.
const SFX_FILE: Record<Sfx, string> = {
  capture: 'capture.wav',
  lostTerritory: 'lost_territory.wav',
  win: 'win.wav',
  lose: 'lose.wav',
  reward: 'reward.wav',
  dispatch: 'dispatch.mp3',
  clash: 'dispatch.mp3',
  itemUse: 'item_use.wav',
  tap: 'tap.wav',
  purchase: 'purchase.wav',
};
const SFX_VOLUME: Record<Sfx, number> = {
  capture: 0.5,
  lostTerritory: 0.6,
  win: 0.8,
  lose: 0.8,
  reward: 0.6,
  dispatch: 0.35,
  clash: 0.22,
  itemUse: 0.6,
  tap: 0.4,
  purchase: 0.55,
};

type Loaded = { sound: Sound; ready: boolean; playing: boolean };

class AudioEngine {
  private musicOn = true;
  private soundOn = true;
  private suspended = false;
  private wanted: Track | null = null;
  private tracks: Partial<Record<Track, Loaded>> = {};
  private sfxPool: Partial<Record<Sfx, Loaded>> = {};

  constructor() {
    Sound.setCategory('Playback', true);
  }

  /** Mirror the player's Settings toggles. */
  configure(opts: { music: boolean; sound: boolean }): void {
    this.musicOn = opts.music;
    this.soundOn = opts.sound;
    this.apply();
  }

  /** Silence everything while the app is in the background. */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    this.apply();
  }

  /** Which loop should be audible right now; null pauses music. */
  playMusic(track: Track | null): void {
    this.wanted = track;
    this.apply();
  }

  sfx(name: Sfx): void {
    if (!this.soundOn || this.suspended) return;
    const existing = this.sfxPool[name];
    if (existing) {
      if (!existing.ready) return;
      existing.sound.stop(() => existing.sound.play());
      return;
    }
    const entry: Loaded = { sound: null as unknown as Sound, ready: false, playing: false };
    entry.sound = new Sound(SFX_FILE[name], Sound.MAIN_BUNDLE, (error) => {
      if (error) return;
      // The load callback can fire synchronously, before `entry.sound = new Sound(...)` has
      // finished assigning — deferring a tick guarantees entry.sound is set by the time this runs.
      Promise.resolve().then(() => {
        entry.ready = true;
        entry.sound.setVolume(SFX_VOLUME[name]);
        entry.sound.play();
      });
    });
    this.sfxPool[name] = entry;
  }

  private track(t: Track): Loaded {
    const existing = this.tracks[t];
    if (existing) return existing;
    const entry: Loaded = { sound: null as unknown as Sound, ready: false, playing: false };
    entry.sound = new Sound(TRACK_FILE[t], Sound.MAIN_BUNDLE, (error) => {
      if (error) return;
      Promise.resolve().then(() => {
        entry.sound.setNumberOfLoops(-1);
        entry.sound.setVolume(TRACK_VOLUME[t]);
        entry.ready = true;
        this.apply(); // it may already be the wanted track
      });
    });
    this.tracks[t] = entry;
    return entry;
  }

  private apply(): void {
    const audible = this.musicOn && !this.suspended ? this.wanted : null;
    if (audible) this.track(audible); // kick off loading if needed
    (Object.keys(this.tracks) as Track[]).forEach((t) => {
      const entry = this.tracks[t];
      if (!entry || !entry.ready) return;
      const shouldPlay = t === audible;
      if (shouldPlay && !entry.playing) {
        entry.playing = true;
        entry.sound.play();
      } else if (!shouldPlay && entry.playing) {
        entry.playing = false;
        entry.sound.pause();
      }
    });
  }
}

export const Audio = new AudioEngine();
