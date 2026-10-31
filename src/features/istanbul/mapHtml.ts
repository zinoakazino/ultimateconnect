// The map "engine": one self-contained HTML page (Leaflet + OpenStreetMap tiles) that is shown
// inside a WebView on phones and an iframe on the web. The React Native side sends it a full
// MapState (see mapProtocol.ts) and receives taps back. No API key and no CDN: Leaflet is
// embedded (leafletBundle.ts), only the map tiles need a connection.
import { LEAFLET_CSS, LEAFLET_JS } from './leafletBundle';

/**
 * Origin the page claims to be served from. It is only used so that OpenStreetMap's tile servers
 * receive a proper Referer (their usage policy asks for one) — nothing is actually fetched from it.
 */
export const MAP_BASE_URL = 'https://ultimate-connect-87142.web.app/';

const PAGE_CSS = String.raw`
html, body, #map { height: 100%; margin: 0; padding: 0; }
body { background: #e9efe9; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  -webkit-tap-highlight-color: transparent; overflow: hidden; }
body.dark { background: #0b140f; }
body.dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.8); }
body.dark .leaflet-container { background: #0b140f; }
.leaflet-container { font: inherit; }
.leaflet-control-attribution { font-size: 10px; background: rgba(255,255,255,0.75); }
body.dark .leaflet-control-attribution { background: rgba(20,32,25,0.8); color: #9fb3a7; }
body.dark .leaflet-control-attribution a { color: #8ec7a5; }
.leaflet-control-zoom { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important; }
.leaflet-control-zoom a { width: 38px !important; height: 38px !important; line-height: 38px !important; font-size: 20px !important; }
.uc-icon { background: none; border: none; }
.pin { width: 34px; height: 34px; margin: 5px; border-radius: 50%; border: 3px solid #fff;
  box-shadow: 0 2px 7px rgba(0,0,0,0.38); display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; transition: transform 0.15s ease; }
.pin span { font-size: 16px; line-height: 1; font-family: "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif; }
.pin.sel { transform: scale(1.3); box-shadow: 0 0 0 4px rgba(31,107,69,0.55), 0 3px 10px rgba(0,0,0,0.45); }
.pin.dim { opacity: 0.45; }
/* Smaller pins when zoomed out, so the crowded centre stays readable. */
body[data-zoom="far"] .pin { transform: scale(0.52); }
body[data-zoom="mid"] .pin { transform: scale(0.78); }
body[data-zoom="far"] .pin.sel { transform: scale(0.95); }
body[data-zoom="mid"] .pin.sel { transform: scale(1.15); }
.hotel { width: 44px; height: 44px; margin: 5px; border-radius: 50%; background: #0f3225; border: 3px solid #fff;
  box-shadow: 0 0 0 3px #16a34a, 0 3px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; }
.hotel span { font-size: 21px; line-height: 1; }
.hotel-label { position: absolute; left: 50%; top: 52px; transform: translateX(-50%); background: #0f3225; color: #fff;
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 9px; white-space: nowrap; border: 1.5px solid #fff; }
.num { width: 28px; height: 28px; margin: 1px; border-radius: 50%; background: #1f6b45; color: #fff; border: 2.5px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4); font-weight: 800; font-size: 14px; display: flex; align-items: center;
  justify-content: center; box-sizing: border-box; }
.num.transport { background: #0891b2; }
.num.hotel { background: #0f3225; }
.me { width: 18px; height: 18px; margin: 2px; border-radius: 50%; background: #2563eb; border: 3px solid #fff;
  box-shadow: 0 0 0 0 rgba(37,99,235,0.6); animation: ucpulse 2s infinite; box-sizing: border-box; }
@keyframes ucpulse { 0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.55); } 70% { box-shadow: 0 0 0 16px rgba(37,99,235,0); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); } }
.person { width: 30px; height: 30px; margin: 2px; border-radius: 50%; border: 2.5px solid #fff; color: #fff; font-weight: 800;
  font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  box-sizing: border-box; }
.zlabel { width: 120px; text-align: center; font-size: 11px; font-weight: 800; line-height: 1.1;
  text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 5px #fff; pointer-events: none; }
.zlabel.eviter { color: #b91c1c; }
.zlabel.prudence { color: #92400e; }
body.dark .zlabel { text-shadow: 0 0 3px #000, 0 0 3px #000, 0 0 5px #000; }
body.dark .zlabel.eviter { color: #fca5a5; }
body.dark .zlabel.prudence { color: #fcd34d; }
`;

// Plain ES5 on purpose: it has to run in any Android System WebView, old or new.
const ENGINE_JS = String.raw`
(function () {
  'use strict';
  var map = null;
  var groups = {};
  var signatures = {};
  var fitNonce = null;
  var pinsById = {};
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  function post(message) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ __ucMap: message }, '*');
      }
    } catch (e) { /* nothing useful to do */ }
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function changed(name, value) {
    var s = JSON.stringify(value);
    if (signatures[name] === s) { return false; }
    signatures[name] = s;
    return true;
  }

  function initials(name) {
    var parts = String(name).replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean);
    var s = (parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '');
    return s.toUpperCase();
  }

  function updateZoomClass() {
    var z = map.getZoom();
    document.body.setAttribute('data-zoom', z < 13.4 ? 'far' : z < 14.6 ? 'mid' : 'near');
  }

  function boot() {
    if (typeof L === 'undefined') { post({ type: 'error', message: 'Leaflet introuvable' }); return; }
    map = L.map('map', { zoomControl: false, minZoom: 9, maxZoom: 18, zoomSnap: 0.5, tap: true });
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    map.attributionControl.setPosition('bottomleft');
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    ['zones', 'hit', 'route', 'pins', 'hotel', 'people', 'user'].forEach(function (name) {
      groups[name] = L.layerGroup().addTo(map);
    });
    map.on('click', function () { post({ type: 'mapTap' }); });
    map.on('zoomend', updateZoomClass);
    map.setView([41.0136, 28.9738], 13);
    updateZoomClass();
    window.addEventListener('resize', function () { if (map) { map.invalidateSize(); } });
    post({ type: 'ready' });
  }

  function renderZones(zones) {
    groups.zones.clearLayers();
    groups.hit.clearLayers();
    zones.forEach(function (z) {
      var big = z.kind === 'verte' || z.kind === 'orange';
      var circle = L.circle([z.lat, z.lng], {
        radius: z.radius, color: z.color, weight: big ? 2.5 : 2, fillColor: z.color,
        fillOpacity: z.fillOpacity, dashArray: z.dashed ? '10 8' : null, interactive: !big
      });
      circle.addTo(groups.zones);
      if (big) {
        // Big circles must not swallow every tap: only their edge is touchable.
        var ring = L.circle([z.lat, z.lng], {
          radius: z.radius, color: z.color, weight: 28, opacity: 0.001, fill: false,
          interactive: true, bubblingMouseEvents: false
        });
        ring.on('click', function () { post({ type: 'zoneTap', id: z.id }); });
        ring.addTo(groups.hit);
      } else {
        circle.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          post({ type: 'zoneTap', id: z.id });
        });
        L.marker([z.lat, z.lng], {
          icon: L.divIcon({
            className: 'uc-icon',
            html: '<div class="zlabel ' + esc(z.kind) + '">' + esc(z.name) + '</div>',
            iconSize: [120, 16], iconAnchor: [60, 8]
          }),
          interactive: false, keyboard: false
        }).addTo(groups.zones);
      }
    });
  }

  function renderPins(pins, selectedId, dim) {
    groups.pins.clearLayers();
    pinsById = {};
    pins.forEach(function (p) {
      var selected = p.id === selectedId;
      var html = '<div class="pin' + (selected ? ' sel' : '') + (dim ? ' dim' : '') +
        '" style="background:' + esc(p.color) + '"><span>' + esc(p.icon) + '</span></div>';
      var marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: 'uc-icon', html: html, iconSize: [44, 44], iconAnchor: [22, 22] }),
        zIndexOffset: selected ? 800 : 0, title: p.name, alt: p.name
      });
      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        post({ type: 'pinTap', id: p.id });
      });
      marker.addTo(groups.pins);
      pinsById[p.id] = p;
    });
  }

  function renderRoute(route) {
    groups.route.clearLayers();
    if (!route || !route.length) { return; }
    var points = route.map(function (s) { return [s.lat, s.lng]; });
    L.polyline(points, { color: '#1f6b45', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(groups.route);
    L.polyline(points, { color: '#ffffff', weight: 2, opacity: 0.9, dashArray: '1 10', lineCap: 'round', interactive: false }).addTo(groups.route);
    route.forEach(function (s) {
      var icon = L.divIcon({
        className: 'uc-icon', html: '<div class="num ' + esc(s.kind) + '">' + esc(s.n) + '</div>',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
      var marker = L.marker([s.lat, s.lng], { icon: icon, zIndexOffset: 700, title: s.title });
      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        if (s.placeId) { post({ type: 'stopTap', placeId: s.placeId }); }
      });
      marker.addTo(groups.route);
    });
  }

  function renderHotel(h) {
    groups.hotel.clearLayers();
    var icon = L.divIcon({
      className: 'uc-icon',
      html: '<div class="hotel"><span>&#127976;</span></div><div class="hotel-label">Hôtel</div>',
      iconSize: [54, 54], iconAnchor: [27, 27]
    });
    var marker = L.marker([h.lat, h.lng], { icon: icon, zIndexOffset: 1000, title: h.name });
    marker.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      post({ type: 'pinTap', id: 'hotel' });
    });
    marker.addTo(groups.hotel);
  }

  function renderUser(u) {
    groups.user.clearLayers();
    if (!u) { return; }
    if (u.accuracy && u.accuracy < 2000) {
      L.circle([u.lat, u.lng], {
        radius: u.accuracy, color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.12, interactive: false
      }).addTo(groups.user);
    }
    L.marker([u.lat, u.lng], {
      icon: L.divIcon({ className: 'uc-icon', html: '<div class="me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      zIndexOffset: 900, interactive: false, keyboard: false
    }).addTo(groups.user);
  }

  function renderPeople(list) {
    groups.people.clearLayers();
    list.forEach(function (p) {
      var icon = L.divIcon({
        className: 'uc-icon',
        html: '<div class="person" style="background:' + esc(p.color) + '">' + esc(initials(p.name)) + '</div>',
        iconSize: [34, 34], iconAnchor: [17, 17]
      });
      var marker = L.marker([p.lat, p.lng], { icon: icon, zIndexOffset: 850, title: p.name });
      marker.bindTooltip(esc(p.name) + (p.detail ? ' · ' + esc(p.detail) : ''), { direction: 'top', offset: [0, -14] });
      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        post({ type: 'personTap', id: p.id });
      });
      marker.addTo(groups.people);
    });
  }

  function zoneOf(state, kind) {
    for (var i = 0; i < state.zones.length; i++) {
      if (state.zones[i].kind === kind) { return state.zones[i]; }
    }
    return null;
  }

  function circleBounds(z) {
    return L.circle([z.lat, z.lng], { radius: z.radius }).getBounds();
  }

  function applyFit(state) {
    var f = state.fit;
    if (!f || f.nonce === fitNonce) { return; }
    fitNonce = f.nonce;
    var target = f.target;
    var z;
    // Leaves room for the legend / banners at the top and the buttons at the bottom.
    var FIT = {
      paddingTopLeft: [24, f.padTop || 90],
      paddingBottomRight: [60, f.padBottom || 110],
      animate: true
    };
    if (target === 'hotel') {
      map.setView([state.hotel.lat, state.hotel.lng], 15, { animate: true });
    } else if (target === 'orange' && (z = zoneOf(state, 'orange'))) {
      map.fitBounds(circleBounds(z), FIT);
    } else if (target === 'route' && state.route && state.route.length) {
      map.fitBounds(L.latLngBounds(state.route.map(function (s) { return [s.lat, s.lng]; })), FIT);
    } else if (target === 'user' && state.user) {
      map.fitBounds(L.latLngBounds([[state.user.lat, state.user.lng], [state.hotel.lat, state.hotel.lng]]), FIT);
    } else if (target === 'place' && state.focusId && pinsById[state.focusId]) {
      var p = pinsById[state.focusId];
      map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15), { animate: true });
    } else if ((z = zoneOf(state, 'verte'))) {
      map.fitBounds(circleBounds(z), FIT);
    }
  }

  function receive(state) {
    if (!map || !state) { return; }
    document.body.className = state.dark ? 'dark' : '';
    if (changed('zones', state.zones)) { renderZones(state.zones); }
    var dim = !!(state.route && state.route.length);
    if (changed('pins', [state.pins, state.selectedId, dim])) { renderPins(state.pins, state.selectedId, dim); }
    if (changed('route', state.route)) { renderRoute(state.route); }
    if (changed('hotel', state.hotel)) { renderHotel(state.hotel); }
    if (changed('user', state.user)) { renderUser(state.user); }
    if (changed('people', state.people)) { renderPeople(state.people); }
    applyFit(state);
  }

  window.__ucReceive = receive;
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    if (d && d.__uc) { receive(d.__uc); }
  });
  document.addEventListener('message', function (e) {
    try { var d = JSON.parse(e.data); if (d && d.__uc) { receive(d.__uc); } } catch (err) { /* ignore */ }
  });

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
`;

let cached: string | null = null;

/** The full HTML document of the map (built once). */
export function buildMapHtml(): string {
  if (!cached) {
    cached =
      '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">' +
      '<base target="_blank">' +
      `<style>${LEAFLET_CSS}</style><style>${PAGE_CSS}</style></head>` +
      `<body><div id="map"></div><script>${LEAFLET_JS}</script><script>${ENGINE_JS}</script></body></html>`;
  }
  return cached;
}

// U+2028 / U+2029 are valid in JSON but not in JavaScript string literals of older engines,
// so they are escaped before the state is injected into the page.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const BACKSLASH = String.fromCharCode(92);

/** JavaScript that hands a state to the page (used by the WebView wrapper). */
export function injectStateScript(state: unknown): string {
  const json = JSON.stringify(state)
    .split(LINE_SEPARATOR)
    .join(BACKSLASH + 'u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join(BACKSLASH + 'u2029');
  return `window.__ucReceive && window.__ucReceive(${json}); true;`;
}
