// Pure geometry for the Istanbul map: distances, which zone a point is in, and the message to
// show for "Où suis-je ?". No React / React Native imports, so it can be tested with plain Node.
import type { Hotel, IstanbulData, LatLng, PlaceZone, SafeAnchor, Zone } from './types';

const EARTH_RADIUS_M = 6371000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function zoneCenter(zone: Zone, hotel: Hotel): LatLng {
  if (zone.center === 'hotel' || zone.lat === undefined || zone.lng === undefined) {
    return { lat: hotel.lat, lng: hotel.lng };
  }
  return { lat: zone.lat, lng: zone.lng };
}

export function isInside(point: LatLng, zone: Zone, hotel: Hotel): boolean {
  return distanceMeters(point, zoneCenter(zone, hotel)) <= zone.radius;
}

/** Radii of the two big circles, read from the data (so moving them in the file is enough). */
export function circleRadii(data: IstanbulData): { green: number; orange: number } {
  const green = data.zones.find((z) => z.kind === 'verte')?.radius ?? 2000;
  const orange = data.zones.find((z) => z.kind === 'orange')?.radius ?? 6000;
  return { green, orange };
}

/** Which of the three access zones a point of the city falls in, from its distance to the hotel. */
export function accessZoneOf(point: LatLng, data: IstanbulData): PlaceZone {
  const { green, orange } = circleRadii(data);
  const d = distanceMeters(point, data.hotel);
  if (d <= green) return 'verte';
  if (d <= orange) return 'orange';
  return 'staff';
}

export type AlertLevel = 'ok' | 'amber' | 'red';

export interface LocationNotice {
  level: AlertLevel;
  /** Which message this is: the screen says it in the app's language (`map.notice.<code>`); title / text below stay as the French wording. */
  code: 'avoid' | 'outside' | 'caution' | 'orange' | 'ok';
  params?: Record<string, string>;
  /** Short headline. */
  title: string;
  /** What to do. */
  text: string;
}

export interface LocationStatus {
  distanceToHotel: number;
  band: PlaceZone;
  /** Zones (red and amber ones) the position is inside. */
  insideZones: Zone[];
  /** The nearest comfortable area to head back to, if the user is somewhere to avoid. */
  anchor: { name: string; distance: number } | null;
  /** Most severe first. Never empty. */
  notices: LocationNotice[];
}

function nearestAnchor(point: LatLng, anchors: SafeAnchor[], data: IstanbulData) {
  const avoid = data.zones.filter((z) => z.kind === 'eviter');
  let best: { name: string; distance: number } | null = null;
  for (const a of anchors) {
    const at = a.hotel ? { lat: data.hotel.lat, lng: data.hotel.lng } : { lat: a.lat, lng: a.lng };
    if (avoid.some((z) => isInside(at, z, data.hotel))) continue;
    const d = distanceMeters(point, at);
    if (!best || d < best.distance) best = { name: a.name, distance: d };
  }
  return best;
}

/** Everything the "Où suis-je ?" banner needs, from a GPS position. */
export function locate(point: LatLng, data: IstanbulData): LocationStatus {
  const { green, orange } = circleRadii(data);
  const distanceToHotel = distanceMeters(point, data.hotel);
  const band: PlaceZone = distanceToHotel <= green ? 'verte' : distanceToHotel <= orange ? 'orange' : 'staff';
  const insideZones = data.zones.filter(
    (z) => (z.kind === 'eviter' || z.kind === 'prudence') && isInside(point, z, data.hotel)
  );
  const avoid = insideZones.filter((z) => z.kind === 'eviter');
  const caution = insideZones.filter((z) => z.kind === 'prudence');
  const anchor = avoid.length ? nearestAnchor(point, data.safeAnchors, data) : null;

  const notices: LocationNotice[] = [];

  if (avoid.length) {
    const names = avoid.map((z) => z.name).join(', ');
    const messages = avoid.map((z) => z.message).join(' ');
    notices.push({
      level: 'red',
      code: 'avoid',
      params: { names, anchor: anchor ? anchor.name : '', messages },
      title: `Vous êtes dans une zone à éviter (${names})`,
      text: `Revenez vers ${anchor ? anchor.name : "l'hôtel"} ou prenez un taxi. ` + messages,
    });
  }
  if (band === 'staff') {
    notices.push({
      level: 'red',
      code: 'outside',
      title: 'Vous êtes hors de la zone autorisée',
      text: 'Contactez le staff.',
    });
  }
  caution.forEach((z) =>
    notices.push({ level: 'amber', code: 'caution', params: { name: z.name, message: z.message }, title: `Prudence : ${z.name}`, text: z.message })
  );
  if (band === 'orange') {
    notices.push({
      level: 'amber',
      code: 'orange',
      title: 'Vous êtes hors de la zone verte',
      text: 'Ici : uniquement en transport (tram, ferry, métro), en groupe de 3 minimum, retour à l’hôtel avant 22h.',
    });
  }
  if (!notices.length) {
    notices.push({
      level: 'ok',
      code: 'ok',
      title: 'Vous êtes dans la zone verte',
      text: 'Vous pouvez circuler librement à pied. Restez sur les rues principales le soir.',
    });
  }

  const rank: Record<AlertLevel, number> = { red: 0, amber: 1, ok: 2 };
  notices.sort((a, b) => rank[a.level] - rank[b.level]);
  return { distanceToHotel, band, insideZones, anchor, notices };
}

/** "850 m" / "1,4 km". */
export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
