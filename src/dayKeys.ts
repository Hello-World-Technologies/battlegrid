// src/dayKeys.ts
//
// UTC day bucketing for the leaderboard, kept free of any Firebase import so
// it can be unit-tested on its own.
//
// Scores are bucketed by UTC calendar day rather than device-local day so that
// every player shares one reset instant and daily ranks stay comparable.

/** UTC calendar day as 'YYYY-MM-DD'. */
export const dayKeyOf = (d: Date): string => d.toISOString().slice(0, 10);

/** The last `days` UTC day keys, today first. */
export const recentDayKeys = (days: number, from: Date = new Date()): string[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - i);
    return dayKeyOf(d);
  });
