import { authConfigurationError, supabase } from './supabaseClient';
import type { UserProfile } from '../types/profile';

type EnsureUserProfileParams = {
  userId: string;
  email: string;
};

type UpdateUserProfileParams = {
  userId: string;
  displayName?: string | null;
  organization?: string | null;
  role?: UserProfile['role'];
};

type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  organization: string | null;
  profile_type: string;
  role: string;
  created_at: string;
  updated_at: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error(authConfigurationError);
  }

  return supabase;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    organization: row.organization,
    profile_type: row.profile_type === 'individual' ? 'individual' : 'individual',
    role: row.role === 'educator' || row.role === 'admin' ? row.role : 'creator',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getCurrentUserProfile(userId: string): Promise<UserProfile | null> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfileRow(data as ProfileRow) : null;
}

export async function ensureUserProfile({ userId, email }: EnsureUserProfileParams): Promise<UserProfile> {
  const existingProfile = await getCurrentUserProfile(userId);

  if (existingProfile) {
    return existingProfile;
  }

  const client = requireSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('A valid user email is required to create a profile.');
  }

  const { data, error } = await client
    .from('profiles')
    .insert({
      user_id: userId,
      email: normalizedEmail,
      profile_type: 'individual',
      role: 'creator'
    })
    .select('*')
    .single();

  if (error) {
    const duplicateProfileError = error as SupabaseLikeError;

    if (duplicateProfileError.code === '23505') {
      const existingProfile = await getCurrentUserProfile(userId);

      if (existingProfile) {
        return existingProfile;
      }
    }

    throw error;
  }

  return mapProfileRow(data as ProfileRow);
}

export async function updateUserProfile({
  userId,
  displayName,
  organization,
  role
}: UpdateUserProfileParams): Promise<UserProfile> {
  const client = requireSupabaseClient();
  const patch: Record<string, string | null> = {
    display_name: normalizeOptionalText(displayName),
    organization: normalizeOptionalText(organization)
  };

  if (role) {
    patch.role = role;
  }

  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProfileRow(data as ProfileRow);
}
