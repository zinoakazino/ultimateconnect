// Checks src/features/istanbul/istanbul-data.json for mistakes before they reach the phones:
// duplicate ids, unknown categories, program stops pointing at nothing, coordinates outside
// Istanbul, and places whose "zone" doesn't match their distance from the hotel.
//
//   node tools/map/check-data.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'src', 'features', 'istanbul', 'istanbul-data.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const rad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
const inIstanbul = (p) => p.lat > 40.8 && p.lat < 41.25 && p.lng > 28.55 && p.lng < 29.45;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

// --- hotel
const hotel = data.hotel;
if (!isNum(hotel.lat) || !isNum(hotel.lng) || !inIstanbul(hotel)) err('hotel: coordonnées invalides');
if (!hotel.addressTurkish) err("hotel: addressTurkish est vide (c'est ce qu'on montre au chauffeur de taxi)");

// --- ids
const seen = new Map();
function uniq(kind, id) {
  if (!id) return err(`${kind}: id manquant`);
  if (seen.has(id)) err(`id en double : "${id}" (${seen.get(id)} et ${kind})`);
  seen.set(id, kind);
}
data.places.forEach((p) => uniq('place', p.id));
data.zones.forEach((z) => uniq('zone', z.id));
data.transportStops.forEach((t) => uniq('transport', t.id));
data.programs.forEach((p) => uniq('programme', p.id));

// --- categories
const categories = new Set(data.categories.map((c) => c.id));
data.categories.forEach((c) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(c.color)) err(`catégorie ${c.id}: couleur "${c.color}" invalide (attendu #RRGGBB)`);
});

// --- zones
const kinds = new Set(['verte', 'orange', 'eviter', 'prudence']);
const centered = data.zones.filter((z) => z.center === 'hotel');
if (!data.zones.some((z) => z.kind === 'verte')) err('aucune zone "verte"');
if (!data.zones.some((z) => z.kind === 'orange')) err('aucune zone "orange"');
data.zones.forEach((z) => {
  if (!kinds.has(z.kind)) err(`zone ${z.id}: kind "${z.kind}" inconnu`);
  if (!isNum(z.radius) || z.radius <= 0) err(`zone ${z.id}: radius invalide`);
  if (z.center !== 'hotel') {
    if (!isNum(z.lat) || !isNum(z.lng)) err(`zone ${z.id}: lat/lng manquants`);
    else if (!inIstanbul(z)) err(`zone ${z.id}: coordonnées hors d'Istanbul`);
  }
  if (!z.message) warn(`zone ${z.id}: pas de message`);
});
const green = (data.zones.find((z) => z.kind === 'verte') || {}).radius || 2000;
const orange = (data.zones.find((z) => z.kind === 'orange') || {}).radius || 6000;
if (green >= orange) err('le rayon de la zone verte doit être plus petit que celui de la zone orange');
if (centered.length < 2) warn('les cercles vert et orange ne sont pas centrés sur l\'hôtel ("center": "hotel")');

// --- places
const prices = new Set(['Gratuit', '€', '€€', '€€€']);
const places = new Map();
data.places.forEach((p) => {
  places.set(p.id, p);
  if (!categories.has(p.category)) err(`place ${p.id}: catégorie "${p.category}" inconnue`);
  if (!isNum(p.lat) || !isNum(p.lng)) return err(`place ${p.id}: lat/lng invalides`);
  if (!inIstanbul(p)) err(`place ${p.id}: coordonnées hors d'Istanbul`);
  if (!prices.has(p.price)) warn(`place ${p.id}: prix "${p.price}" inhabituel (attendu Gratuit, €, €€ ou €€€)`);
  if (!p.description || !p.tip) warn(`place ${p.id}: description ou conseil vide`);
  const d = meters(p, hotel);
  const expected = d <= green ? 'verte' : d <= orange ? 'orange' : 'staff';
  if (p.zone !== expected) {
    warn(`place ${p.id}: zone "${p.zone}" mais à ${Math.round(d)} m de l'hôtel → "${expected}"`);
  }
  if (!p.verified) warn(`place ${p.id}: coordonnées non vérifiées`);
});

// --- transport stops
const transport = new Map();
data.transportStops.forEach((t) => {
  transport.set(t.id, t);
  if (!isNum(t.lat) || !isNum(t.lng) || !inIstanbul(t)) err(`transport ${t.id}: coordonnées invalides`);
});

// --- programs
data.programs.forEach((prog) => {
  if (!prog.stops.length) err(`programme ${prog.id}: aucune étape`);
  prog.stops.forEach((s, i) => {
    const refs = [s.place, s.transport, s.hotel ? 'hotel' : null].filter(Boolean).length;
    const where = `programme ${prog.id}, étape ${i + 1}`;
    if (refs !== 1) return err(`${where}: il faut exactement un seul de place / transport / hotel`);
    if (s.place && !places.has(s.place)) err(`${where}: place "${s.place}" introuvable`);
    if (s.transport && !transport.has(s.transport)) err(`${where}: transport "${s.transport}" introuvable`);
    if (s.time && !/^\d{2}:\d{2}$/.test(s.time)) err(`${where}: heure "${s.time}" invalide (attendu HH:MM)`);
  });
});

// --- plan days and official programme
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const hhmm = /^\d{2}:\d{2}$/;
data.programs.forEach((p) => {
  if (p.day && !isoDay.test(p.day)) err(`programme ${p.id}: day "${p.day}" invalide (attendu AAAA-MM-JJ)`);
});
if (data.officialProgram) {
  const kinds = ['travel', 'official', 'libre', 'tbd'];
  // travel groups (they fly at different times): a line or a plan with a `group` must name a declared group
  const declared = (data.officialProgram.groups || []).map((g) => g.id);
  const knownGroup = (g) => g === undefined || declared.length === 0 || declared.includes(g);
  data.officialProgram.days.forEach((day) => {
    const where = `programme officiel, jour ${day.id}`;
    if (!isoDay.test(day.date)) err(`${where}: date "${day.date}" invalide (attendu AAAA-MM-JJ)`);
    if (!kinds.includes(day.kind)) err(`${where}: kind "${day.kind}" inconnu (${kinds.join(' / ')})`);
    if (!day.title) err(`${where}: titre vide`);
    day.items.forEach((it, i) => {
      if (!knownGroup(it.group)) err(`${where}, ligne ${i + 1}: groupe ${it.group} absent de officialProgram.groups`);
      if (it.kind === 'flight') {
        if (!it.from || !it.to) err(`${where}, ligne ${i + 1}: vol sans from / to`);
        if (!hhmm.test(it.dep || '') || !hhmm.test(it.arr || '')) err(`${where}, ligne ${i + 1}: vol sans heures dep / arr (HH:MM)`);
      } else if (!it.text) err(`${where}, ligne ${i + 1}: texte vide`);
    });
  });
  // every group's flyer needs its own outward and return flight (a line for everybody counts for all)
  declared.forEach((g) => {
    const flights = data.officialProgram.days
      .flatMap((d) => d.items.filter((it) => it.kind === 'flight' && (it.group === undefined || it.group === g)));
    if (flights.length < 2) err(`groupe ${g}: ${flights.length} vol(s) dans le programme officiel (il en faut un à l'aller et un au retour)`);
  });
  data.programs.forEach((p) => {
    if (!knownGroup(p.group)) err(`programme ${p.id}: groupe ${p.group} absent de officialProgram.groups`);
  });
}

// --- Arabic: the app is bilingual, so every French text of the map needs its Arabic twin in istanbul-data.ar.json
const arFile = path.join(__dirname, '..', '..', 'src', 'features', 'istanbul', 'istanbul-data.ar.json');
if (!fs.existsSync(arFile)) {
  err('istanbul-data.ar.json est introuvable (les textes arabes de la carte)');
} else {
  const ar = JSON.parse(fs.readFileSync(arFile, 'utf8'));
  const need = (ok, what) => {
    if (!ok) err(`arabe : ${what} n'a pas de traduction dans istanbul-data.ar.json`);
  };
  data.categories.forEach((c) => need(ar.categories?.[c.id], `catégorie « ${c.id} »`));
  data.zones.forEach((z) => {
    need(ar.zones?.[z.id]?.name, `nom de la zone « ${z.id} »`);
    need(ar.zones?.[z.id]?.message, `message de la zone « ${z.id} »`);
  });
  data.transportStops.forEach((t) => need(ar.transportStops?.[t.id], `arrêt « ${t.id} »`));
  data.safeAnchors.forEach((a) => need(ar.safeAnchors?.[a.name], `point de retour « ${a.name} »`));
  need((ar.rules || []).length === data.rules.length, `les règles du groupe (${data.rules.length} attendues)`);
  need(ar.emergency?.numberLabel && ar.emergency?.taxiPhraseFrench, 'les textes d’urgence');
  data.emergency.staff.forEach((s) => s.role && need(ar.emergency?.staffRoles?.[s.role], `rôle « ${s.role} »`));
  data.emergency.scams.forEach((s, i) => need(ar.emergency?.scams?.[i]?.title && ar.emergency?.scams?.[i]?.text, `arnaque n° ${i + 1} (${s.title})`));
  data.places.forEach((p) => {
    const x = ar.places?.[p.id];
    need(x?.name, `nom du lieu « ${p.id} »`);
    need(x?.description, `description du lieu « ${p.id} »`);
    if (p.tip) need(x?.tip, `conseil du lieu « ${p.id} »`);
  });
  data.programs.forEach((p) => {
    const x = ar.programs?.[p.id];
    need(x?.title && x?.tagline && x?.mode, `titre / sous-titre / mode du programme « ${p.id} »`);
    need((p.warnings || []).length === (x?.warnings || []).length, `avertissements du programme « ${p.id} » (${(p.warnings || []).length} attendus)`);
    p.stops.forEach((s, i) => {
      if (s.label) need(x?.stops?.[i]?.label, `étape ${i + 1} du programme « ${p.id} »`);
      if (s.note) need(x?.stops?.[i]?.note, `note de l’étape ${i + 1} du programme « ${p.id} »`);
    });
  });
}

// --- emergency
if (!data.emergency.number) err('emergency.number est vide');
data.emergency.staff.forEach((c) => {
  if (!c.phone) warn(`contact staff "${c.name}": numéro à renseigner`);
});

// --- safe anchors
data.safeAnchors.forEach((a) => {
  if (!isNum(a.lat) || !isNum(a.lng) || !inIstanbul(a)) err(`safeAnchors "${a.name}": coordonnées invalides`);
});

console.log(
  `${data.places.length} lieux, ${data.zones.length} zones, ${data.programs.length} programmes, ` +
    `${data.transportStops.length} arrêts de transport.`
);
warnings.forEach((w) => console.log('  ! ' + w));
errors.forEach((e) => console.log('  ✗ ' + e));
if (errors.length) {
  console.log(`\n${errors.length} erreur(s).`);
  process.exit(1);
}
console.log(warnings.length ? `\nOK avec ${warnings.length} avertissement(s).` : '\nOK.');
