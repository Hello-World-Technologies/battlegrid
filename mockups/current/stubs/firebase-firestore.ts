// Stand-in for @react-native-firebase/firestore. src/firebase/config.ts's `db` is always null in the
// harness (no app is ever configured — see firebase-app.ts), so src/leaderboard.ts's early `!db`
// guards mean none of these are ever actually called; they only need to exist so the bundle resolves.
export const getFirestore = () => ({}) as any;
export const collection = () => ({}) as any;
export const doc = () => ({}) as any;
export const getDocs = async () => ({ docs: [] }) as any;
export const limit = () => ({}) as any;
export const orderBy = () => ({}) as any;
export const query = (q: any) => q;
export const where = () => ({}) as any;
export const serverTimestamp = () => null;
export const runTransaction = async (_db: any, fn: any) =>
  fn({ get: async () => ({ exists: () => false, data: () => ({}) }), set: () => {} });
