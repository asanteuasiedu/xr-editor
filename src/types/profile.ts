export type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  display_name?: string | null;
  organization?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  profile_type: 'individual';
  role: 'creator' | 'educator' | 'admin';
  created_at: string;
  updated_at: string;
};
