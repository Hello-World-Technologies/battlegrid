// Stand-in for src/leaderboard.ts in the browser harness: canned rows instead of a live Firestore
// query, so the populated board can be screenshotted without a real backend.
const ENTRIES = [
  { id: '1', uid: 'p1', name: 'NeonFalcon', score: 48200, dayKey: '', photoURL: null, country: 'Japan', city: 'Tokyo', countryCode: 'JP', title: 'legend' },
  { id: '2', uid: 'p2', name: 'ShadowWolf', score: 41950, dayKey: '', photoURL: null, country: 'Brazil', city: 'Sao Paulo', countryCode: 'BR', title: 'champion' },
  { id: '3', uid: 'p3', name: 'CrimsonHawk', score: 39100, dayKey: '', photoURL: null, country: 'Germany', city: 'Berlin', countryCode: 'DE', title: null },
  { id: '4', uid: 'p4', name: 'IronJaguar', score: 33400, dayKey: '', photoURL: null, country: 'USA', city: 'Austin', countryCode: 'US', title: 'veteran' },
  { id: 'demo', uid: 'demo', name: 'Alex', score: 29800, dayKey: '', photoURL: null, country: 'USA', city: 'Seattle', countryCode: 'US', title: 'conqueror' },
  { id: '6', uid: 'p6', name: 'VelvetViper', score: 27650, dayKey: '', photoURL: null, country: 'India', city: 'Mumbai', countryCode: 'IN', title: null },
  { id: '7', uid: 'p7', name: 'GoldenOtter', score: 25300, dayKey: '', photoURL: null, country: 'UK', city: 'London', countryCode: 'GB', title: null },
  { id: '8', uid: 'p8', name: 'SilentComet', score: 21900, dayKey: '', photoURL: null, country: 'Canada', city: 'Toronto', countryCode: 'CA', title: null },
];

export const fetchAllTimeLeaderboard = async () => ({ entries: ENTRIES, online: true });
export const fetchCountryLeaderboard = async () => ({ entries: ENTRIES, online: true });
export const fetchCityLeaderboard = async () => ({ entries: ENTRIES, online: true });
export const bestPerPlayer = (entries: unknown[]) => entries;
export const submitLeaderboardScore = async () => undefined;
