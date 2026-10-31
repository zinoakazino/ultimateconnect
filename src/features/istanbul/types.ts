// Shapes of src/features/istanbul/istanbul-data.json — the single file that holds every place,
// zone and day program of the "Carte Istanbul" feature. See README.md in this folder.

export interface LatLng {
  lat: number;
  lng: number;
}

/** Who may go there: free on foot / only by transport in a group / only with the staff. */
export type PlaceZone = 'verte' | 'orange' | 'staff';

/** `eviter` is drawn red, `prudence` amber; `verte` and `orange` are the two big circles. */
export type ZoneKind = 'verte' | 'orange' | 'eviter' | 'prudence';

export interface Category {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export interface Hotel extends LatLng {
  id: 'hotel';
  name: string;
  address: string;
  /** Written for a taxi driver; line breaks are kept. */
  addressTurkish: string;
  note?: string;
  osmQuery?: string;
  verified: boolean;
}

export interface Zone {
  id: string;
  kind: ZoneKind;
  name: string;
  message: string;
  /** Meters. */
  radius: number;
  /** `"hotel"` = centred on the hotel; otherwise lat/lng are given. */
  center?: 'hotel';
  lat?: number;
  lng?: number;
  osmQuery?: string;
  verified?: boolean;
}

export interface Place extends LatLng {
  id: string;
  name: string;
  /** Compact name for the printed flyer's lists. */
  short?: string;
  category: string;
  description: string;
  tip: string;
  /** "€", "€€", "€€€" or "Gratuit". */
  price: string;
  zone: PlaceZone;
  osmQuery?: string;
  verified: boolean;
}

/** A point used only by day programs (ferry pier, tram stop…), not listed as a place. */
export interface TransportStop extends LatLng {
  id: string;
  name: string;
  osmQuery?: string;
  verified: boolean;
}

export interface SafeAnchor extends LatLng {
  name: string;
  hotel?: boolean;
}

export interface ProgramStop {
  /** "09:00", or "" when no time is suggested. */
  time: string;
  /** Exactly one of these three identifies where the stop is. */
  place?: string;
  transport?: string;
  hotel?: boolean;
  /** Replaces the place name in the list (e.g. "Déjeuner – Çiya Sofrası"). */
  label?: string;
  /** Compact text for the printed flyer, when `label` is too long for its narrow columns. */
  short?: string;
  note?: string;
}

export interface Program {
  id: string;
  title: string;
  tagline: string;
  mode: string;
  zone: 'verte' | 'orange';
  /** ISO date (YYYY-MM-DD) of the free slot this plan is made for. */
  day?: string;
  /** "A", "B", "C"… when several plans compete for the same free day. */
  option?: string;
  /** Only for this travel group (its flights make the slot free); missing = for everybody. */
  group?: number;
  warnings: string[];
  stops: ProgramStop[];
}

export interface StaffContact {
  name: string;
  /** Shown under the name, e.g. "Responsable du groupe". */
  role?: string;
  /** International format, e.g. "+213 555 00 11 22". Empty = not filled in yet. */
  phone: string;
}

export interface Scam {
  title: string;
  text: string;
}

export interface Emergency {
  number: string;
  numberLabel: string;
  taxiPhraseTurkish: string;
  taxiPhraseFrench: string;
  staff: StaffContact[];
  scams: Scam[];
}

/** One line of a day of the official programme. A `flight` shows as a boarding pass. */
export interface OfficialItem {
  kind?: 'flight';
  /** "09:00", "≈ 17:00", "Matin"… shown in the time column. */
  time?: string;
  /** takeoff, landing, hotel, school, boat, sun, help, suitcase, coffee */
  icon?: string;
  text?: string;
  /** Free time: drawn in the "libre" colour. */
  free?: boolean;
  /** Leaves a blank to write on, after `text` (e.g. a time the staff has not given yet). */
  fill?: boolean;
  after?: string;
  /** Only printed on this travel group's flyer (two groups fly at different times); missing = for everybody. */
  group?: number;
  from?: string;
  to?: string;
  dep?: string;
  arr?: string;
  /** Flight only: shown under the boarding pass, e.g. "Air Algérie". */
  airline?: string;
  /** Flight only: baggage allowance, shown under the boarding pass. */
  baggage?: string;
}

export interface OfficialDay {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** travel = flights, official = organised by the staff, libre = free day, tbd = not decided yet. */
  kind: 'travel' | 'official' | 'libre' | 'tbd';
  title: string;
  /** Hotel breakfast that morning. */
  breakfast?: boolean;
  items: OfficialItem[];
}

/** A travel group of the trip. Each one gets its own programme flyer, with only its own flights. */
export interface OfficialGroup {
  id: number;
  name: string;
  airline: string;
}

/** The group's own schedule (flights, formation, walks…), printed on the flyer's programme page. */
export interface OfficialProgram {
  title: string;
  tagline: string;
  breakfast: string;
  /** When given, one programme flyer is built per group (items and plans with a `group` go on that one only). */
  groups?: OfficialGroup[];
  days: OfficialDay[];
}

/** Extra content used only by the printed flyer (tools/flyer). */
export interface FlyerContent {
  appUrl: string;
  phrases: { fr: string; tr: string }[];
  tips: string[];
  scams: { title: string; text: string }[];
}

export interface IstanbulData {
  flyer?: FlyerContent;
  officialProgram?: OfficialProgram;
  meta: {
    title: string;
    trip: string;
    city: string;
    coordinatesCheckedOn?: string;
    coordinatesSource?: string;
  };
  hotel: Hotel;
  categories: Category[];
  zones: Zone[];
  safeAnchors: SafeAnchor[];
  places: Place[];
  transportStops: TransportStop[];
  programs: Program[];
  emergency: Emergency;
  rules: string[];
}
