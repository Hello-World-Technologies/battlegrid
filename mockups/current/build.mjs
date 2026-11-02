// Bundles the harness for the browser: react-native -> react-native-web, native-only packages -> stubs.
//   node mockups/current/build.mjs   -> mockups/current/dist/
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const stub = (f) => join(here, 'stubs', f);
// Parallel runs can use their own bundle folder: HARNESS_DIST=dist-a node mockups/current/build.mjs
const distName = process.env.HARNESS_DIST ?? 'dist';

mkdirSync(join(here, distName), { recursive: true });
copyFileSync(join(here, 'index.html'), join(here, distName, 'index.html'));

const stubs = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /^(fs|path|react-native-reanimated|react-native-worklets|react-native-sound|react-native-share|@react-native-community\/geolocation)(\/.*)?$|^@react-native-async-storage\// }, () => ({ path: stub('empty.ts') }));
    b.onResolve({ filter: /^react-native\/Libraries\/Image\/AssetRegistry$/ }, () => ({ path: stub('asset-registry.ts') }));
    // The app's `import ... from '@shopify/react-native-skia'` goes through the web wrapper (the wrapper itself imports the real file by path).
    b.onResolve({ filter: /^@shopify\/react-native-skia$/ }, () => ({ path: stub('skia.tsx') }));
    b.onResolve({ filter: /^@react-native-firebase\/app$/ }, () => ({ path: stub('firebase-app.ts') }));
    b.onResolve({ filter: /^@react-native-firebase\/auth$/ }, () => ({ path: stub('firebase-auth.ts') }));
    b.onResolve({ filter: /^@react-native-firebase\/firestore$/ }, () => ({ path: stub('firebase-firestore.ts') }));
    // No device location in a browser preview (src/geo.ts imports native-only geolocation + permission APIs).
    b.onResolve({ filter: /^\.\.\/geo$/ }, () => ({ path: stub('geo.ts') }));
    // Canned rows instead of a live Firestore query, so the populated board can be screenshotted.
    b.onResolve({ filter: /^\.\.\/leaderboard$/ }, () => ({ path: stub('leaderboard-data.ts') }));
  },
};

await build({
  plugins: [stubs],
  entryPoints: [join(here, 'entry.tsx')],
  outdir: join(here, distName),
  entryNames: 'entry',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: false,
  minify: false,
  logLevel: 'warning',
  publicPath: `/mockups/current/${distName}`,
  assetNames: 'assets/[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  nodePaths: [join(here, 'node_modules')],
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.mjs', '.json'],
  loader: { '.png': 'file', '.jpg': 'file', '.ttf': 'file', '.svg': 'file', '.js': 'jsx' },
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
  alias: {
    'react-native': join(here, 'node_modules', 'react-native-web'),
    react: join(root, 'node_modules', 'react'),
    'react-dom': join(here, 'node_modules', 'react-dom'),
    'react-native-safe-area-context': stub('safe-area.tsx'),
    '@react-native-vector-icons/ionicons': stub('ionicons.tsx'),
    'react-native-view-shot': stub('view-shot.tsx'),
  },
});
console.log('built', join(here, distName));
