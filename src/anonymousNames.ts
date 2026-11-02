// src/anonymousNames.ts
//
// Guest players get a stable, readable pseudonym instead of a raw uid, so the
// leaderboard reads like a list of people rather than a list of hashes.
//
// The name is derived deterministically from the uid: the same guest always
// gets the same name on any device and after any reinstall that restores the
// session, with no extra round-trip or stored field needed to regenerate it.
//
// Format is CamelCase adjective + noun ("ShadowFox", "PixelKnight"). The two
// lists share no words, so a name never doubles up ("GhostGhost").

const ADJECTIVES = [
  'Shadow', 'Pixel', 'Swift', 'Neon', 'Turbo', 'Cosmic', 'Silent', 'Rapid',
  'Lunar', 'Hyper', 'Crimson', 'Electric', 'Frozen', 'Solar', 'Golden', 'Atomic',
  'Velvet', 'Iron', 'Prism', 'Quantum', 'Ember', 'Arctic', 'Vivid', 'Blazing',
  'Cobalt', 'Crystal', 'Dusk', 'Feral', 'Glacier', 'Jade', 'Laser', 'Mystic',
  'Onyx', 'Rogue', 'Ruby', 'Scarlet', 'Storm', 'Thunder', 'Ultra', 'Void',
  'Wild', 'Zero', 'Azure', 'Sable', 'Amber', 'Copper', 'Silver', 'Nimbus',
] as const;

const NOUNS = [
  'Fox', 'Knight', 'Tiger', 'Rider', 'Falcon', 'Comet', 'Vector', 'Drift',
  'Blaze', 'Cipher', 'Raven', 'Bolt', 'Orbit', 'Zenith', 'Lynx', 'Spark',
  'Nomad', 'Quasar', 'Wraith', 'Dynamo', 'Wolf', 'Hawk', 'Panther', 'Viper',
  'Cobra', 'Jaguar', 'Ranger', 'Pilot', 'Hunter', 'Racer', 'Ninja', 'Samurai',
  'Rocket', 'Meteor', 'Phoenix', 'Dragon', 'Griffin', 'Kraken', 'Nova', 'Specter',
  'Bandit', 'Pirate', 'Rebel', 'Warden', 'Striker', 'Sentinel', 'Voyager', 'Echo',
] as const;

/* eslint-disable no-bitwise -- FNV-1a is defined in terms of xor/shift. */

/** FNV-1a — small, fast, and stable across JS engines. */
const hash = (input: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/**
 * Deterministic pseudonym for a guest uid, e.g. "NeonFalcon".
 * 48 x 48 = 2,304 combinations. Names are display-only — rows are keyed on
 * uid — so an occasional shared name is harmless.
 */
export const anonymousNameFor = (uid: string): string => {
  const h = hash(uid);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  return `${adjective}${noun}`;
};
