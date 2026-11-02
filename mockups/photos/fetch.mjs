// node fetch.mjs <outdir> <width> "File A.jpg" "File B.jpg" ...  -> downloads thumbs + prints license JSON lines
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'User-Agent': 'BattleGridMockups/1.0 (zarttashgithub@gmail.com)' };
const [dir, width, ...files] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
for (const f of files) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent('File:' + f)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${width}`;
  const j = await (await fetch(u, { headers: UA })).json();
  const p = Object.values(j.query.pages)[0]; const i = p.imageinfo?.[0];
  if (!i) { console.log('MISSING', f); continue; }
  let buf;
  for (let t = 0; t < 4; t++) { const r = await fetch(i.thumburl, { headers: UA }); if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); break; } await new Promise((s) => setTimeout(s, 1500 * (t + 1))); }
  if (!buf) { console.log('FAILED', f); continue; }
  const name = f.replace(/[^A-Za-z0-9]+/g, '_').replace(/_(jpe?g)$/i, '.jpg').slice(0, 60);
  const out = name.endsWith('.jpg') ? name : name + '.jpg';
  writeFileSync(`${dir}/${out}`, buf);
  const m = i.extmetadata;
  console.log(JSON.stringify({ file: out, title: f, page: i.descriptionurl, license: m.LicenseShortName?.value, licenseUrl: m.LicenseUrl?.value, author: (m.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() }));
}
