// Stand-in for @react-native-firebase/auth: only src/firebase/config.ts's `getAuth(app)` call needs
// a named export to exist here, and it is only ever reached when an app was configured (never true
// in the harness — see firebase-app.ts).
export const getAuth = () => ({}) as any;
