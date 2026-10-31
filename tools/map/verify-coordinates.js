// Checks every coordinate in src/features/istanbul/istanbul-data.json against OpenStreetMap
// (Nominatim) and prints what differs. It is read-only: it never edits the data file, because the
// first OpenStreetMap hit is not always the right place (a bazaar can come back as one of its
// inner courtyards, a stop as another city's pier...). Review the report, then fix by hand.
//
//   node tools/map/verify-coordinates.js     -> prints a report, writes tools/map/verify-report.json
//
// Nominatim's usage policy: at most 1 request per second and an identifying User-Agent, so the
// script waits between requests. Run it only when you change coordinates, not on every build.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'src', 'features', 'istanbul', 'istanbul-data.json');
const REPORT = path.join(__dirname, 'verify-report.json');
const MATCH_M = 150; // closer than this: coordinates are confirmed as they are
const UA = 'UltimateConnect-trip-map/1.0 (coordinate check for a private group trip)';

const rad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&accept-language=tr,fr' +
    '&viewbox=28.55,41.30,29.45,40.85&bounded=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const items = [
    { kind: 'hotel', ref: data.hotel },
    ...data.zones.filter((z) => z.osmQuery).map((z) => ({ kind: 'zone', ref: z })),
    ...data.places.map((p) => ({ kind: 'place', ref: p })),
    ...data.transportStops.map((t) => ({ kind: 'transport', ref: t })),
  ];

  const rows = [];
  for (const { kind, ref } of items) {
    let results = [];
    try {
      results = await search(ref.osmQuery);
    } catch (e) {
      results = [];
      console.error('  ! request failed for', ref.id, e.message);
    }
    const top = results[0];
    const given = { lat: ref.lat, lng: ref.lng };
    const found = top ? { lat: Number(top.lat), lng: Number(top.lon) } : null;
    const dist = found ? Math.round(meters(given, found)) : null;
    const status = !found ? 'introuvable' : dist <= MATCH_M ? 'ok' : 'ecart';
    rows.push({
      kind, id: ref.id, name: ref.name, query: ref.osmQuery, status, distanceM: dist, given,
      found, osmName: top ? top.display_name.split(',').slice(0, 3).join(',') : null,
      osmType: top ? `${top.category}/${top.type}` : null,
      alternatives: results.slice(1).map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), name: r.display_name.split(',')[0] })),
    });
    const flag = status === 'ok' ? 'OK ' : status === 'ecart' ? 'ECART' : '???';
    console.log(`${flag.padEnd(6)} ${kind.padEnd(9)} ${String(ref.id).padEnd(22)} ${dist == null ? '   -' : String(dist).padStart(5) + ' m'}  ${top ? top.display_name.split(',')[0] : ''}`);
    await sleep(1100);
  }

  fs.writeFileSync(REPORT, JSON.stringify(rows, null, 2));
  const count = (s) => rows.filter((r) => r.status === s).length;
  console.log(`\n${count('ok')} confirmés, ${count('ecart')} avec écart (> ${MATCH_M} m), ${count('introuvable')} introuvables.`);
  console.log('Rapport complet :', path.relative(process.cwd(), REPORT));

  console.log(
    'Le fichier de données n\'a pas été modifié. Corrigez les positions à la main (le premier résultat\n' +
      'd\'OpenStreetMap n\'est pas toujours le bon lieu), puis mettez "verified": true.'
  );
})().catch((e) => { console.error(e); process.exit(1); });
