import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { checkInviteCode, fetchProfile, fetchRosterChoices, touchLastActive } from '../lib/api';
import { notifyLocalChange, useLive } from '../lib/live';
import { supabase } from '../lib/supabase';
import type { UserDoc } from '../types/models';

interface SignUpInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  inviteCode: string;
  /** The name chosen in the participants list (its group and flights come with it). */
  rosterId?: string;
}

/** The signed-in account (the profile with name / role comes separately in `profile`). */
export interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthContextValue {
  authUser: AuthUser | null;
  profile: UserDoc | null;
  initializing: boolean;
  /** True while someone who followed a password-reset link must choose a new password. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  /** Emails a link to choose a new password. */
  resetPassword: (email: string) => Promise<void>;
  /** Saves the new password chosen after a reset link, then lets the person in. */
  setNewPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Reload the profile now (after the person changed something on it). */
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Errors the screens know how to explain, in the same shape the sign-in screens already use. */
const appError = (code: string, message: string) => Object.assign(new Error(message), { code });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionKnown, setSessionKnown] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const user = data.session?.user;
      setAuthUser(user ? { uid: user.id, email: user.email ?? null } : null);
      setSessionKnown(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setAuthUser((prev) => {
        const next = user ? { uid: user.id, email: user.email ?? null } : null;
        return prev?.uid === next?.uid ? prev : next;
      });
      setSessionKnown(true);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const uid = authUser?.uid;
  const { data: profile, loading: profileLoading, reload } = useLive<UserDoc | null>(
    () => fetchProfile(uid as string),
    null,
    [uid],
    { enabled: Boolean(uid), tables: [{ table: 'profiles', filter: `uid=eq.${uid}` }], poll: 30000 }
  );
  const initializing = !sessionKnown || (Boolean(uid) && profileLoading);

  // "Last active" is what staff see next to each consultant: refresh it whenever the app
  // comes back to the foreground, not only at launch.
  const lastTouch = useRef(0);
  useEffect(() => {
    if (!uid || !profile) return;
    const touch = () => {
      if (Date.now() - lastTouch.current < 60000) return;
      lastTouch.current = Date.now();
      touchLastActive(uid).catch(() => {});
    };
    touch();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') touch();
    });
    return () => appState.remove();
  }, [uid, Boolean(profile)]);

  const resetPassword = async (email: string) => {
    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
  };

  const setNewPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovering(false);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    // An account without a profile can't use the app. Say so instead of leaving them on the
    // login form with no feedback.
    const found = await fetchProfile(data.user.id).catch(() => undefined);
    if (found === null) {
      await supabase.auth.signOut();
      throw appError('app/profile-missing', 'Profile missing.');
    }
  };

  const signUp = async ({ name, phone, email, password, inviteCode, rosterId }: SignUpInput) => {
    // Ask first, so a wrong company code gets a clear message instead of a generic server error.
    // (The database checks the code again when the account is created: this is only the friendly part.)
    const kind = await checkInviteCode(inviteCode.trim()).catch(() => undefined);
    if (kind === null) throw appError('app/invalid-invite-code', 'Invalid company invite code.');

    // Same for the name taken from the participants list: someone may have taken it a moment ago.
    if (rosterId) {
      const free = await fetchRosterChoices(inviteCode.trim()).catch(() => undefined);
      if (free && !free.some((c) => c.id === rosterId)) throw appError('app/roster-taken', 'Name already taken.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          phone: phone.trim(),
          invite_code: inviteCode.trim(),
          ...(rosterId ? { roster_id: rosterId } : {}),
        },
      },
    });
    if (error) throw error;
    if (!data.session) {
      // The project asks for an email confirmation before the first sign-in (a Supabase setting).
      throw appError('app/confirm-email', 'Email confirmation required.');
    }
    // The profile is made by the database at sign-up: the listener above picks it up.
    reload();
    notifyLocalChange('profiles');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = useCallback(() => reload(), [reload]);

  const value = useMemo(
    () => ({
      authUser,
      profile,
      initializing,
      recovering,
      signIn,
      signUp,
      resetPassword,
      setNewPassword,
      signOut,
      refreshProfile,
    }),
    [authUser, profile, initializing, recovering, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
