import type { CloudProject } from './cloudProject';

export type ProjectClassroom = {
  id: string;
  project_id: string;
  owner_user_id: string;
  name: string;
  share_slug: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateProjectClassroomInput = {
  projectId: string;
  ownerUserId: string;
  name: string;
  description?: string;
};

export type ClassroomProjectLoadResult = {
  classroom: ProjectClassroom;
  project: CloudProject;
};
