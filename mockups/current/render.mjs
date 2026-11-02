// Screenshots the app's real screens (rendered by the harness) with headless Chrome over the DevTools protocol,
// in real time (so animations and Skia canvases settle before the capture).
//   node mockups/current/build.mjs && node mockups/current/render.mjs [id ...]   -> mockups/png_current/<id>.png
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(root, 'mockups', 'png_current');
mkdirSync(out, { recursive: true });

/** A common Android phone: 412 x 915 dp at 2.625x (1080 x 2402 px). */
const VIEW = { width: 412, height: 915, scale: 2.625 };
const ALL = ['splash', 'onboarding', 'home', 'world', 'rule', 'levels', 'daily', 'profile', 'settings', 'credits', 'play', 'conquest', 'pause', 'won', 'lost'];
const ids = process.argv.length > 2 ? process.argv.slice(2) : ALL;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(path).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const web = `http://127.0.0.1:${server.address().port}`;

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const debugPort = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'bg-shot-'))}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(t.webSocketDebuggerUrl);
        let n = 0;
        const waiting = new Map();
        ws.onmessage = (m) => {
          const d = JSON.parse(m.data);
          if (d.id && waiting.has(d.id)) {
            waiting.get(d.id)(d);
            waiting.delete(d.id);
          }
        };
        ws.onopen = () => resolve({ send: (method, params = {}) => new Promise((r) => { const id = ++n; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); }), close: () => ws.close() });
        ws.onerror = reject;
      });
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome DevTools did not start');
}

try {
  const page = await connect();
  await page.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.scale, mobile: false });
  for (const id of ids) {
    await page.send('Page.navigate', { url: 'about:blank' });
    await sleep(400);
    await page.send('Page.navigate', { url: `${web}/mockups/current/dist/index.html#${id}` });
    let ready = false;
    for (let i = 0; i < 80 && !ready; i++) {
      await sleep(250);
      const r = await page.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
      const title = r.result?.result?.value ?? '';
      ready = title.startsWith('ready:' + id) || title.startsWith('ERR');
      if (title.startsWith('ERR')) console.log('page error in', id, title.slice(0, 300).replace(/\s+/g, ' '));
    }
    await sleep(id === "splash" ? 150 : 2200); // let Animated + Skia settle (the splash fades out by itself)
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, `${id}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log('ok', id);
  }
  page.close();
} finally {
  chrome.kill();
  server.close();
}
console.log('Wrote', out);
