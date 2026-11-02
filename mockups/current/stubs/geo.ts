// Stand-in for src/geo.ts in the browser harness: no device location in a browser preview, so the
// Leaderboard screen's Country/City tabs just show their "location unavailable" state.
export async function ensureGeo() {
  return null;
}
