import { useTranslation } from 'react-i18next';
import raw from './istanbul-data.json';
import arRaw from './istanbul-data.ar.json';
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

/** The whole content of the feature, in French. Edit istanbul-data.json (and istanbul-data.ar.json for Arabic), not this file. */
export const istanbul = raw as unknown as IstanbulData;

export type MapLanguage = 'fr' | 'ar';

/** istanbul-data.ar.json: the Arabic texts, keyed by the id of what they translate. Anything missing falls back to French. */
interface ArabicOverlay {
  meta?: { title?: string; trip?: string };
  categories?: Record<string, string>;
  zones?: Record<string, { name?: string; message?: string }>;
  transportStops?: Record<string, string>;
  safeAnchors?: Record<string, string>;
  rules?: string[];
  emergency?: {
    numberLabel?: string;
    taxiPhraseFrench?: string;
    staffRoles?: Record<string, string>;
    scams?: { title: string; text: string }[];
  };
  places?: Record<string, { name?: string; description?: string; tip?: string }>;
  programs?: Record<
    string,
    {
      title?: string;
      tagline?: string;
      mode?: string;
      warnings?: string[];
      stops?: Record<string, { label?: string; note?: string }>;
    }
  >;
}

const overlay = arRaw as unknown as ArabicOverlay;

/** The same content with the Arabic texts laid over the French ones. */
function withArabic(base: IstanbulData, ar: ArabicOverlay): IstanbulData {
  return {
    ...base,
    meta: { ...base.meta, ...ar.meta },
    categories: base.categories.map((c) => ({ ...c, label: ar.categories?.[c.id] ?? c.label })),
    zones: base.zones.map((z) => ({ ...z, ...ar.zones?.[z.id] })),
    transportStops: base.transportStops.map((t) => ({ ...t, name: ar.transportStops?.[t.id] ?? t.name })),
    safeAnchors: base.safeAnchors.map((a) => ({ ...a, name: ar.safeAnchors?.[a.name] ?? a.name })),
    rules: ar.rules && ar.rules.length === base.rules.length ? ar.rules : base.rules,
    emergency: {
      ...base.emergency,
      numberLabel: ar.emergency?.numberLabel ?? base.emergency.numberLabel,
      taxiPhraseFrench: ar.emergency?.taxiPhraseFrench ?? base.emergency.taxiPhraseFrench,
      staff: base.emergency.staff.map((s) => ({
        ...s,
        ...(s.role && ar.emergency?.staffRoles?.[s.role] ? { role: ar.emergency.staffRoles[s.role] } : {}),
      })),
      scams: base.emergency.scams.map((s, i) => ({ ...s, ...ar.emergency?.scams?.[i] })),
    },
    places: base.places.map((p) => ({ ...p, ...ar.places?.[p.id] })),
    programs: base.programs.map((p) => {
      const o = ar.programs?.[p.id];
      if (!o) return p;
      return {
        ...p,
        ...(o.title ? { title: o.title } : {}),
        ...(o.tagline ? { tagline: o.tagline } : {}),
        ...(o.mode ? { mode: o.mode } : {}),
        ...(o.warnings && o.warnings.length === p.warnings.length ? { warnings: o.warnings } : {}),
        stops: p.stops.map((s, i) => ({ ...s, ...o.stops?.[String(i)] })),
      };
    }),
  };
}

/** Colors used for the zones (map circles, banners, legend). The wording of each zone comes from the translations (`map.zoneLabel.*`). */
export const ZONE_STYLE: Record<ZoneKind, { color: string; fillOpacity: number; dashed?: boolean }> = {
  verte: { color: '#16A34A', fillOpacity: 0.1 },
  orange: { color: '#EA580C', fillOpacity: 0, dashed: true },
  eviter: { color: '#DC2626', fillOpacity: 0.28 },
  prudence: { color: '#EAB308', fillOpacity: 0.3 },
};

/** Colors of the "how may I get there" badge of a place; the wording comes from the translations (`map.access.*`). */
export const ACCESS_STYLE: Record<Place['zone'], { color: string }> = {
  verte: { color: '#16A34A' },
  orange: { color: '#EA580C' },
  staff: { color: '#DC2626' },
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

export interface ResolvedZone extends Zone {
  centerLat: number;
  centerLng: number;
}

/** The Carte content in one language, with the lookups the screens need. */
export interface IstanbulView {
  data: IstanbulData;
  getPlace: (id: string) => Place | undefined;
  getCategory: (id: string) => Category | undefined;
  /** Turns a program stop into a point with a title, whatever it refers to. */
  resolveStop: (stop: ProgramStop, index: number) => ResolvedStop | null;
  resolveProgram: (program: Program) => ResolvedStop[];
  zones: ResolvedZone[];
}

function buildView(data: IstanbulData, backToHotel: string): IstanbulView {
  const placeById = new Map<string, Place>(data.places.map((p) => [p.id, p]));
  const transportById = new Map<string, TransportStop>(data.transportStops.map((t) => [t.id, t]));
  const categoryById = new Map<string, Category>(data.categories.map((c) => [c.id, c]));

  const resolveStop = (stop: ProgramStop, index: number): ResolvedStop | null => {
    const key = `${index}`;
    if (stop.hotel) {
      return {
        key,
        time: stop.time,
        title: stop.label ?? backToHotel,
        note: stop.note,
        lat: data.hotel.lat,
        lng: data.hotel.lng,
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
  };

  return {
    data,
    getPlace: (id) => placeById.get(id),
    getCategory: (id) => categoryById.get(id),
    resolveStop,
    resolveProgram: (program) =>
      program.stops.map((s, i) => resolveStop(s, i)).filter((s): s is ResolvedStop => s !== null),
    zones: data.zones.map((z) => {
      const c = zoneCenter(z, data.hotel);
      return { ...z, centerLat: c.lat, centerLng: c.lng };
    }),
  };
}

const frenchView = buildView(istanbul, "Retour à l'hôtel");
const views: Record<MapLanguage, IstanbulView> = {
  fr: frenchView,
  ar: buildView(withArabic(istanbul, overlay), 'العودة إلى الفندق'),
};

export const istanbulFor = (lang: MapLanguage): IstanbulView => views[lang];

/** The Carte content in the language the app is in right now (re-renders when the language changes). */
export function useIstanbul(): IstanbulView {
  const { i18n } = useTranslation();
  return views[i18n.language === 'ar' ? 'ar' : 'fr'];
}

// French lookups kept for code that does not depend on the language (tests, scripts).
export const getPlace = frenchView.getPlace;
export const getCategory = frenchView.getCategory;
export const resolveStop = frenchView.resolveStop;
export const resolveProgram = frenchView.resolveProgram;
export const resolvedZones: ResolvedZone[] = frenchView.zones;
