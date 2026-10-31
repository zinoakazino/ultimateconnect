import { Linking } from 'react-native';

/**
 * Opens the phone's maps app. Uses the keyless Google Maps URL scheme, so no API key
 * or billing account is needed. Prefers exact coordinates (they also work with a
 * downloaded offline map area), falling back to an address search.
 */
export function openInMaps(target: { lat?: number; lng?: number; address?: string; label?: string }) {
  const hasCoords = typeof target.lat === 'number' && typeof target.lng === 'number';
  const query = hasCoords ? `${target.lat},${target.lng}` : target.address || target.label || '';
  if (!query) return Promise.resolve(false);
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return Linking.openURL(url).then(() => true, () => false);
}

/**
 * Opens turn-by-turn directions to a destination, starting from the phone's current position.
 * `walking` for places in the green zone, `transit` for anything farther (tram, ferry, metro).
 */
export function openDirections(
  target: { lat: number; lng: number },
  mode: 'walking' | 'transit' | 'driving' = 'walking'
) {
  const url =
    `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}` +
    `&travelmode=${mode}`;
  return Linking.openURL(url).then(() => true, () => false);
}

export function callPhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return Promise.resolve(false);
  return Linking.openURL(`tel:${cleaned}`).then(() => true, () => false);
}

/** Parses "41.0082, 28.9784" (as copied from Google Maps) into coordinates. */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const match = input.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
