import raw from './istanbul-data.json';
import { zoneCenter } from './geo';
import type {
  Category,
  IstanbulData,
  LatLng,
  Place,
  Program,
  ProgramStop,
  TransportStop,
  Zone,
  ZoneKind,
} from './types';

/** The whole content of the feature. Edit istanbul-data.json, not this file. */
export const istanbul = raw as unknown as IstanbulData;

const placeById = new Map<string, Place>(istanbul.places.map((p) => [p.id, p]));
const transportById = new Map<string, TransportStop>(istanbul.transportStops.map((t) => [t.id, t]));
const categoryById = new Map<string, Category>(istanbul.categories.map((c) => [c.id, c]));

export const getPlace = (id: string) => placeById.get(id);
export const getCategory = (id: string) => categoryById.get(id);

/** Colors used for the zones (map circles, banners, legend). */
export const ZONE_STYLE: Record<
  ZoneKind,
  { label: string; color: string; fillOpacity: number; dashed?: boolean }
> = {
  verte: { label: 'Zone verte', color: '#16A34A', fillOpacity: 0.1 },
  orange: { label: 'Zone orange', color: '#EA580C', fillOpacity: 0, dashed: true },
  eviter: { label: 'À éviter', color: '#DC2626', fillOpacity: 0.28 },
  prudence: { label: 'Prudence', color: '#EAB308', fillOpacity: 0.3 },
};

export const ACCESS_LABEL: Record<Place['zone'], { label: string; color: string }> = {
  verte: { label: 'Zone verte · à pied', color: '#16A34A' },
  orange: { label: 'Zone orange · en transport, en groupe', color: '#EA580C' },
  staff: { label: 'Uniquement avec le staff', color: '#DC2626' },
};

export interface ResolvedStop extends LatLng {
  key: string;
  time: string;
  title: string;
  note?: string;
  /** Set when the stop is one of the listed places (opens its details). */
  placeId?: string;
  kind: 'place' | 'transport' | 'hotel';
}

/** Turns a program stop into a point with a title, whatever it refers to. */
export function resolveStop(stop: ProgramStop, index: number): ResolvedStop | null {
  const key = `${index}`;
  if (stop.hotel) {
    return {
      key,
      time: stop.time,
      title: stop.label ?? "Retour à l'hôtel",
      note: stop.note,
      lat: istanbul.hotel.lat,
      lng: istanbul.hotel.lng,
      kind: 'hotel',
    };
  }
  if (stop.place) {
    const p = placeById.get(stop.place);
    if (!p) return null;
    return {
      key,
      time: stop.time,
      title: stop.label ?? p.name,
      note: stop.note,
      lat: p.lat,
      lng: p.lng,
      placeId: p.id,
      kind: 'place',
    };
  }
  if (stop.transport) {
    const t = transportById.get(stop.transport);
    if (!t) return null;
    return { key, time: stop.time, title: stop.label ?? t.name, note: stop.note, lat: t.lat, lng: t.lng, kind: 'transport' };
  }
  return null;
}

export function resolveProgram(program: Program): ResolvedStop[] {
  return program.stops
    .map((s, i) => resolveStop(s, i))
    .filter((s): s is ResolvedStop => s !== null);
}

export interface ResolvedZone extends Zone {
  centerLat: number;
  centerLng: number;
}

export const resolvedZones: ResolvedZone[] = istanbul.zones.map((z) => {
  const c = zoneCenter(z, istanbul.hotel);
  return { ...z, centerLat: c.lat, centerLng: c.lng };
});
