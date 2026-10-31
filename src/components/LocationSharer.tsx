import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { saveLocation, setLocationSharing } from '../lib/api';

/**
 * Keeps a consultant's position fresh in the database for as long as they have opted in.
 * It follows the `locationSharing` flag on their profile, so sharing resumes by itself
 * after an app restart (it used to only run while the Profile screen was mounted).
 * Foreground only: the position stops updating when the app is closed or backgrounded.
 * Renders nothing.
 */
export function LocationSharer() {
  const { profile, authUser } = useAuth();
  const uid = authUser?.uid;
  const sharing = profile?.role === 'consultant' && profile.locationSharing === true;

  useEffect(() => {
    if (!uid || !sharing) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          // Without permission nothing can be shared — don't let the flag claim otherwise.
          await setLocationSharing(uid, false);
          return;
        }
        subscription?.remove();
        subscription = null;
        const next = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 25 },
          (position) => {
            saveLocation(uid, position.coords.latitude, position.coords.longitude).catch(() => {});
          }
        );
        if (cancelled) next.remove();
        else subscription = next;
      } catch (err) {
        console.warn('[location] could not start sharing:', err);
      }
    };

    start();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      appState.remove();
    };
  }, [uid, sharing]);

  return null;
}
