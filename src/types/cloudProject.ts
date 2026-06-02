import type { Project } from './project';

export type CloudProject = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  project_data: Project;
  status?: 'draft' | 'published';
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
};
