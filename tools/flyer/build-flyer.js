// Builds the printable Istanbul flyers from src/features/istanbul/istanbul-data.json.
//
// Double-sided cards, each printed 3 per A4 landscape sheet:
//   1-programme-groupe1, 1-programme-groupe2 : one per travel group (they fly at different times): front = that group's
//                  official programme with its own flights, back = free-time plans that fit its hours
//                  (without `officialProgram.groups` in the data: a single 1-programme card)
//   2-carte     : the same for everybody: front = the map, back = suggestions to tick, emergency, scams, tips,
//                  Turkish words (+ QR code)
//
//   npm run build            -> flyer/ : PDFs + preview images (card 2 also with a QR code to the app)
//   npm run build:noqr       -> same, without the QR variants
//   npm run build:faces      -> only the text faces, no map (a few seconds): handy while editing texts
//
// It starts a tiny local web server, opens flyer.html in headless Chrome (which draws the map with
// MapLibre + OpenFreeMap vector tiles, so it needs an Internet connection), and prints it to PDF.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const QRCode = require('qrcode');

const ROOT = __dirname;
const APP = path.resolve(ROOT, '..', '..');
const DATA_FILE = path.join(APP, 'src', 'features', 'istanbul', 'istanbul-data.json');
const OUT = path.join(APP, 'flyer');
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const args = process.argv.slice(2);
const facesOnly = args.includes('--faces-only') || args.includes('--back-only');
const withQrVariant = !args.includes('--no-qr');
const PX = 96 / 25.4;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.map': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The QR code as filled squares with a one-module white border. (The library's own SVG draws the modules as
// strokes, which Chrome prints as hairlines: unreadable on paper.)
function qrAsFilledSquares(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let d = '';
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!modules.get(y, x)) { x++; continue; }
      let len = 1;
      while (x + len < n && modules.get(y, x + len)) len++;
      d += `M${x} ${y}h${len}v1h-${len}z`;
      x += len;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#ffffff"/><path fill="#0f3225" d="${d}"/></svg>`;
}

async function main() {
  const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('Chrome ou Edge introuvable : installez Google Chrome.');

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // one programme card per travel group (flights differ), then the map card, which is the same for everybody
  const groups = (data.officialProgram && data.officialProgram.groups) || [];
  const CARDS = [
    ...(groups.length
      ? groups.map((g) => ({ id: `1-programme-groupe${g.id}`, front: 'programme', qr: false }))
      : [{ id: '1-programme', front: 'programme', qr: false }]),
    { id: '2-carte', front: 'carte', qr: true },
  ];
  const appUrl = (data.flyer && data.flyer.appUrl) || '';
  const qrSvg = withQrVariant && appUrl ? qrAsFilledSquares(appUrl) : '';
  const options = {
    qr: false,
    skipMaps: facesOnly,
    // west/south and east/north of the area the main map must show (it is fitted into the space
    // left between the title ribbon and the bottom panel)
    mainBounds: [[28.9525, 41.0035], [28.989, 41.0462]],
    // ground distance from the hotel to the edge of the overview inset, in km
    insetHalfKm: 8.6,
    sheetNote: 'Recto-verso : retourner sur le bord COURT · couper sur les repères',
  };
  const payload = JSON.stringify({ data, qrSvg, options });

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/flyer-data.json') { res.writeHead(200, { 'Content-Type': MIME['.json'] }); return res.end(payload); }
    let file;
    if (url === '/') file = path.join(ROOT, 'flyer.html');
    else if (url.startsWith('/app/')) file = path.join(APP, url.slice(5));
    else file = path.join(ROOT, url);
    const base = url.startsWith('/app/') ? APP : ROOT;
    if (!path.resolve(file).startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { const t = m.text(); if (t.startsWith('[flyer]')) console.log(t); });
    page.on('pageerror', (e) => console.log('[page error]', e.message));
    await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', { timeout: 240000 });
    const failure = await page.evaluate('window.__error || null');
    if (failure) throw new Error('La page du flyer a échoué : ' + failure);
    const report = await page.evaluate('window.__report');
    if (!facesOnly) {
      console.log('Carte : échelle ≈ 1:' + report.scale + ' · ' + report.markers + ' repères (' + report.moved + ' déplacés avec trait) · zones hors carte : ' + (report.offZones.join(', ') || 'aucune'));
    }
    const names = { guide: 'Guide (verso du flyer 2)', 'guide-qr': 'Guide avec QR (verso du flyer 2)' };
    const nameOf = (k) => {
      const m = /^(programme|libre)(?:-groupe(\d+))?$/.exec(k);
      if (!m) return names[k] || k;
      return (m[1] === 'programme' ? 'Programme (recto du flyer 1' : 'Temps libre (verso du flyer 1') + (m[2] ? ', groupe ' + m[2] : '') + ')';
    };
    for (const [k, mm] of Object.entries(report.faces)) {
      console.log(nameOf(k) + ' : ' + (mm > 0.3 ? '⚠ dépasse de ' + mm + ' mm' : 'tient (' + Math.abs(mm) + ' mm de marge)'));
    }
    if (report.clipped.length) console.log('⚠ Noms coupés dans la liste de suggestions : ' + report.clipped.join(', '));

    fs.mkdirSync(OUT, { recursive: true });
    if (!facesOnly) {
      // outputs of an older build must not linger next to the new ones
      for (const f of fs.readdirSync(OUT)) if (/\.(pdf|png)$/i.test(f)) fs.unlinkSync(path.join(OUT, f));
    }

    const fw = Math.ceil(95 * PX);
    const fh = Math.ceil(200 * PX);
    const shot = async (file, clip) => { await sleep(350); await page.screenshot({ path: path.join(OUT, file), clip }); };

    for (const card of CARDS) {
      const variants = [{ suffix: '', qr: false }];
      if (card.qr && qrSvg) variants.push({ suffix: '-avec-QR', qr: true });
      const sideName = (i) => (i === 0 ? 'recto' : 'verso');

      for (const v of variants) {
        // previews of one flyer at ~300 dpi
        await page.setViewport({ width: fw, height: fh, deviceScaleFactor: 3.125 });
        for (let i = 0; i < 2; i++) {
          if (facesOnly && card.front === 'carte' && i === 0) continue; // no map in this mode
          if (v.suffix && i === 0) continue; // the front has no QR: same file
          await page.evaluate(`window.__setMode('single', '${card.id}', '${i === 0 ? 'front' : 'back'}', ${v.qr})`);
          await page.evaluate('document.fonts.ready');
          await shot(`apercu-${card.id}-${sideName(i)}${v.suffix}.png`, { x: 0, y: 0, width: 95 * PX, height: 200 * PX });
        }
        if (facesOnly) continue;

        // single flyer PDF: 2 pages of 95 x 200 mm (front, back)
        await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 1 });
        await page.evaluate(`window.__setMode('single', '${card.id}', undefined, ${v.qr})`);
        await sleep(400);
        await page.pdf({ path: path.join(OUT, `${card.id}-seul${v.suffix}.pdf`), preferCSSPageSize: true, printBackground: true });

        // A4 sheet PDF: 3 flyers per sheet, 2 pages (front sheet, back sheet)
        await page.evaluate(`window.__setMode('sheet', '${card.id}', undefined, ${v.qr})`);
        await sleep(600);
        await page.pdf({ path: path.join(OUT, `${card.id}-A4-3-par-feuille${v.suffix}.pdf`), preferCSSPageSize: true, printBackground: true });

        // preview of the sheets
        await page.setViewport({ width: Math.ceil(297 * PX), height: Math.ceil(210 * PX), deviceScaleFactor: 2 });
        for (let i = 0; i < 2; i++) {
          if (v.suffix && i === 0) continue;
          await page.evaluate(`window.__setMode('sheet', '${card.id}', '${i === 0 ? 'front' : 'back'}', ${v.qr})`);
          await shot(`apercu-feuille-${card.id}-${sideName(i)}${v.suffix}.png`);
        }
      }
    }
    console.log('OK → ' + OUT);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
