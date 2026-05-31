import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authConfigurationError, isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import type { UserProfile } from '../types/profile';
import {
  ensureUserProfile,
  updateUserProfile as persistUserProfileUpdate
} from '../lib/profileService';

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (params: {
    displayName?: string | null;
    organization?: string | null;
    role?: UserProfile['role'];
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getFriendlyAuthErrorMessage(error: unknown) {
  const fallback = 'Authentication could not be completed right now. Please try again.';

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (normalized.includes('auth session missing') || normalized.includes('authentication is not configured')) {
    return authConfigurationError;
  }

  if (normalized.includes('invalid login credentials')) {
    return 'That email or password does not match our records.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Check your email and confirm your account before logging in.';
  }

  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'An account with that email already exists. Try logging in instead.';
  }

  if (normalized.includes('password should be at least')) {
    return 'Use a password with at least 6 characters.';
  }

  if (normalized.includes('invalid email')) {
    return 'Enter a valid email address.';
  }

  if (normalized.includes('signup is disabled')) {
    return 'Sign up is unavailable right now. Please try again shortly.';
  }

  return message;
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error(authConfigurationError);
  }

  return supabase;
}

function getFriendlyProfileErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const normalized = error.message.trim().toLowerCase();

    if (
      normalized.includes('relation \"profiles\" does not exist') ||
      normalized.includes('could not find the table') ||
      normalized.includes('permission denied')
    ) {
      return 'Profile storage is not ready yet. Apply the Supabase profiles SQL and try again.';
    }

    if (
      normalized.includes('row-level security') ||
      normalized.includes('new row violates row-level security policy')
    ) {
      return 'Profile permissions are not configured correctly in Supabase yet.';
    }

    return error.message;
  }

  return 'Profile changes could not be completed right now.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          console.error('[auth] could not load initial session', error);
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        console.error('[auth] unexpected initial session failure', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const email = user.email?.trim().toLowerCase();

    if (!email) {
      console.warn('[auth] signed-in user is missing an email, skipping automatic profile creation');
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    try {
      const ensuredProfile = await ensureUserProfile({
        userId: user.id,
        email
      });
      setProfile(ensuredProfile);
    } catch (error) {
      console.error('[auth] could not fetch or create profile', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    void refreshProfile();
  }, [refreshProfile, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading,
      isConfigured: isSupabaseConfigured,
      async signUp(email: string, password: string) {
        try {
          const client = requireSupabaseClient();
          const { data, error } = await client.auth.signUp({ email, password });

          if (error) {
            throw error;
          }

          return {
            needsEmailConfirmation: !data.session
          };
        } catch (error) {
          throw new Error(getFriendlyAuthErrorMessage(error));
        }
      },
      async signIn(email: string, password: string) {
        try {
          const client = requireSupabaseClient();
          const { error } = await client.auth.signInWithPassword({ email, password });

          if (error) {
            throw error;
          }
        } catch (error) {
          throw new Error(getFriendlyAuthErrorMessage(error));
        }
      },
      async signOut() {
        try {
          const client = requireSupabaseClient();
          const { error } = await client.auth.signOut();

          if (error) {
            throw error;
          }
        } catch (error) {
          throw new Error(getFriendlyAuthErrorMessage(error));
        }
      },
      async refreshProfile() {
        await refreshProfile();
      },
      async updateProfile({ displayName, organization, role }) {
        if (!user?.id) {
          throw new Error('Sign in to update your profile.');
        }

        setProfileLoading(true);

        try {
          const nextProfile = await persistUserProfileUpdate({
            userId: user.id,
            displayName,
            organization,
            role
          });
          setProfile(nextProfile);
        } catch (error) {
          throw new Error(getFriendlyProfileErrorMessage(error));
        } finally {
          setProfileLoading(false);
        }
      }
    }),
    [loading, profile, profileLoading, refreshProfile, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
