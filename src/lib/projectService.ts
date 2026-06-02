import { authConfigurationError, supabase } from './supabaseClient';
import type { Project } from '../types/project';
import type { CloudProject } from '../types/cloudProject';
import { validateProjectData } from '../utils/validation';

type SaveProjectToCloudParams = {
  userId: string;
  project: Project;
  existingProjectId?: string | null;
};

type UpdateCloudProjectStatusParams = {
  userId: string;
  projectId: string;
  status: 'draft' | 'published';
};

type LoadCloudProjectParams = {
  userId: string;
  projectId: string;
};

type DeleteCloudProjectParams = {
  userId: string;
  projectId: string;
};

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  project_data: unknown;
  status: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error(authConfigurationError);
  }

  return supabase;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapProjectRow(row: ProjectRow): CloudProject {
  const validated = validateProjectData(row.project_data);

  if (!validated.ok) {
    throw new Error(`Stored cloud project data is invalid: ${validated.error}`);
  }

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    project_data: validated.value,
    status: row.status === 'published' ? 'published' : 'draft',
    thumbnail_url: row.thumbnail_url,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getProjectTitle(project: Project) {
  const trimmed = project.name.trim();
  return trimmed || 'Untitled Project';
}

function getProjectDescription(project: Project) {
  return normalizeOptionalText(project.projectObjective ?? project.description);
}

function getProjectThumbnail(project: Project) {
  const activeScene =
    project.scenes.find((scene) => scene.id === project.activeSceneId) ??
    project.scenes[0] ??
    null;

  const thumbnailUrl = activeScene?.panoramaUrl?.trim();
  return thumbnailUrl ? thumbnailUrl : null;
}

export async function saveProjectToCloud({
  userId,
  project,
  existingProjectId
}: SaveProjectToCloudParams): Promise<CloudProject> {
  const client = requireSupabaseClient();
  const payload = {
    user_id: userId,
    title: getProjectTitle(project),
    description: getProjectDescription(project),
    project_data: project,
    thumbnail_url: getProjectThumbnail(project)
  };

  if (existingProjectId) {
    const { data, error } = await client
      .from('projects')
      .update(payload)
      .eq('id', existingProjectId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapProjectRow(data as ProjectRow);
  }

  const { data, error } = await client
    .from('projects')
    .insert({
      ...payload,
      status: 'draft'
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data as ProjectRow);
}

export async function loadUserProjects(userId: string): Promise<CloudProject[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const projects: CloudProject[] = [];

  for (const row of (data ?? []) as ProjectRow[]) {
    try {
      projects.push(mapProjectRow(row));
    } catch (mappingError) {
      console.warn('[cloud-projects] skipping invalid stored project', {
        projectId: row.id,
        error: mappingError instanceof Error ? mappingError.message : 'Unknown project validation failure.'
      });
    }
  }

  return projects;
}

export async function loadCloudProject({ userId, projectId }: LoadCloudProjectParams): Promise<CloudProject> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data as ProjectRow);
}

export async function deleteCloudProject({ userId, projectId }: DeleteCloudProjectParams): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function updateCloudProjectStatus({
  userId,
  projectId,
  status
}: UpdateCloudProjectStatusParams): Promise<CloudProject> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .update({ status })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data as ProjectRow);
}
