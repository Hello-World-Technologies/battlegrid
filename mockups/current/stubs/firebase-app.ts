// Stand-in for @react-native-firebase/app: reports no app configured, same as a dev build with no
// google-services.json, so src/firebase/config.ts's offline-degrade path kicks in.
export const getApps = () => [];
export const getApp = () => ({}) as any;
