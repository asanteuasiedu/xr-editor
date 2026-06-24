import type { Project } from './project';

export type CloudProjectCreatorProfile = {
  display_name?: string | null;
  organization?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

export type CloudProjectSummary = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status?: 'draft' | 'published';
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type CloudProject = CloudProjectSummary & {
  project_data: Project;
};

export type CloudProjectWithProfile = CloudProjectSummary & {
  creator_profile?: CloudProjectCreatorProfile | null;
};
