// Loads Skia's web build (CanvasKit) first, then the harness that draws the app's real screens.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file: string) => `/node_modules/canvaskit-wasm/bin/full/${file}` })
  .then(() => import('./stubs/skia'))
  .then((sk) => sk.preloadFonts())
  .then(() => import('./harness'))
  .then((m) => m.mount())
  .catch((e) => {
    document.title = 'ERROR';
    document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0;right:0;z-index:99;font:12px monospace;white-space:pre-wrap">${String(e?.stack ?? e)}</pre>`);
    console.error(e);
  });
