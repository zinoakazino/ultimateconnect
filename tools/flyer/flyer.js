/* Builds the Istanbul flyer in the browser: renders the vector basemap with MapLibre, draws the
   zones / numbered places on top as SVG, and lays out the checklist side. build-flyer.js drives this
   page with headless Chrome and prints it to PDF. */
'use strict';

(async function main() {
  const PX = 96 / 25.4; // css px per mm
  const FW = 95;
  const FH = 200; // flyer size in mm
  const W = FW * PX;
  const H = FH * PX;
  const RIBBON = 15 * PX;
  const PANEL = 62 * PX;
  const MAP_TOP = RIBBON;
  const MAP_BOTTOM = H - PANEL;

  const ZONE = { verte: '#16A34A', orange: '#EA580C', eviter: '#DC2626', prudence: '#EAB308' };
  const ZONE_TEXT = { eviter: '#B91C1C', prudence: '#92400E' };

  // Well-known districts, written on the maps as our own small labels: the basemap's neighbourhood names are
  // obscure "mahalle" names that sit under the pins. [name, lat, lng] is only a hint of where a label belongs;
  // it slides to the nearest free spot and is left out when there is none.
  const AREAS = [
    ['Sultanahmet', 41.0062, 28.9775],
    ['Eminönü', 41.0172, 28.9702],
    ['Karaköy', 41.0228, 28.9770],
    ['Beyoğlu', 41.0335, 28.9765],
    ['Galata', 41.0268, 28.9722],
    ['Beyazıt', 41.0105, 28.9657],
    ['Fatih', 41.0160, 28.9560],
    ['Cibali', 41.0236, 28.9594],
  ];
  const FAR_AREAS = [
    ['Üsküdar', 41.0235, 29.0235],
    ['Kadıköy', 40.9900, 29.0290],
    ['Beşiktaş', 41.0440, 29.0060],
    ['Şişli', 41.0610, 28.9870],
    ['Eyüp', 41.0500, 28.9300],
    ['Zeytinburnu', 40.9930, 28.9070],
  ];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = (n) => Math.round(n * 10) / 10;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rad = (d) => (d * Math.PI) / 180;
  const upperTr = (s) => s.toLocaleUpperCase('tr-TR');

  const { data, qrSvg, options } = await (await fetch('/flyer-data.json')).json();
  const log = (...a) => console.log('[flyer]', ...a);

  await Promise.all(
    [
      '500 16pt Jost', '600 8pt Jost', '700 8pt Jost',
      '400 6pt Manrope', '500 6pt Manrope', '600 6pt Manrope', '700 6pt Manrope', '800 6pt Manrope',
      '400 6pt Plex', '500 6pt Plex',
    ].map((f) => document.fonts.load(f))
  );
  await document.fonts.ready;

  const measureCtx = document.createElement('canvas').getContext('2d');
  const measure = (txt, weight, size, spacing = 0) => {
    measureCtx.font = `${weight} ${size}px Manrope`;
    return measureCtx.measureText(txt).width + spacing * txt.length;
  };

  /* ---------------- data: numbering ---------------- */
  const numbered = [];
  for (const c of data.categories) {
    if (c.id === 'pratique') continue;
    for (const p of data.places.filter((x) => x.category === c.id)) {
      numbered.push({ ...p, n: numbered.length + 1, color: c.color, short: p.short || p.name.replace(/\s*\(.*?\)\s*/g, '').trim() });
    }
  }
  const practical = data.places
    .filter((p) => p.category === 'pratique')
    .map((p) => ({ ...p, short: p.short || p.name, sym: /police/i.test(p.name) ? 'P' : 'T', color: /police/i.test(p.name) ? '#1d4ed8' : '#475569' }));
  const byId = Object.fromEntries(numbered.map((p) => [p.id, p]));
  const transportById = Object.fromEntries(data.transportStops.map((t) => [t.id, t]));
  const hotel = data.hotel;
  const radii = {
    green: (data.zones.find((z) => z.kind === 'verte') || {}).radius || 2000,
    orange: (data.zones.find((z) => z.kind === 'orange') || {}).radius || 6000,
  };
  const zoneCenter = (z) => (z.center === 'hotel' || z.lat === undefined ? { lat: hotel.lat, lng: hotel.lng } : { lat: z.lat, lng: z.lng });

  /* ---------------- basemap ---------------- */
  const baseStyle = await (await fetch('https://tiles.openfreemap.org/styles/positron')).json();
  function printStyle(kind) {
    const s = JSON.parse(JSON.stringify(baseStyle));
    const layer = (id) => s.layers.find((l) => l.id === id);
    const paint = (id, k, v) => { const l = layer(id); if (l) { l.paint = l.paint || {}; l.paint[k] = v; } };
    const hide = (id) => { const l = layer(id); if (l) { l.layout = l.layout || {}; l.layout.visibility = 'none'; } };
    paint('background', 'background-color', '#f4f2ec');
    paint('water', 'fill-color', '#b7d4e8');
    paint('waterway', 'line-color', '#b7d4e8');
    paint('park', 'fill-color', '#d5e6cc');
    paint('landcover_wood', 'fill-color', '#d0e1c7');
    paint('landuse_residential', 'fill-color', '#ece8df');
    paint('building', 'fill-color', '#e3ded2');
    paint('highway_minor', 'line-color', '#d3cec2');
    paint('highway_path', 'line-color', '#e0dbd0');
    paint('highway_major_casing', 'line-color', '#c9c3b5');
    paint('highway_motorway_casing', 'line-color', '#bdb7a8');
    paint('road_area_pier', 'fill-color', '#f4f2ec');
    paint('road_pier', 'line-color', '#f4f2ec');
    if (kind === 'inset') {
      // the overview carries its own few labels
      s.layers.filter((l) => l.type === 'symbol').forEach((l) => hide(l.id));
      return s;
    }
    // main map: every district / street / country label is hidden (we draw the useful ones ourselves);
    // only the Golden Horn keeps its curved label, in French
    for (const id of [
      'label_other', 'label_town', 'label_village', 'label_state', 'label_city', 'label_city_capital',
      'label_country_1', 'label_country_2', 'label_country_3', 'airport', 'waterway_line_label',
      'highway-name-path', 'highway-name-minor', 'highway-name-major',
      'highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us',
      'boundary_3', 'boundary_2', 'boundary_disputed',
    ]) hide(id);
    for (const id of ['water_name_line_label', 'water_name_point_label']) {
      const l = layer(id);
      if (!l) continue;
      l.layout['text-field'] = ['case', ['==', ['get', 'name'], 'Haliç'], 'Corne d’Or', ['coalesce', ['get', 'name_en'], ['get', 'name']]];
      l.layout['text-size'] = 11;
      l.layout['text-letter-spacing'] = 0.25;
      l.paint = l.paint || {};
      l.paint['text-color'] = '#3d5a8c';
      l.paint['text-halo-color'] = 'rgba(183,212,232,0.9)';
      l.paint['text-halo-width'] = 1.2;
    }
    return s;
  }

  function waitIdle(map) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const check = () => { if (map.loaded() && map.areTilesLoaded()) finish(); else map.once('idle', check); };
      map.once('idle', check);
      setTimeout(check, 400);
      setTimeout(finish, 60000);
    });
  }

  async function renderMap({ kind, width, height, pixelRatio, center, zoom, bounds, padding }) {
    const host = document.createElement('div');
    host.style.cssText = `position:absolute; left:0; top:0; width:${width}px; height:${height}px;`;
    document.getElementById('offscreen').appendChild(host);
    const map = new maplibregl.Map({
      container: host, style: printStyle(kind), center, zoom: zoom ?? 10, interactive: false, attributionControl: false,
      fadeDuration: 0, pixelRatio, preserveDrawingBuffer: true,
    });
    map.on('error', (e) => log('map error', e && e.error && e.error.message));
    await new Promise((r) => map.once('load', r));
    if (bounds) map.fitBounds(bounds, { padding, duration: 0 });
    await waitIdle(map);
    await new Promise((r) => setTimeout(r, 600));
    await waitIdle(map);
    const blob = await new Promise((r) => map.getCanvas().toBlob(r, 'image/png'));
    return { map, host, url: URL.createObjectURL(blob), bytes: blob.size, pixelRatio };
  }

  // colour of a point of the rendered basemap (to find open water for our own water labels)
  async function makeSampler(url, pixelRatio) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    return (x, y) => cx.getImageData(Math.max(0, Math.round(x * pixelRatio)), Math.max(0, Math.round(y * pixelRatio)), 1, 1).data;
  }

  const mpp = (map, lat) => (78271.51696 * Math.cos(rad(lat))) / Math.pow(2, map.getZoom());
  function ringPoints(map, lat, lng, r, steps = 120) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      pts.push(map.project([lng + (r * Math.sin(a)) / (111320 * Math.cos(rad(lat))), lat + (r * Math.cos(a)) / 111320]));
    }
    return pts;
  }
  const pathOf = (pts) => 'M' + pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join('L') + 'Z';
  const onRing = (map, lat, lng, r, bearing) =>
    map.project([lng + (r * Math.sin(rad(bearing))) / (111320 * Math.cos(rad(lat))), lat + (r * Math.cos(rad(bearing))) / 111320]);

  /* push overlapping markers apart (they keep a leader line to their true spot) */
  function relax(items, bounds) {
    items.forEach((it, i) => {
      it.x = it.x0 + Math.cos(i * 2.399) * 0.4;
      it.y = it.y0 + Math.sin(i * 2.399) * 0.4;
    });
    const step = (spring) => {
      let moved = 0;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          const min = a.r + b.r + 1.4;
          if (d >= min) continue;
          if (d < 0.001) { dx = 1; dy = 0; d = 1; }
          const push = min - d;
          const ux = dx / d;
          const uy = dy / d;
          const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5;
          const wb = b.fixed ? 0 : a.fixed ? 1 : 0.5;
          a.x -= ux * push * wa; a.y -= uy * push * wa;
          b.x += ux * push * wb; b.y += uy * push * wb;
          moved++;
        }
      }
      for (const it of items) {
        if (it.fixed) continue;
        if (spring) { it.x += (it.x0 - it.x) * spring; it.y += (it.y0 - it.y) * spring; }
        it.x = clamp(it.x, bounds.x0 + it.r, bounds.x1 - it.r);
        it.y = clamp(it.y, bounds.y0 + it.r, bounds.y1 - it.r);
      }
      return moved;
    };
    for (let k = 0; k < 700; k++) step(0.012);
    for (let k = 0; k < 400; k++) if (!step(0)) break;
  }

  /* label placement: a set of boxes already taken (pins, leader lines, other labels, map furniture) */
  const SLIDE = [0, 180, 270, 90, 315, 45, 225, 135, 337.5, 22.5, 202.5, 157.5, 292.5, 67.5, 247.5, 112.5];
  function makeScene(win) {
    const boxes = [];
    const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    const scene = {
      claim(b) { boxes.push(b); return b; },
      free(b) {
        return b.x0 >= win.x0 && b.x1 <= win.x1 && b.y0 >= win.y0 && b.y1 <= win.y1 && !boxes.some((o) => hit(o, b));
      },
      // first free spot for a w x h box: at the anchor, then sliding outwards in rings
      place(ax, ay, w, h, maxR = 40, step = 4) {
        for (let r = 0; r <= maxR; r += step) {
          const dirs = r === 0 ? [0] : SLIDE;
          for (const deg of dirs) {
            const cx = ax + Math.cos(rad(deg)) * r;
            const cy = ay + Math.sin(rad(deg)) * r;
            const b = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
            if (scene.free(b)) return { cx, cy, box: scene.claim(b) };
          }
        }
        return null;
      },
    };
    return scene;
  }
  const haloText = (txt, x, y, o) =>
    `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${o.anchor || 'middle'}" dominant-baseline="central" font-family="Manrope" font-weight="${o.weight || 700}" font-size="${o.size}" letter-spacing="${o.spacing || 0}" fill="${o.fill}"${o.italic ? ' font-style="italic"' : ''} style="paint-order:stroke" stroke="${o.halo || '#ffffff'}" stroke-width="${o.hw || 2.4}" stroke-linejoin="round" stroke-opacity="${o.haloOpacity ?? 1}"${o.rotate ? ` transform="rotate(${o.rotate} ${r1(x)} ${r1(y)})"` : ''}>${esc(txt)}</text>`;

  /* ---------------- FRONT ---------------- */
  async function buildFront() {
    if (options.skipMaps) return { html: '<div class="flyer front"></div>', scale: 0, markers: [], offZones: [] };

    /* ----- main map ----- */
    const main = await renderMap({
      kind: 'main', width: W, height: H, pixelRatio: 4, center: [hotel.lng, hotel.lat],
      bounds: options.mainBounds,
      padding: { top: MAP_TOP + 12, bottom: PANEL + 10, left: 8, right: 8 },
    });
    const mainMap = main.map;
    const mainMpp = mpp(mainMap, hotel.lat);
    const scale = Math.round((mainMpp * 1000) / (25.4 / 96));
    log('main map zoom', r1(mainMap.getZoom()), 'scale ~1:' + scale, 'png', Math.round(main.bytes / 1024), 'KB');
    const sample = await makeSampler(main.url, main.pixelRatio);
    const isWater = (x, y) => { const c = sample(x, y); return Math.abs(c[0] - 183) < 18 && Math.abs(c[1] - 212) < 18 && Math.abs(c[2] - 232) < 18; };
    const overWater = (b) => {
      for (let x = b.x0; x <= b.x1; x += 4) for (let y = b.y0; y <= b.y1; y += 4) if (!isWater(x, y)) return false;
      return true;
    };

    const hp = mainMap.project([hotel.lng, hotel.lat]);
    const win = { x0: 4, x1: W - 4, y0: MAP_TOP + 4, y1: MAP_BOTTOM - 4 };
    const inWin = (p, m = 14) => p.x > win.x0 - m && p.x < win.x1 + m && p.y > win.y0 - m && p.y < win.y1 + m;
    const NORTH = { x: W - 17, y: MAP_TOP + 19, r: 10 };

    const markers = [];
    numbered.forEach((p) => {
      const q = mainMap.project([p.lng, p.lat]);
      if (inWin(q, 6)) markers.push({ kind: 'num', ref: p, x0: q.x, y0: q.y, r: 7.6 });
    });
    practical.forEach((p) => {
      const q = mainMap.project([p.lng, p.lat]);
      if (inWin(q, 6)) markers.push({ kind: 'sym', ref: p, x0: q.x, y0: q.y, r: 6.2 });
    });
    markers.push({ kind: 'hotel', ref: hotel, x0: hp.x, y0: hp.y, r: 11.5, fixed: true });
    markers.push({ kind: 'furniture', x0: NORTH.x, y0: NORTH.y, r: NORTH.r + 2, fixed: true });
    relax(markers, win);

    // what is already taken on the map
    const scene = makeScene(win);
    for (const m of markers) {
      if (m.kind === 'furniture') continue;
      const rr = m.kind === 'hotel' ? 14.5 : m.r + 1.8;
      scene.claim({ x0: m.x - rr, x1: m.x + rr, y0: m.y - rr, y1: m.y + rr });
      if (m.kind === 'hotel') scene.claim({ x0: m.x - 13, x1: m.x + 13, y0: m.y + 12, y1: m.y + 24 });
      const d = Math.hypot(m.x - m.x0, m.y - m.y0);
      if (m.kind !== 'hotel' && d > m.r * 0.9) {
        const n = Math.ceil(d / 3);
        for (let k = 0; k <= n; k++) {
          const px = m.x0 + ((m.x - m.x0) * k) / n;
          const py = m.y0 + ((m.y - m.y0) * k) / n;
          scene.claim({ x0: px - 1.6, x1: px + 1.6, y0: py - 1.6, y1: py + 1.6 });
        }
      }
    }
    scene.claim({ x0: NORTH.x - NORTH.r - 1, x1: NORTH.x + NORTH.r + 1, y0: NORTH.y - NORTH.r - 1, y1: NORTH.y + NORTH.r + 4 });
    const sbLen = 500 / mainMpp;
    const sbx = 9;
    const sby = MAP_BOTTOM - 13;
    scene.claim({ x0: sbx - 5, x1: sbx + sbLen + 27, y0: sby - 10, y1: sby + 12 });
    const attribution = '© OpenStreetMap contributors · OpenFreeMap · OpenMapTiles';
    const attrW = measure(attribution, 500, 4.4);
    scene.claim({ x0: W - 6 - attrW, x1: W - 3, y0: MAP_BOTTOM - 11, y1: MAP_BOTTOM - 2 });

    const layers = { rings: '', zones: '', water: '', areas: '', zoneLabels: '', ringLabels: '', leaders: '', markers: '', ui: '' };

    // rings around the hotel: distance guides and the edge of the green zone
    for (const r of [500, 1000, 1500]) {
      layers.rings += `<path d="${pathOf(ringPoints(mainMap, hotel.lat, hotel.lng, r))}" fill="none" stroke="#2f7d55" stroke-width="0.9" stroke-dasharray="1.2 3.2" stroke-linecap="round" opacity="0.75"/>`;
    }
    layers.rings += `<path d="${pathOf(ringPoints(mainMap, hotel.lat, hotel.lng, radii.green))}" fill="rgba(22,163,74,0.07)" stroke="${ZONE.verte}" stroke-width="2.4" stroke-linejoin="round"/>`;

    // danger / caution zones, then their labels (first pick of the free space: they are the safety message)
    const zoneLines = (z) => {
      if (z.id === 'taksim-nuit') return ['TAKSİM', 'PRUDENCE', 'LA NUIT'];
      return [upperTr(z.name), z.kind === 'eviter' ? 'À ÉVITER' : 'PRUDENCE'];
    };
    const offZones = [];
    const zoneBits = [];
    for (const z of data.zones.filter((x) => x.kind === 'eviter' || x.kind === 'prudence')) {
      const c = zoneCenter(z);
      const q = mainMap.project([c.lng, c.lat]);
      const rpx = z.radius / mainMpp;
      if (q.x + rpx < win.x0 || q.x - rpx > win.x1 || q.y + rpx < win.y0 || q.y - rpx > win.y1) { offZones.push(z); continue; }
      const col = ZONE[z.kind];
      layers.zones += `<path d="${pathOf(ringPoints(mainMap, c.lat, c.lng, z.radius, 72))}" fill="${col}" fill-opacity="${z.kind === 'eviter' ? 0.26 : 0.3}" stroke="${col}" stroke-width="1.5" stroke-dasharray="${z.kind === 'prudence' ? '4 2.5' : 'none'}"/>`;
      zoneBits.push({ z, q, rpx });
    }
    for (const { z, q, rpx } of zoneBits) {
      const lines = zoneLines(z);
      const sizes = lines.map((_, i) => (i === 0 ? 6.8 : 5.8));
      const w = Math.max(...lines.map((t, i) => measure(t, i === 0 ? 800 : 700, sizes[i], 0.4))) + 3;
      const lh = lines.map((_, i) => (i === 0 ? 8 : 6.6));
      const h = lh.reduce((a, b) => a + b, 0) + 1.5;
      const spot = scene.place(clamp(q.x, win.x0 + w / 2, win.x1 - w / 2), clamp(q.y, win.y0 + h / 2, win.y1 - h / 2), w, h, Math.max(18, rpx * 0.9), 3);
      if (!spot) { log('no room for the label of zone', z.id); continue; }
      let y = spot.cy - h / 2 + 0.75;
      lines.forEach((t, i) => {
        y += lh[i] / 2;
        layers.zoneLabels += haloText(t, spot.cx, y, { size: sizes[i], weight: i === 0 ? 800 : 700, spacing: 0.4, fill: ZONE_TEXT[z.kind], hw: i === 0 ? 2.6 : 2.2 });
        y += lh[i] / 2;
      });
    }

    // distance labels on the rings
    const pill = (txt, x, y, color) => {
      const w = measure(txt, 800, 6.2) + 8;
      return `<g transform="translate(${r1(x)},${r1(y)})"><rect x="${r1(-w / 2)}" y="-5" width="${r1(w)}" height="10" rx="5" fill="#ffffff" fill-opacity="0.94" stroke="${color}" stroke-width="0.7"/>` +
        `<text x="0" y="0.4" text-anchor="middle" dominant-baseline="central" font-family="Manrope" font-weight="800" font-size="6.2" fill="${color}">${esc(txt)}</text></g>`;
    };
    const bearings = [];
    for (let k = 0; k < 36; k++) bearings.push(k * 10);
    const labelRings = [[radii.green, `ZONE VERTE · ${radii.green / 1000} km`, '#15803d', 45], [500, '500 m', '#2f7d55', 60], [1000, '1 km', '#2f7d55', 60], [1500, '1,5 km', '#2f7d55', 60]];
    for (const [r, txt, color, prefer] of labelRings) {
      const w = measure(txt, 800, 6.2) + 8;
      const order = [...bearings].sort((a, b) => {
        const da = (x) => Math.min(Math.abs(x - prefer), 360 - Math.abs(x - prefer));
        return da(a) - da(b);
      });
      for (const b of order) {
        const q = onRing(mainMap, hotel.lat, hotel.lng, r, b);
        const box = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - 5.4, y1: q.y + 5.4 };
        if (!scene.free(box)) continue;
        scene.claim(box);
        layers.ringLabels += pill(txt, q.x, q.y, color);
        break;
      }
    }

    // our own water labels, on open water only
    const waterLabel = (txt, rotate, candidates) => {
      const w = measure(txt, 700, 6.4, 1.8);
      const bw = rotate ? 9 : w;
      const bh = rotate ? w : 9;
      for (const [cx, cy] of candidates) {
        const b = { x0: cx - bw / 2, x1: cx + bw / 2, y0: cy - bh / 2, y1: cy + bh / 2 };
        if (!scene.free(b) || !overWater(b)) continue;
        scene.claim(b);
        layers.water += haloText(txt, cx, cy, { size: 6.4, weight: 700, spacing: 1.8, fill: '#4a6f96', italic: true, hw: 1.6, halo: '#b7d4e8', rotate });
        return true;
      }
      return false;
    };
    const grid = (xs, y0, y1, st) => { const out = []; for (let y = y0; y <= y1; y += st) for (const x of xs) out.push([x, y]); return out; };
    waterLabel('BOSPHORE', -90, grid([W - 12, W - 22, W - 32, W - 42], MAP_TOP + 90, MAP_TOP + 290, 6));
    if (!waterLabel('MER DE MARMARA', 0, grid([W - 62, W - 80, W - 98, W - 120, W - 140], MAP_TOP + 300, MAP_BOTTOM - 14, 6))) {
      waterLabel('MARMARA', 0, grid([W - 30, W - 38, W - 46, W - 54, W - 62, W - 80, W - 100], MAP_TOP + 300, MAP_BOTTOM - 14, 6));
    }

    // district names, last, in the gaps
    for (const [name, lat, lng] of AREAS) {
      const q = mainMap.project([lng, lat]);
      if (!inWin(q, 12)) continue;
      const txt = upperTr(name);
      const w = measure(txt, 600, 6.2, 0.8) + 2;
      const spot = scene.place(clamp(q.x, win.x0 + w / 2, win.x1 - w / 2), clamp(q.y, win.y0 + 6, win.y1 - 6), w, 8, 46, 4);
      if (!spot) { log('no room for the district label', name); continue; }
      layers.areas += haloText(txt, spot.cx, spot.cy, { size: 6.2, weight: 600, spacing: 0.8, fill: '#6d6d60', hw: 2.2, haloOpacity: 0.75 });
    }

    // leader lines for markers that had to move, then the markers
    for (const m of markers) {
      if (m.fixed) continue;
      const d = Math.hypot(m.x - m.x0, m.y - m.y0);
      if (d > m.r * 0.9) {
        layers.leaders += `<line x1="${r1(m.x0)}" y1="${r1(m.y0)}" x2="${r1(m.x)}" y2="${r1(m.y)}" stroke="#2b2b2b" stroke-width="0.8"/>`;
        layers.leaders += `<circle cx="${r1(m.x0)}" cy="${r1(m.y0)}" r="1.9" fill="#2b2b2b" stroke="#ffffff" stroke-width="0.7"/>`;
      }
    }
    for (const m of markers) {
      const x = r1(m.x);
      const y = r1(m.y);
      if (m.kind === 'num') {
        const p = m.ref;
        layers.markers += `<g><circle cx="${x}" cy="${y}" r="${m.r + 1.2}" fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="0.7"/><circle cx="${x}" cy="${y}" r="${m.r}" fill="${p.color}" stroke="#ffffff" stroke-width="1.5"/>` +
          `<text x="${x}" y="${r1(y + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="Manrope" font-weight="800" font-size="${p.n > 9 ? 7.6 : 8.6}" fill="#ffffff">${p.n}</text></g>`;
      } else if (m.kind === 'sym') {
        const p = m.ref;
        layers.markers += `<g><rect x="${r1(x - m.r)}" y="${r1(y - m.r)}" width="${m.r * 2}" height="${m.r * 2}" rx="2.2" fill="${p.color}" stroke="#ffffff" stroke-width="1.4"/>` +
          `<text x="${x}" y="${r1(y + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="Manrope" font-weight="800" font-size="7.4" fill="#ffffff">${p.sym}</text></g>`;
      } else if (m.kind === 'hotel') {
        layers.markers += `<g><circle cx="${x}" cy="${y}" r="13.6" fill="rgba(22,163,74,0.30)"/><circle cx="${x}" cy="${y}" r="11.2" fill="#0f3225" stroke="#ffffff" stroke-width="2"/>` +
          `<path d="M${x - 5.2} ${y + 0.6} L${x} ${y - 4.6} L${x + 5.2} ${y + 0.6} V${y + 5} H${x - 5.2} Z" fill="#ffffff"/><rect x="${x - 1.5}" y="${y + 1.6}" width="3" height="3.4" fill="#0f3225"/>` +
          `<g transform="translate(${x},${r1(y + 17.6)})"><rect x="-11" y="-4.6" width="22" height="9.2" rx="4.6" fill="#0f3225" stroke="#ffffff" stroke-width="1"/>` +
          `<text x="0" y="0.4" text-anchor="middle" dominant-baseline="central" font-family="Manrope" font-weight="800" font-size="5.6" letter-spacing="0.5" fill="#ffffff">HÔTEL</text></g></g>`;
      }
    }

    // scale bar, north arrow, attribution
    layers.ui += `<g><rect x="${sbx - 4}" y="${sby - 9}" width="${r1(sbLen + 30)}" height="20" rx="2" fill="#ffffff" fill-opacity="0.85"/>` +
      `<path d="M${sbx} ${sby} H${r1(sbx + sbLen)} M${sbx} ${sby - 3} V${sby + 3} M${r1(sbx + sbLen)} ${sby - 3} V${sby + 3}" stroke="#1f2a24" stroke-width="1.3" fill="none"/>` +
      `<text x="${sbx}" y="${sby + 9}" font-family="Manrope" font-weight="700" font-size="5.4" fill="#1f2a24">0</text>` +
      `<text x="${r1(sbx + sbLen)}" y="${sby + 9}" text-anchor="end" font-family="Manrope" font-weight="700" font-size="5.4" fill="#1f2a24">500 m</text></g>`;
    layers.ui += `<g transform="translate(${r1(NORTH.x)},${r1(NORTH.y)})"><circle r="9.6" fill="#ffffff" fill-opacity="0.9" stroke="#1f2a24" stroke-width="0.7"/>` +
      `<path d="M0 -7 L3.4 3.6 L0 1.4 L-3.4 3.6 Z" fill="#1f2a24"/><text x="0" y="8.6" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="5.2" fill="#1f2a24">N</text></g>`;
    layers.ui += `<text x="${r1(W - 5)}" y="${r1(MAP_BOTTOM - 4)}" text-anchor="end" font-family="Manrope" font-weight="500" font-size="4.4" fill="#4a4a44" style="paint-order:stroke" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">${esc(attribution)}</text>`;

    const mainSvgOverlay = layers.rings + layers.zones + layers.water + layers.areas + layers.zoneLabels + layers.ringLabels + layers.leaders + layers.markers + layers.ui;

    // geographic window shown by the main map (for the overview inset)
    const nw = mainMap.unproject([0, MAP_TOP]);
    const se = mainMap.unproject([W, MAP_BOTTOM]);
    const mainWindow = { west: nw.lng, north: nw.lat, east: se.lng, south: se.lat };
    const movedCount = markers.filter((m) => !m.fixed && Math.hypot(m.x - m.x0, m.y - m.y0) > m.r * 0.9).length;
    mainMap.remove();
    main.host.remove();

    /* ----- overview inset ----- */
    const INSET = 44 * PX;
    const insetMpp = (options.insetHalfKm * 2000) / INSET;
    const insetZoom = Math.log2((78271.51696 * Math.cos(rad(hotel.lat))) / insetMpp);
    const inset = await renderMap({ kind: 'inset', width: INSET, height: INSET, pixelRatio: 6, center: [hotel.lng, hotel.lat], zoom: insetZoom });
    const im = inset.map;
    let isvg = '';
    const ihp = im.project([hotel.lng, hotel.lat]);
    isvg += `<path d="${pathOf(ringPoints(im, hotel.lat, hotel.lng, radii.orange, 120))}" fill="rgba(234,88,12,0.06)" stroke="${ZONE.orange}" stroke-width="1.5" stroke-dasharray="4.5 2.6"/>`;
    isvg += `<path d="${pathOf(ringPoints(im, hotel.lat, hotel.lng, radii.green, 90))}" fill="rgba(22,163,74,0.25)" stroke="${ZONE.verte}" stroke-width="1.2"/>`;
    for (const z of data.zones.filter((x) => x.kind === 'eviter' || x.kind === 'prudence')) {
      const c = zoneCenter(z);
      const q = im.project([c.lng, c.lat]);
      const rp = Math.max(z.radius / mpp(im, c.lat), 2.4);
      isvg += `<circle cx="${r1(q.x)}" cy="${r1(q.y)}" r="${r1(rp)}" fill="${ZONE[z.kind]}" fill-opacity="0.55" stroke="${ZONE[z.kind]}" stroke-width="0.8"/>`;
    }
    const wnw = im.project([mainWindow.west, mainWindow.north]);
    const wse = im.project([mainWindow.east, mainWindow.south]);
    isvg += `<rect x="${r1(wnw.x)}" y="${r1(wnw.y)}" width="${r1(wse.x - wnw.x)}" height="${r1(wse.y - wnw.y)}" fill="rgba(15,50,37,0.06)" stroke="#0f3225" stroke-width="1.1"/>`;
    isvg += `<circle cx="${r1(ihp.x)}" cy="${r1(ihp.y)}" r="3.4" fill="#0f3225" stroke="#ffffff" stroke-width="1.2"/>`;
    const far = numbered.filter((p) => p.zone !== 'verte');
    const farItems = far.map((p) => { const q = im.project([p.lng, p.lat]); return { ref: p, x0: q.x, y0: q.y, r: 5.4 }; });
    relax(farItems, { x0: 2, x1: INSET - 2, y0: 2, y1: INSET - 2 });
    const iscene = makeScene({ x0: 1, x1: INSET - 1, y0: 1, y1: INSET - 1 });
    iscene.claim({ x0: ihp.x - 5, x1: ihp.x + 5, y0: ihp.y - 5, y1: ihp.y + 5 });
    iscene.claim({ x0: wnw.x - 1, x1: wnw.x + 1, y0: wnw.y, y1: wse.y });
    iscene.claim({ x0: wse.x - 1, x1: wse.x + 1, y0: wnw.y, y1: wse.y });
    iscene.claim({ x0: wnw.x, x1: wse.x, y0: wnw.y - 1, y1: wnw.y + 1 });
    iscene.claim({ x0: wnw.x, x1: wse.x, y0: wse.y - 1, y1: wse.y + 1 });
    let ilead = '';
    for (const m of farItems) {
      iscene.claim({ x0: m.x - m.r - 1, x1: m.x + m.r + 1, y0: m.y - m.r - 1, y1: m.y + m.r + 1 });
      if (Math.hypot(m.x - m.x0, m.y - m.y0) > m.r * 0.9) {
        ilead += `<line x1="${r1(m.x0)}" y1="${r1(m.y0)}" x2="${r1(m.x)}" y2="${r1(m.y)}" stroke="#2b2b2b" stroke-width="0.6"/><circle cx="${r1(m.x0)}" cy="${r1(m.y0)}" r="1.2" fill="#2b2b2b"/>`;
      }
    }
    const orangeTop = onRing(im, hotel.lat, hotel.lng, radii.orange, 205);
    iscene.claim({ x0: orangeTop.x - 10, x1: orangeTop.x + 10, y0: orangeTop.y - 5, y1: orangeTop.y + 5 });
    // a few district / water names so the overview can be read
    let ilabels = '';
    for (const [name, lat, lng] of FAR_AREAS) {
      const q = im.project([lng, lat]);
      const txt = upperTr(name);
      const w = measure(txt, 700, 5.2, 0.5) + 2;
      if (q.x < 2 || q.x > INSET - 2 || q.y < 2 || q.y > INSET - 2) continue;
      const spot = iscene.place(clamp(q.x, w / 2 + 2, INSET - w / 2 - 2), clamp(q.y, 6, INSET - 6), w, 7, 16, 3);
      if (spot) ilabels += haloText(txt, spot.cx, spot.cy, { size: 5.2, weight: 700, spacing: 0.5, fill: '#5d5d52', hw: 1.8, haloOpacity: 0.8 });
    }
    for (const [txt, lat, lng, rot] of [['BOSPHORE', 41.0330, 29.0140, -62], ['MARMARA', 40.9780, 28.9950, 0]]) {
      const q = im.project([lng, lat]);
      const w = measure(txt, 700, 5.2, 1) + 2;
      const bw = rot ? 8 : w;
      const bh = rot ? w : 8;
      const b = { x0: q.x - bw / 2, x1: q.x + bw / 2, y0: q.y - bh / 2, y1: q.y + bh / 2 };
      if (!iscene.free(b)) continue;
      iscene.claim(b);
      ilabels += haloText(txt, q.x, q.y, { size: 5.2, weight: 700, spacing: 1, fill: '#4a6f96', italic: true, hw: 1.4, halo: '#b7d4e8', haloOpacity: 0.6, rotate: rot });
    }
    isvg += ilabels + ilead;
    for (const m of farItems) {
      const stroke = m.ref.zone === 'staff' ? '#dc2626' : '#ffffff';
      isvg += `<circle cx="${r1(m.x)}" cy="${r1(m.y)}" r="${m.r}" fill="${m.ref.color}" stroke="${stroke}" stroke-width="${m.ref.zone === 'staff' ? 1.4 : 1}"/>` +
        `<text x="${r1(m.x)}" y="${r1(m.y + 0.4)}" text-anchor="middle" dominant-baseline="central" font-family="Manrope" font-weight="800" font-size="6.2" fill="#ffffff">${m.ref.n}</text>`;
    }
    isvg += `<g transform="translate(${r1(orangeTop.x)},${r1(orangeTop.y)})"><rect x="-9" y="-4.4" width="18" height="8.8" rx="4.4" fill="#ffffff" fill-opacity="0.92" stroke="${ZONE.orange}" stroke-width="0.7"/>` +
      `<text x="0" y="0.4" text-anchor="middle" dominant-baseline="central" font-family="Manrope" font-weight="800" font-size="5.2" fill="#c2410c">${radii.orange / 1000} km</text></g>`;
    const insetUrl = inset.url;
    im.remove();
    inset.host.remove();

    /* ----- HTML ----- */
    const catRows = data.categories
      .filter((c) => c.id !== 'pratique')
      .map((c) => `<div class="cat"><span class="dot" style="background:${c.color}"></span>${esc(c.label)}</div>`)
      .join('');
    const html = `
  <div class="flyer front">
    <img class="map-img" src="${main.url}" alt="">
    <svg class="overlay" viewBox="0 0 ${r1(W)} ${r1(H)}" xmlns="http://www.w3.org/2000/svg">${mainSvgOverlay}</svg>
    <div class="ribbon">
      <img src="/app/assets/brand/wordmark-light.png" alt="Ultimate Connect">
      <div class="title"><b>ISTANBUL</b><span>${esc(data.meta.trip)} · carte du groupe</span></div>
    </div>
    <div class="panel">
      <div class="inset-wrap">
        <div class="cap">Vue d’ensemble</div>
        <div class="inset"><img src="${insetUrl}" alt=""><svg viewBox="0 0 ${r1(INSET)} ${r1(INSET)}" xmlns="http://www.w3.org/2000/svg">${isvg}</svg></div>
      </div>
      <div class="legend">
        <div class="cap">Zones autour de l’hôtel</div>
        <div class="row"><span class="sw" style="border-color:${ZONE.verte};background:rgba(22,163,74,.2)"></span><span><b>Verte</b> · libre à pied, ${radii.green / 1000} km. Rues principales le soir.</span></div>
        <div class="row"><span class="sw dash" style="border-color:${ZONE.orange}"></span><span><b>Orange</b> · jusqu’à ${radii.orange / 1000} km, en transport, à 3 minimum, retour 22h. Au-delà : staff.</span></div>
        <div class="row"><span class="sw" style="border-color:${ZONE.eviter};background:rgba(220,38,38,.28)"></span><span><b>Rouge</b> · à éviter</span></div>
        <div class="row"><span class="sw" style="border-color:${ZONE.prudence};background:rgba(234,179,8,.35)"></span><span><b>Jaune</b> · prudence</span></div>
        <div class="row"><span class="sw dots"></span><span><b>Pointillés</b> · 500 m, 1 km, 1,5 km</span></div>
        <div class="cap cap2">Numéros = liste au dos</div>
        <div class="cats">${catRows}</div>
        <div class="sym"><i style="background:#475569">T</i>Tram T1<i style="background:#1d4ed8;margin-left:1.4mm">P</i>Police touristique</div>
      </div>
      <div class="rules">
        <div class="rt">Règles du groupe</div>
        <div class="rg">
          <div class="ri"><svg viewBox="0 0 24 24" fill="#8ed0aa"><circle cx="6" cy="8" r="3"/><circle cx="12" cy="6" r="3"/><circle cx="18" cy="8" r="3"/><path d="M1 20c0-3 2.5-5 5-5s5 2 5 5zM7 19c0-3 2.5-6 5-6s5 3 5 6zM13 20c0-3 2.5-5 5-5s5 2 5 5z"/></svg>3 minimum hors zone verte</div>
          <div class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="#8ed0aa" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>Retour à l’hôtel avant 22h00</div>
          <div class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="#8ed0aa" stroke-width="2.4"><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4"/><path d="M6 10v4M10 10v4" stroke-width="2"/></svg>Téléphone chargé</div>
          <div class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="#8ed0aa" stroke-width="2.4"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>Position en direct sur WhatsApp</div>
        </div>
      </div>
    </div>
  </div>`;
    return { html, scale, markers: markers.filter((m) => m.kind === 'num' || m.kind === 'sym'), moved: movedCount, offZones };
  }

  /* ---------------- text faces: shared helpers ---------------- */
  const NBSP = String.fromCharCode(160);
  // French typography: curly apostrophes, no line break before : ; ! ? »
  const typo = (s) =>
    String(s)
      .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
      .replace(/ ([:;!?»])/g, NBSP + '$1')
      .replace(/(«) /g, '$1' + NBSP);
  const T = (s) => esc(typo(s));

  const DOW = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const MON = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
  const dayInfo = (iso) => {
    const dt = new Date(iso + 'T12:00:00Z');
    return { dow: DOW[dt.getUTCDay()], d: dt.getUTCDate(), mon: MON[dt.getUTCMonth()] };
  };

  const ICONS = {
    plane: '<path fill="currentColor" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>',
    hotel: '<path fill="currentColor" d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>',
    school: '<path fill="currentColor" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>',
    boat: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M2.5 16.5 5 21h14l2.5-4.5z"/><path d="M5.5 16.5v-5l6.5-2.5 6.5 2.5v5"/><path d="M12 9V3.5h4"/></g>',
    sun: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></g>',
    help: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a3 3 0 1 1 4.6 2.5c-1 .7-1.8 1.2-1.8 2.6"/><path d="M12 17.6v.1"/></g>',
    suitcase: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="7.5" width="18" height="13" rx="2.2"/><path d="M9 7.5V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2v2.3"/><path d="M3 13.5h18"/></g>',
    coffee: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9.5h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.6a2.4 2.4 0 0 1 0 4.8H16"/><path d="M7.5 3.2c0 1.6 1.6 1.6 1.6 3.2M11.5 3.2c0 1.6 1.6 1.6 1.6 3.2"/></g>',
    clock: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></g>',
    mosque: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M5 21v-8a7 7 0 0 1 14 0v8"/><path d="M12 6V2.5"/><path d="M2.5 21h19"/><path d="M9.5 21v-3.5a2.5 2.5 0 0 1 5 0V21"/></g>',
  };
  const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS[name] || ICONS.sun}</svg>`;
  const pencil = '<svg viewBox="0 0 24 24" fill="none" stroke="#1f6b45" stroke-width="2.4" stroke-linejoin="round"><path d="M4 20l1-4L17 4l3 3L8 19z"/><path d="M14 7l3 3"/></svg>';
  const warnIcon = '<svg class="wi" viewBox="0 0 24 24"><path d="M12 3 2 21h20z" fill="#eab308" stroke="#92400e" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v5" stroke="#92400e" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18" r="1.3" fill="#92400e"/></svg>';

  /* ---------------- PROGRAMME: the official page, one per travel group ---------------- */
  // Two groups fly at different times: a line (or a free-time plan) with a `group` is only printed on that group's
  // flyer, a line without one is on every flyer. `group` = null prints everything (data without groups).
  const forGroup = (x, group) => group == null || x.group == null || x.group === group;
  const groupInfo = (group) => (group == null ? null : ((data.officialProgram && data.officialProgram.groups) || []).find((g) => g.id === group) || null);

  function buildProgrammeFace(group) {
    const op = data.officialProgram;
    if (!op) return '<div class="flyer prog"></div>';
    const who = groupInfo(group);
    // A flight is a boarding pass; under it the airline and the baggage, and under the day's last one the time-zone note.
    const flightHtml = (it, withLocalNote) => {
      const lines = [[it.airline, it.baggage].filter(Boolean).join(' · '), withLocalNote ? 'Heures locales · Istanbul = Alger + 2 h' : ''].filter(Boolean);
      return (
        `<div class="bp"><div class="bpc"><span class="cy">${T(it.from)}</span><b class="tt">${esc(it.dep)}</b></div>` +
        `<div class="bpm"><i></i>${icon('plane', 'pl')}<i></i></div>` +
        `<div class="bpc r"><span class="cy">${T(it.to)}</span><b class="tt">${esc(it.arr)}</b></div></div>` +
        (lines.length ? `<div class="bpn">${lines.map((l) => `<span>${T(l)}</span>`).join('')}</div>` : '')
      );
    };
    const days = op.days.map((d) => ({ ...d, items: d.items.filter((it) => forGroup(it, group)) }));
    const dayHtml = (day, i) => {
      const info = dayInfo(day.date);
      const withTime = day.items.some((it) => it.time);
      const lastFlight = day.items.reduce((last, it, idx) => (it.kind === 'flight' ? idx : last), -1);
      const items = day.items
        .map((it, idx) => {
          if (it.kind === 'flight') return flightHtml(it, idx === lastFlight);
          const fill = it.fill ? '<i class="fl"></i>' : '';
          const after = it.after ? ` <span class="af">${T(it.after)}</span>` : '';
          return `<div class="it${it.free ? ' free' : ''}">${withTime ? `<span class="tm">${T(it.time || '')}</span>` : ''}${icon(it.icon || 'sun')}` +
            `<span class="tx">${it.free ? '<em class="lb">Libre</em>' : ''}${T(it.text)}${fill}${after}</span></div>`;
        })
        .join('');
      const bk = day.breakfast ? `<span class="bkc">${icon('coffee')}</span>` : '';
      return `<section class="day ${day.kind}"><div class="date"><span class="dow">${info.dow}</span><span class="dn">${info.d}</span><span class="mon">${info.mon}</span></div>` +
        `<div class="body"><div class="dh"><span class="jn">Jour ${i + 1}</span><b class="dt">${T(day.title)}</b>${bk}</div>${items}</div></section>`;
    };
    // the legend only lists the kinds of day this flyer really has
    const kinds = new Set(days.map((d) => d.kind));
    const legend = [['travel', 'Voyage'], ['official', 'Programme du groupe'], ['libre', 'Temps libre'], ['tbd', 'À confirmer']]
      .filter(([k]) => kinds.has(k))
      .map(([k, l]) => `<span class="lg ${k}"><i></i>${l}</span>`)
      .join('');
    return `
  <div class="flyer prog">
    <div class="hero">
      <svg class="hbg" viewBox="0 0 95 37" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" stroke="#3f8f68" stroke-width="0.3" stroke-dasharray="0.7 1.3" opacity="0.8"><circle cx="76" cy="13" r="8"/><circle cx="76" cy="13" r="16"/><circle cx="76" cy="13" r="24"/></g>
        <path d="M95 0H82L69 37h13z" fill="#1f6b45" opacity="0.55"/><path d="M95 0H90L77 37h9z" fill="#2c7a52" opacity="0.5"/>
      </svg>
      <img class="hw" src="/app/assets/brand/wordmark-light.png" alt="Ultimate Connect">
      <span class="hk">Programme officiel</span>
      <div class="ht">ISTANBUL</div>
      <div class="hd">${esc(upperTr(data.meta.trip))}</div>
      <div class="hs">${T(op.tagline)}</div>
      ${who ? `<div class="hg"><b>${esc(who.name)}</b><span>${T(who.airline)}</span></div>` : ''}
    </div>
    <div class="bkb">${icon('coffee')}<b>Petit-déjeuner inclus</b><span>${T("à l'hôtel, chaque matin")}</span></div>
    <div class="days">${days.map(dayHtml).join('')}</div>
    <div class="pfoot"><div class="lgs">${legend}</div><div class="pr">${icon('clock')}${T("Retour à l'hôtel avant 22h00, chaque soir")}<span>·</span>${T('Profitez à fond !')}</div></div>
  </div>`;
  }

  /* ---------------- stop rows (free-time plans) ---------------- */
  const hotelText = (s) => {
    const l = s.label || '';
    if (/taxi/i.test(l)) return 'Retour en taxi à l’hôtel';
    if (/tram/i.test(l)) return 'Retour hôtel · tram T1';
    if (/staff/i.test(l)) return l;
    return 'Retour à l’hôtel';
  };
  const stopText = (s, place) => {
    if (s.short) return s.short;
    if (s.hotel) return hotelText(s);
    if (!s.label) return place ? place.short : (transportById[s.transport] || {}).name || '';
    const meal = s.label.match(/^(Déjeuner|Dîner)\s*[–-]\s*/);
    if (meal && place) return place.short;
    return s.label;
  };
  const stopHtml = (s, withTime) => {
    let badge;
    let place = null;
    if (s.hotel) badge = '<span class="num hotel">H</span>';
    else if (s.place) {
      place = byId[s.place] || practical.find((p) => p.id === s.place);
      badge = place && place.n
        ? `<span class="num" style="background:${place.color}">${place.n}</span>`
        : `<span class="num sq" style="background:${(place || {}).color || '#475569'}">${(place || {}).sym || '·'}</span>`;
    } else badge = '<span class="num dia"><i></i></span>';
    const note = s.note && s.note.length <= 28 ? `<span class="nt">${T(s.note)}</span>` : '';
    return `<div class="st"><span class="cb"></span>${withTime ? `<span class="tm">${s.time || ''}</span>` : ''}${badge}<span class="nm">${T(stopText(s, place))}${note}</span></div>`;
  };

  const bheadHtml = (title, sub) =>
    `<div class="bhead"><img src="/app/assets/brand/wordmark-dark.png" alt="Ultimate Connect"><div class="t"><b>${T(title)}</b><span>${T(sub)}</span></div></div>`;
  const notesHtml = '<div class="notes">Notes<i></i><i></i></div>';

  /* ---------------- FREE TIME: plans that fit the official hours ---------------- */
  function buildFreeFace(group) {
    const days = data.officialProgram ? data.officialProgram.days : [];
    const who = groupInfo(group);
    // only the plans made for this group's free slots (e.g. Thursday evening is free only for the group landing at 15:15)
    const planOf = (iso) => data.programs.filter((p) => p.day === iso && forGroup(p, group));
    const metaOf = (p) => `${p.mode.charAt(0).toLowerCase()}${p.mode.slice(1)} · ${p.zone === 'verte' ? 'zone verte' : 'zone orange · à 3 minimum'}`;
    // a warning that starts with « Groupe 2 : » is for that group only
    const warnGroup = (w) => { const m = /^Groupe (\d+)\b/.exec(w); return m ? Number(m[1]) : null; };
    const planHtml = (p, option) => {
      const withTime = p.stops.some((s) => s.time);
      const meta = metaOf(p);
      const warns = (p.warnings || []).filter((w) => w.length <= 74 && !/^Zone orange/.test(w) && forGroup({ group: warnGroup(w) ?? undefined }, group));
      const head = option
        ? `<div class="ph"><span class="pb">${esc(p.option || '')}</span><div class="pn"><div class="pt">${T(p.title)}</div><div class="pm">${T(meta)}</div></div></div>`
        : '';
      return `<div class="pl">${head}${warns.map((w) => `<div class="pw">${warnIcon}${T(w)}</div>`).join('')}<div class="stops">${p.stops.map((s) => stopHtml(s, withTime)).join('')}</div></div>`;
    };
    const dayHead = (day, title, sub) => {
      const info = dayInfo(day.date);
      return `<div class="dgh"><span class="dchip"><small>${info.dow}</small><b>${info.d}</b></span><div class="dgn"><div class="dgt">${T(title)}</div>${sub ? `<div class="dgs">${T(sub)}</div>` : ''}</div></div>`;
    };
    const groups = days
      .map((day) => {
        const plans = planOf(day.date);
        if (day.kind === 'tbd' && !plans.length) {
          return `<section class="dg tbd">${dayHead(day, 'À confirmer', 'notez ici le programme annoncé par le staff')}<div class="wl"><i></i><i></i></div></section>`;
        }
        if (!plans.length) return '';
        if (plans.length === 1) {
          const p = plans[0];
          return `<section class="dg">${dayHead(day, p.title, p.tagline.split(' · ').slice(1).join(' · ') + ' · ' + metaOf(p))}${planHtml(p, false)}</section>`;
        }
        return `<section class="dg">${dayHead(day, day.title, 'choisissez une option (ou mixez !)')}${plans.map((p) => planHtml(p, true)).join('')}</section>`;
      })
      .join('');
    return `
  <div class="flyer back roomy free">
    ${bheadHtml('TEMPS LIBRE', who ? `${who.name} · idées à cocher` : 'idées à cocher · heures calées sur le programme')}
    <div class="intro">${pencil}<span>${T("Entre les moments du programme officiel, voici de quoi remplir vos temps libres. Les heures tiennent compte des horaires du groupe : cochez au crayon !")}</span></div>
    <div class="groups">${groups}</div>
    <div class="nbox"><b>Notes</b><div class="nl">${'<i></i>'.repeat(24)}</div></div>
    <div class="foot">
      <div class="rr"><span>${T("Retour à l'hôtel avant 22h00")}</span><span>3 minimum hors zone verte</span><span>Téléphone chargé</span><span>Position en direct sur WhatsApp</span></div>
    </div>
  </div>`;
  }

  /* ---------------- GUIDE: suggestions, emergency, tips (back of the map) ---------------- */
  function buildInfoFace(withQr) {
    const priceOf = (p) => (p.price === 'Gratuit' ? 'gratuit' : p.price);
    const sugHtml = numbered
      .map((p) => `<div class="sg2"><span class="cb"></span><span class="num${p.zone === 'orange' ? ' zo' : p.zone === 'staff' ? ' zs' : ''}" style="background:${p.color}">${p.n}</span><span class="nm" data-fit>${T(p.short)}</span><span class="pr">${esc(priceOf(p))}</span></div>`)
      .join('');
    const staffHtml = data.emergency.staff
      .map((c) => `<span><u>${T(c.name)}</u>${c.phone ? ` ${esc(c.phone)}` : '<i></i>'}</span>`)
      .join('');
    const scamsHtml = ((data.flyer && data.flyer.scams) || []).map((s) => `<li><b>${T(s.title)}</b> ${T(s.text)}</li>`).join('');
    const tipsHtml = ((data.flyer && data.flyer.tips) || []).map((t) => `<li>${T(t)}</li>`).join('');
    const phrasesHtml = ((data.flyer && data.flyer.phrases) || []).map((x) => `<div><b>${T(x.tr)}</b>${T(x.fr)}</div>`).join('');
    const qrOn = withQr && qrSvg;
    return `
  <div class="flyer back roomy info">
    ${bheadHtml('ISTANBUL 2026', `${data.meta.trip} · guide de poche`)}

    <div class="urg">
      <div class="top">
        <div class="n112"><div class="n">112</div><div class="l">Urgence<br>en Turquie</div></div>
        <div class="taxi"><div class="k">Taxi · montrez ceci</div><div class="tr">${T(data.emergency.taxiPhraseTurkish)}</div><div class="ad">${T(hotel.name)}<br>${T(hotel.address)}</div></div>
      </div>
      <div class="staff"><u>STAFF ☎</u>${staffHtml}</div>
    </div>

    <div><h2>${pencil}Nos suggestions · cochez ce que vous avez fait</h2><div class="sug2">${sugHtml}</div>
      <div class="keynote"><span>Mêmes numéros et couleurs que la carte.</span><span class="k"><i class="zo"></i>zone orange</span><span class="k"><i class="zs"></i>avec le staff</span></div></div>

    <div><h2>${warnIcon}Arnaques à éviter</h2><ul class="scams">${scamsHtml}</ul></div>

    <div><h2>Bon à savoir</h2><ul class="tips">${tipsHtml}</ul></div>

    <div><h2>Quelques mots de turc</h2><div class="phr">${phrasesHtml}</div></div>

    <div><h2>À remplir</h2><div class="fillbox"><div class="row">Ma chambre n°<i class="s"></i>Mon étage<i class="s"></i></div><div class="row">Mon groupe de sortie (3 minimum) :<i></i><i></i><i></i></div></div></div>

    <div class="foot">
      ${qrOn ? `<div class="qr">${qrSvg}</div>` : ''}
      <div class="tx"><b>L’appli Ultimate Connect</b><span>Carte interactive, programmes, chat du groupe et alertes du staff.${qrOn ? ' Scannez pour l’ouvrir.' : ''}</span></div>
      ${notesHtml}
    </div>
  </div>`;
  }

  const front = await buildFront();

  /* ---------------- pages ---------------- */
  // Card 1 (the programme) exists once per travel group when the data declares `officialProgram.groups`
  // ("1-programme-groupe1", "1-programme-groupe2"), otherwise once ("1-programme"). Card 2 (the map) is the same for all.
  const declaredGroups = ((data.officialProgram && data.officialProgram.groups) || []).map((g) => g.id);
  const programmeCards = declaredGroups.length
    ? declaredGroups.map((g) => ({ id: `1-programme-groupe${g}`, group: g, suffix: `-groupe${g}` }))
    : [{ id: '1-programme', group: null, suffix: '' }];
  const faces = { '2-carte': { front: () => front.html, back: (qr) => buildInfoFace(qr) } };
  for (const c of programmeCards) {
    const programmeHtml = buildProgrammeFace(c.group);
    const freeHtml = buildFreeFace(c.group);
    faces[c.id] = { front: () => programmeHtml, back: () => freeHtml };
  }
  const firstCard = programmeCards[0].id;
  const stage = document.getElementById('stage');
  const cropMarks = () => {
    const xs = [6, 101, 196, 291];
    const ys = [5, 205];
    let h = '';
    for (const x of xs) {
      h += `<div class="crop v" style="left:${x - 0.09}mm; top:0.8mm"></div><div class="crop v" style="left:${x - 0.09}mm; top:205.8mm"></div>`;
    }
    for (const y of ys) {
      h += `<div class="crop h" style="top:${y - 0.09}mm; left:0.8mm"></div><div class="crop h" style="top:${y - 0.09}mm; left:292.8mm"></div>`;
    }
    return h;
  };
  // mode: 'single' (one flyer per page) or 'sheet' (3 per A4); card: '1-programme[-groupeN]' | '2-carte'; side: 'front' | 'back' | undefined (both)
  window.__setMode = (mode, card, side, qr) => {
    document.body.className = 'mode-' + mode;
    const pageCss = mode === 'sheet' ? '@page { size: 297mm 210mm; margin: 0; }' : '@page { size: 95mm 200mm; margin: 0; }';
    document.getElementById('page-css').textContent = pageCss;
    const useQr = qr === undefined ? options.qr : qr;
    const c = faces[card];
    const sides = side ? [c[side](useQr)] : [c.front(useQr), c.back(useQr)];
    if (mode === 'single') stage.innerHTML = sides.join('');
    else {
      stage.innerHTML = sides
        .map((html) => `<div class="sheet">${html}${html}${html}${cropMarks()}<div class="sheet-note">${esc(options.sheetNote)}</div></div>`)
        .join('');
    }
  };
  window.__setMode('single', firstCard, 'front');
  window.__cards = programmeCards.map((c) => c.id).concat('2-carte');

  await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  await document.fonts.ready;

  // does each text face fit? (negative = free space left, in mm)
  const checkFace = (card, side, qr) => {
    window.__setMode('single', card, side, qr);
    const el = document.querySelector('.flyer');
    const px = el.scrollHeight - el.clientHeight;
    const foot = el.querySelector('.foot, .pfoot');
    const prev = foot && foot.previousElementSibling;
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
    // a notes box takes whatever room is left (at least 10 mm): the spare room is what it has beyond that minimum
    const nbox = el.querySelector('.nbox');
    const spare = nbox
      ? nbox.getBoundingClientRect().height / PX - 10
      : foot && prev ? (foot.getBoundingClientRect().top - prev.getBoundingClientRect().bottom - gap) / PX : 0;
    const clipped = [...el.querySelectorAll('[data-fit]')].filter((n) => n.scrollWidth > n.clientWidth + 0.5).map((n) => n.textContent);
    return { mm: r1(px > 0 ? px / PX : -spare), clipped };
  };
  const checks = {};
  for (const c of programmeCards) {
    checks[`programme${c.suffix}`] = checkFace(c.id, 'front');
    checks[`libre${c.suffix}`] = checkFace(c.id, 'back');
  }
  checks.guide = checkFace('2-carte', 'back', false);
  checks['guide-qr'] = qrSvg ? checkFace('2-carte', 'back', true) : null;
  window.__setMode('single', firstCard, 'front');
  window.__report = {
    scale: front.scale,
    markers: front.markers.length,
    moved: front.moved || 0,
    offZones: front.offZones.map((z) => z.id),
    faces: Object.fromEntries(Object.entries(checks).filter(([, v]) => v).map(([k, v]) => [k, v.mm])),
    clipped: [...new Set(Object.values(checks).filter(Boolean).flatMap((v) => v.clipped))],
  };
  log('report', JSON.stringify(window.__report));
  window.__ready = true;
})().catch((e) => {
  console.log('[flyer] FAILED', e && e.stack ? e.stack : e);
  window.__error = String(e && e.message ? e.message : e);
  window.__ready = true;
});
