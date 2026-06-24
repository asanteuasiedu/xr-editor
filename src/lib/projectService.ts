import { authConfigurationError, supabase } from './supabaseClient';
import type { Project } from '../types/project';
import type {
  CloudProject,
  CloudProjectCreatorProfile,
  CloudProjectWithProfile
} from '../types/cloudProject';
import { validateProjectData } from '../utils/validation';

type SaveProjectToCloudParams = {
  userId: string;
  project: Project;
  existingProjectId?: string | null;
  status?: 'draft' | 'published';
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

type PublicCreatorProfileRow = {
  user_id: string;
  display_name: string | null;
  organization: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type LoadPublishedProjectsParams = {
  limit?: number;
  search?: string;
};

function isDevelopmentEnvironment() {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

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

function mapCreatorProfileRow(row: PublicCreatorProfileRow): CloudProjectCreatorProfile {
  return {
    display_name: row.display_name,
    organization: row.organization,
    avatar_url: row.avatar_url,
    bio: row.bio
  };
}

export async function saveProjectToCloud({
  userId,
  project,
  existingProjectId,
  status
}: SaveProjectToCloudParams): Promise<CloudProject> {
  const client = requireSupabaseClient();
  const payload: {
    user_id: string;
    title: string;
    description: string | null;
    project_data: Project;
    thumbnail_url: string | null;
    status?: 'draft' | 'published';
  } = {
    user_id: userId,
    title: getProjectTitle(project),
    description: getProjectDescription(project),
    project_data: project,
    thumbnail_url: getProjectThumbnail(project)
  };

  if (status) {
    payload.status = status;
  }

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
      status: status ?? 'draft'
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

export async function loadPublishedProjects(
  params: LoadPublishedProjectsParams = {}
): Promise<CloudProjectWithProfile[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 60, 120));
  const searchTerm = params.search?.trim().toLowerCase() ?? '';

  console.info('[explore] loading published projects', {
    limit,
    hasSearch: Boolean(searchTerm)
  });

  if (!supabase) {
    if (isDevelopmentEnvironment()) {
      console.warn('[explore] skipped published project load because Supabase is not configured');
    }
    return [];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('id,user_id,title,description,thumbnail_url,status,project_data,created_at,updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[explore] failed to load native published projects', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw error;
  }

  const baseProjects: CloudProject[] = [];
  let skippedInvalidProjectCount = 0;

  for (const row of (data ?? []) as ProjectRow[]) {
    try {
      baseProjects.push(mapProjectRow(row));
    } catch (mappingError) {
      skippedInvalidProjectCount += 1;
      console.warn('[explore] skipping invalid published project', {
        projectId: row.id,
        error: mappingError instanceof Error ? mappingError.message : 'Unknown project validation failure.'
      });
    }
  }

  const creatorIds = Array.from(new Set(baseProjects.map((project) => project.user_id).filter(Boolean)));
  const creatorProfiles = new Map<string, CloudProjectCreatorProfile>();

  if (creatorIds.length > 0) {
    try {
      const { data: creatorData, error: creatorError } = await client
        .from('public_creator_profiles')
        .select('user_id, display_name, organization, avatar_url, bio')
        .in('user_id', creatorIds);

      if (creatorError) {
        console.warn('[explore] could not load creator profile summaries', {
          message: creatorError.message,
          details: creatorError.details,
          hint: creatorError.hint,
          code: creatorError.code
        });
      } else {
        for (const row of (creatorData ?? []) as PublicCreatorProfileRow[]) {
          creatorProfiles.set(row.user_id, mapCreatorProfileRow(row));
        }
      }
    } catch (creatorProfileError) {
      console.warn('[explore] could not load creator profile summaries', {
        message:
          creatorProfileError instanceof Error
            ? creatorProfileError.message
            : 'Unknown creator profile load failure.'
      });
    }
  }

  const projectsWithProfiles = baseProjects.map((project) => ({
    ...project,
    creator_profile: creatorProfiles.get(project.user_id) ?? null
  }));

  if (!searchTerm) {
    console.info('[explore] native published projects loaded', {
      count: projectsWithProfiles.length,
      owners: [...new Set(projectsWithProfiles.map((project) => project.user_id))],
      skippedInvalidProjects: skippedInvalidProjectCount
    });
    return projectsWithProfiles;
  }

  const filteredProjects = projectsWithProfiles.filter((project) => {
    const title = project.title.toLowerCase();
    const description = project.description?.toLowerCase() ?? '';
    const author = project.project_data.authorOrOrganization?.toLowerCase() ?? '';
    const creatorName = project.creator_profile?.display_name?.toLowerCase() ?? '';
    const organization = project.creator_profile?.organization?.toLowerCase() ?? '';

    return (
      title.includes(searchTerm) ||
      description.includes(searchTerm) ||
      author.includes(searchTerm) ||
      creatorName.includes(searchTerm) ||
      organization.includes(searchTerm)
    );
  });

  console.info('[explore] native published projects loaded', {
    count: filteredProjects.length,
    filteredFrom: projectsWithProfiles.length,
    owners: [...new Set(filteredProjects.map((project) => project.user_id))],
    skippedInvalidProjects: skippedInvalidProjectCount
  });

  return filteredProjects;
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

  console.info('[project status] updated', {
    projectId,
    status
  });

  return mapProjectRow(data as ProjectRow);
}
