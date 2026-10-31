// Messages exchanged between the React Native screen and the Leaflet page (which runs inside a
// WebView on phones and an iframe on the web). Keep this file free of React imports: its shape is
// mirrored by the plain-JavaScript engine in mapHtml.ts.

export type FitTarget = 'default' | 'hotel' | 'orange' | 'route' | 'user' | 'place';

export interface MapZone {
  id: string;
  kind: 'verte' | 'orange' | 'eviter' | 'prudence';
  name: string;
  lat: number;
  lng: number;
  radius: number;
  color: string;
  fillOpacity: number;
  dashed?: boolean;
}

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  icon: string;
}

export interface MapRouteStop {
  n: number;
  lat: number;
  lng: number;
  title: string;
  kind: 'place' | 'transport' | 'hotel';
  placeId?: string;
}

export interface MapUser {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export interface MapPerson {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Marker color: green inside the zone, orange outside the green circle, red out of bounds. */
  color: string;
  /** Short text shown next to the name, e.g. "il y a 4 min". */
  detail: string;
}

/** Everything the map shows. The page redraws only the parts that changed. */
export interface MapState {
  hotel: { lat: number; lng: number; name: string };
  zones: MapZone[];
  pins: MapPin[];
  route: MapRouteStop[] | null;
  user: MapUser | null;
  people: MapPerson[];
  selectedId: string | null;
  dark: boolean;
  /**
   * Moves the camera. A new `nonce` triggers it, so the same target can be re-applied.
   * `padTop` / `padBottom` (px) keep the content clear of the overlays above and below the map.
   */
  fit: { target: FitTarget; nonce: number; padTop?: number; padBottom?: number };
  /** Id of the pin to center on when fit.target === 'place'. */
  focusId?: string | null;
}

export type MapEvent =
  | { type: 'ready' }
  | { type: 'pinTap'; id: string }
  | { type: 'zoneTap'; id: string }
  | { type: 'stopTap'; placeId: string }
  | { type: 'personTap'; id: string }
  | { type: 'mapTap' }
  | { type: 'error'; message: string };

export interface MapEngineProps {
  state: MapState;
  onEvent: (event: MapEvent) => void;
}
