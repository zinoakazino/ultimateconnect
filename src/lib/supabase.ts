import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Public values (the "anon" key is meant to be in the app: what each person may read or write is
// decided by the row-level security rules in supabase/01-schema.sql, not by hiding this key).
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/** False when the app was built without its Supabase address: the app then says so instead of failing silently. */
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'http://127.0.0.1:54321', anonKey || 'not-configured', {
  auth: {
    // On the web the session lives in localStorage (the default); on a phone, in AsyncStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Password-reset emails open the app with the recovery token in the address.
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: { params: { eventsPerSecond: 10 } },
});
