// Tests for src/features/istanbul/geo.ts against the real data file.
//   node tools/map/geo.test.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const dir = path.join(__dirname, '..', '..', 'src', 'features', 'istanbul');
const src = fs.readFileSync(path.join(dir, 'geo.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
const geo = mod.exports;
const data = JSON.parse(fs.readFileSync(path.join(dir, 'istanbul-data.json'), 'utf8'));

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && detail ? '  -> ' + detail : ''}`);
}
const zone = (id) => data.zones.find((z) => z.id === id);

// distances
const ayasofya = data.places.find((p) => p.id === 'ayasofya');
const d = geo.distanceMeters(data.hotel, ayasofya);
check('hôtel → Sainte-Sophie ≈ 600–1000 m', d > 600 && d < 1000, String(Math.round(d)));
check('distance nulle', geo.distanceMeters(data.hotel, data.hotel) === 0);

// at the hotel: all good
let s = geo.locate({ lat: data.hotel.lat, lng: data.hotel.lng }, data);
check('à l’hôtel : zone verte, aucun avertissement', s.band === 'verte' && s.notices.length === 1 && s.notices[0].level === 'ok');

// in a red zone
const t = zone('tarlabasi');
s = geo.locate({ lat: t.lat, lng: t.lng }, data);
check('Tarlabaşı : alerte rouge', s.notices[0].level === 'red' && /zone à éviter/.test(s.notices[0].title));
check('Tarlabaşı : propose un point de retour', !!s.anchor && /Revenez vers/.test(s.notices[0].text), JSON.stringify(s.anchor));
check('Tarlabaşı : le point de retour n’est pas dans une zone rouge', (() => {
  const a = data.safeAnchors.find((x) => s.anchor && x.name === s.anchor.name);
  const at = a.hotel ? data.hotel : a;
  return !data.zones.filter((z) => z.kind === 'eviter').some((z) => geo.isInside(at, z, data.hotel));
})());

// amber zone
const k = zone('kasimpasa');
s = geo.locate({ lat: k.lat, lng: k.lng }, data);
check('Kasımpaşa : avertissement orange « Prudence »', s.notices.some((n) => n.level === 'amber' && /Prudence/.test(n.title)));
check('Kasımpaşa : pas d’alerte rouge', !s.notices.some((n) => n.level === 'red'));

// orange band, nothing special
const kadikoy = data.places.find((p) => p.id === 'kadikoy');
s = geo.locate({ lat: kadikoy.lat, lng: kadikoy.lng }, data);
check('Kadıköy : bande orange + bannière ambre', s.band === 'orange' && s.notices[0].level === 'amber' && /hors de la zone verte/.test(s.notices[0].title));

// outside the orange circle
const camlica = data.places.find((p) => p.id === 'camlica');
s = geo.locate({ lat: camlica.lat, lng: camlica.lng }, data);
check('Çamlıca : hors zone autorisée (rouge, contactez le staff)', s.band === 'staff' && s.notices[0].level === 'red' && /Contactez le staff/.test(s.notices[0].text));

// notices sorted by severity
s = geo.locate({ lat: t.lat, lng: t.lng }, data);
const rank = { red: 0, amber: 1, ok: 2 };
check('avertissements triés par gravité', s.notices.every((n, i, a) => i === 0 || rank[a[i - 1].level] <= rank[n.level]));

// every place's declared zone equals its computed zone
const wrong = data.places.filter((p) => geo.accessZoneOf(p, data) !== p.zone).map((p) => p.id);
check('la zone de chaque lieu correspond à sa distance', wrong.length === 0, wrong.join(', '));

// every program stop resolves
const places = new Set(data.places.map((p) => p.id));
const transport = new Set(data.transportStops.map((x) => x.id));
const dangling = [];
data.programs.forEach((p) => p.stops.forEach((st, i) => {
  if (st.place && !places.has(st.place)) dangling.push(`${p.id}#${i + 1}`);
  if (st.transport && !transport.has(st.transport)) dangling.push(`${p.id}#${i + 1}`);
}));
check('toutes les étapes des programmes existent', dangling.length === 0, dangling.join(', '));

// formatting
check('formatDistance 420 m', geo.formatDistance(420) === '420 m', geo.formatDistance(420));
check('formatDistance 1,4 km', geo.formatDistance(1430) === '1,4 km', geo.formatDistance(1430));

console.log(`\n${pass}/${pass + fail} tests réussis`);
process.exit(fail ? 1 : 0);
