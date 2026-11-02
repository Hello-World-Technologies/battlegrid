// Picks one real city for every region of the battle map (REGIONS in src/game/core/geodata.ts).
//   country  -> its capital (or its biggest city if the dataset has no capital inside it)
//   US state -> its biggest city
// Source: Natural Earth 50m populated places (public domain), assigned by point-in-polygon, so no name matching.
// Run: node mockups/battle/build-cities.mjs   ->  mockups/battle/cities.json  { "w:France": "Paris", "u:Illinois": "Chicago", ... }
import { readFileSync, writeFileSync } from 'node:fs';
import { REGIONS } from '../../src/game/core/geodata.ts';

const here = new URL('.', import.meta.url);
const places = JSON.parse(readFileSync(new URL('ne_populated_places_50m.geojson', here), 'utf8')).features.map((f) => ({
  name: f.properties.name, cls: f.properties.featurecla, pop: f.properties.pop_max ?? 0,
  lon: f.properties.longitude ?? f.geometry.coordinates[0], lat: f.properties.latitude ?? f.geometry.coordinates[1],
}));
const mercY = (lat) => -(180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const rings = (d) => d.split('M').filter(Boolean).map((s) => s.replace('Z', '').split('L').map((p) => p.split(',').map(Number)));
const inRing = (x, y, r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Regions whose city dot falls outside the simplified outline (tiny states, a few US states).
const OVERRIDE = {
  'w:Vatican': 'Vatican City', 'w:San Marino': 'San Marino', 'w:Monaco': 'Monaco', 'w:Liechtenstein': 'Vaduz', 'w:Andorra': 'Andorra la Vella', 'w:Malta': 'Valletta',
  'w:Luxembourg': 'Luxembourg', 'w:Denmark': 'Copenhagen', 'w:Cyprus': 'Nicosia', 'w:Sierra Leone': 'Freetown', 'w:Liberia': 'Monrovia', 'w:Guinea-Bissau': 'Bissau',
  'w:Eq. Guinea': 'Malabo', 'w:Djibouti': 'Djibouti', 'w:Comoros': 'Moroni', 'w:Seychelles': 'Victoria', 'w:Mauritius': 'Port Louis', 'w:Cabo Verde': 'Praia',
  'w:São Tomé and Principe': 'São Tomé', 'w:Timor-Leste': 'Dili', 'w:Singapore': 'Singapore', 'w:Brunei': 'Bandar Seri Begawan', 'w:Bahrain': 'Manama', 'w:Maldives': 'Malé',
  'w:Hong Kong': 'Hong Kong', 'w:Macao': 'Macao', 'w:Fiji': 'Suva', 'w:Vanuatu': 'Port Vila', 'w:Tonga': 'Nukuʻalofa', 'w:Samoa': 'Apia', 'w:Kiribati': 'Tarawa',
  'w:Nauru': 'Yaren', 'w:Palau': 'Ngerulmud', 'w:Micronesia': 'Palikir', 'w:Marshall Is.': 'Majuro', 'w:Bahamas': 'Nassau', 'w:Barbados': 'Bridgetown', 'w:Antigua and Barb.': "St. John's",
  'w:St. Kitts and Nevis': 'Basseterre', 'w:Saint Lucia': 'Castries', 'w:St. Vin. and Gren.': 'Kingstown', 'w:Grenada': "St. George's", 'w:Dominica': 'Roseau',
  'w:Aruba': 'Oranjestad', 'w:Curaçao': 'Willemstad', 'w:Bermuda': 'Hamilton', 'w:Cayman Is.': 'George Town', 'w:New Caledonia': 'Nouméa', 'w:Fr. Polynesia': 'Papeete',
  'u:New Jersey': 'Newark', 'u:Arkansas': 'Little Rock', 'u:Delaware': 'Wilmington', 'u:District of Columbia': 'Washington, D.C.', 'u:Kentucky': 'Louisville',
  'u:New Hampshire': 'Manchester', 'u:Rhode Island': 'Providence', 'u:Texas': 'Houston',
  'u:Washington': 'Seattle', 'u:Maryland': 'Baltimore', 'u:Connecticut': 'Hartford', 'u:Virginia': 'Richmond', 'u:Oklahoma': 'Oklahoma City',
  'u:Tennessee': 'Nashville', 'u:Ohio': 'Columbus', 'u:North Carolina': 'Charlotte', 'u:Alabama': 'Birmingham', 'w:South Africa': 'Pretoria',
};
const out = {}; let fallback = 0;
const regionRings = REGIONS.map((r) => rings(r.d));
const containing = (p) => {
  const x = p.lon, y = mercY(p.lat);
  return REGIONS.map((r, i) => i).filter((i) => {
    const [x0, y0, x1, y1] = REGIONS[i].b;
    return x >= x0 && x <= x1 && y >= y0 && y <= y1 && regionRings[i].some((ring) => inRing(x, y, ring));
  });
};
places.forEach((p) => (p.in = containing(p)));
const capitals = places.filter((p) => p.cls === 'Admin-0 capital');
const vertexDist = (p, i) => {
  const x = p.lon, y = mercY(p.lat);
  let d = Infinity;
  for (const ring of regionRings[i]) for (const [vx, vy] of ring) d = Math.min(d, Math.hypot(vx - x, vy - y));
  return d;
};
REGIONS.forEach((r, i) => {
  const key = `${r.s}:${r.n}`;
  const inside = places.filter((p) => p.in.includes(i));
  let best;
  if (r.s === 'w') {
    best = inside.filter((p) => p.cls === 'Admin-0 capital').sort((a, b) => b.pop - a.pop)[0];
    // Coastal capitals can sit just off the simplified outline: take an offshore one very close to it.
    if (!best) best = capitals.filter((p) => p.in.length === 0).map((p) => [p, vertexDist(p, i)]).filter(([, d]) => d < 0.9).sort((a, b) => a[1] - b[1])[0]?.[0];
    if (!best) best = inside.filter((p) => /Admin-0 capital/.test(p.cls)).sort((a, b) => b.pop - a.pop)[0] ?? inside.sort((a, b) => b.pop - a.pop)[0];
  } else best = inside.sort((a, b) => b.pop - a.pop)[0];
  out[key] = OVERRIDE[key] ?? best?.name ?? r.n;
  if (!OVERRIDE[key] && !best) fallback++;
});
writeFileSync(new URL('cities.json', here), JSON.stringify(out, null, 1));
console.log(`${REGIONS.length} regions, ${fallback} without a city (use the region name)`);
for (const k of ['w:France', 'w:Germany', 'w:India', 'w:Egypt', 'w:Brazil', 'w:Japan', 'u:Illinois', 'u:Texas', 'u:California', 'u:New York', 'u:Florida', 'u:Ohio']) console.log(k, '->', out[k]);
