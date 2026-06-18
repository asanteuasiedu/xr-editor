import { authConfigurationError, supabase } from './supabaseClient';
import type { CloudProject } from '../types/cloudProject';
import type {
  ClassroomProjectLoadResult,
  CreateProjectClassroomInput,
  ProjectClassroom
} from '../types/classroom';
import { validateProjectData } from '../utils/validation';

type ClassroomRow = {
  id: string;
  project_id: string;
  owner_user_id: string;
  name: string;
  share_slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ClassroomProjectRpcRow = {
  classroom_id: string;
  owner_user_id: string;
  classroom_name: string;
  classroom_share_slug: string;
  classroom_description: string | null;
  classroom_is_active: boolean;
  classroom_created_at: string;
  classroom_updated_at: string;
  project_id: string;
  project_user_id: string;
  project_title: string;
  project_description: string | null;
  project_data: unknown;
  project_status: string | null;
  project_thumbnail_url: string | null;
  project_created_at: string;
  project_updated_at: string;
};

type SupabaseErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

const MAX_CLASSROOM_SLUG_ATTEMPTS = 3;
const GENERIC_CLASSROOM_CREATE_ERROR =
  'Unable to create classroom. Confirm this project is saved to your account and the classroom database migration has been applied.';

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

function mapProjectClassroom(row: ClassroomRow): ProjectClassroom {
  return {
    id: row.id,
    project_id: row.project_id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    share_slug: row.share_slug,
    description: row.description,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapCloudProjectFromRpcRow(row: ClassroomProjectRpcRow): CloudProject {
  const validated = validateProjectData(row.project_data);
  if (!validated.ok) {
    throw new Error(`Stored classroom project data is invalid: ${validated.error}`);
  }

  return {
    id: row.project_id,
    user_id: row.project_user_id,
    title: row.project_title,
    description: row.project_description,
    project_data: validated.value,
    status: row.project_status === 'published' ? 'published' : 'draft',
    thumbnail_url: row.project_thumbnail_url,
    created_at: row.project_created_at,
    updated_at: row.project_updated_at
  };
}

function mapProjectClassroomFromRpcRow(row: ClassroomProjectRpcRow): ProjectClassroom {
  return {
    id: row.classroom_id,
    project_id: row.project_id,
    owner_user_id: row.owner_user_id,
    name: row.classroom_name,
    share_slug: row.classroom_share_slug,
    description: row.classroom_description,
    is_active: row.classroom_is_active,
    created_at: row.classroom_created_at,
    updated_at: row.classroom_updated_at
  };
}

function createRandomSlugSegment() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  }

  return Math.random().toString(36).slice(2, 8);
}

function buildShareSlug(projectId: string) {
  const projectSegment = projectId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'project';
  return `udeesa-${projectSegment}-${createRandomSlugSegment()}`;
}

function getSupabaseErrorLike(error: unknown): SupabaseErrorLike | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const possibleError = error as Record<string, unknown>;
  return {
    message: typeof possibleError.message === 'string' ? possibleError.message : null,
    details: typeof possibleError.details === 'string' ? possibleError.details : null,
    hint: typeof possibleError.hint === 'string' ? possibleError.hint : null,
    code: typeof possibleError.code === 'string' ? possibleError.code : null
  };
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return getSupabaseErrorLike(error)?.message ?? '';
}

function isMissingClassroomLoaderFunctionError(error: unknown) {
  const errorLike = getSupabaseErrorLike(error);
  const normalized = getSupabaseErrorMessage(error).trim().toLowerCase();

  return (
    errorLike?.code === '42883' ||
    normalized.includes('could not find the function public.get_classroom_project_by_slug') ||
    normalized.includes('function public.get_classroom_project_by_slug') ||
    normalized.includes('schema cache')
  );
}

function isMissingProjectClassroomsTableError(error: unknown) {
  const normalized = getSupabaseErrorMessage(error).trim().toLowerCase();

  return (
    normalized.includes('relation "public.project_classrooms" does not exist') ||
    normalized.includes('relation "project_classrooms" does not exist') ||
    normalized.includes('relation \\"project_classrooms\\" does not exist') ||
    normalized.includes('could not find the table')
  );
}

function isPermissionOrRlsError(error: unknown) {
  const normalized = getSupabaseErrorMessage(error).trim().toLowerCase();

  return (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security policy')
  );
}

function toFriendlyCreateClassroomError(error: unknown) {
  if (isMissingProjectClassroomsTableError(error)) {
    return new Error('Classroom database setup is missing. Please apply create_project_classrooms.sql in Supabase.');
  }

  if (isPermissionOrRlsError(error)) {
    return new Error(GENERIC_CLASSROOM_CREATE_ERROR);
  }

  const normalized = getSupabaseErrorMessage(error).trim().toLowerCase();
  if (normalized.includes('authentication is not configured')) {
    return new Error(authConfigurationError);
  }

  return new Error(GENERIC_CLASSROOM_CREATE_ERROR);
}

export async function verifyClassroomSetup(): Promise<boolean> {
  const client = requireSupabaseClient();
  const { error } = await client.from('project_classrooms').select('id').limit(1);

  if (!error) {
    return true;
  }

  if (isMissingProjectClassroomsTableError(error)) {
    return false;
  }

  throw error;
}

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorCode = 'code' in error ? (error as { code?: unknown }).code : undefined;
  const errorMessage = 'message' in error ? (error as { message?: unknown }).message : undefined;

  return (
    errorCode === '23505' ||
    (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('duplicate key'))
  );
}

export async function createProjectClassroom(
  input: CreateProjectClassroomInput
): Promise<ProjectClassroom> {
  const client = requireSupabaseClient();
  const trimmedProjectId = input.projectId.trim();
  const trimmedOwnerUserId = input.ownerUserId.trim();
  const trimmedName = input.name.trim();

  if (!trimmedProjectId) {
    throw new Error('Save this project to your account before creating classroom links.');
  }

  if (!trimmedOwnerUserId) {
    throw new Error('Log in to manage classroom links.');
  }

  if (!trimmedName) {
    throw new Error('Enter a classroom or group name first.');
  }

  let hasClassroomSetup = false;
  try {
    hasClassroomSetup = await verifyClassroomSetup();
  } catch (error) {
    const errorDetails = getSupabaseErrorLike(error);
    console.error('[classrooms] failed to verify classroom setup', {
      message: errorDetails?.message ?? getSupabaseErrorMessage(error) ?? 'Unknown classroom setup failure.',
      details: errorDetails?.details ?? null,
      hint: errorDetails?.hint ?? null,
      code: errorDetails?.code ?? null,
      payload: {
        project_id: trimmedProjectId,
        owner_user_id: trimmedOwnerUserId,
        name: trimmedName
      }
    });
    throw toFriendlyCreateClassroomError(error);
  }

  if (!hasClassroomSetup) {
    throw new Error('Classroom database setup is missing. Please apply create_project_classrooms.sql in Supabase.');
  }

  for (let attempt = 0; attempt < MAX_CLASSROOM_SLUG_ATTEMPTS; attempt += 1) {
    const payload = {
      project_id: trimmedProjectId,
      owner_user_id: trimmedOwnerUserId,
      name: trimmedName,
      description: normalizeOptionalText(input.description),
      share_slug: buildShareSlug(trimmedProjectId),
      is_active: true
    };
    const { data, error } = await client
      .from('project_classrooms')
      .insert(payload)
      .select('*')
      .single();

    if (!error) {
      return mapProjectClassroom(data as ClassroomRow);
    }

    const errorDetails = getSupabaseErrorLike(error);
    const safeMessage =
      errorDetails?.message ?? getSupabaseErrorMessage(error) ?? 'Unknown classroom creation failure.';
    console.error('[classrooms] failed to create classroom', {
      message: safeMessage,
      details: errorDetails?.details ?? null,
      hint: errorDetails?.hint ?? null,
      code: errorDetails?.code ?? null,
      payload: {
        project_id: payload.project_id,
        owner_user_id: payload.owner_user_id,
        name: payload.name,
        share_slug: payload.share_slug
      }
    });

    if (!isUniqueConstraintError(error)) {
      throw toFriendlyCreateClassroomError(error);
    }

    if (attempt === MAX_CLASSROOM_SLUG_ATTEMPTS - 1) {
      throw new Error('Unable to create a unique classroom link. Please try again.');
    }
  }

  throw new Error('Unable to create a unique classroom link. Please try again.');
}

export async function loadProjectClassrooms(projectId: string): Promise<ProjectClassroom[]> {
  if (!projectId.trim()) {
    return [];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('project_classrooms')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ClassroomRow[]).map(mapProjectClassroom);
}

export async function updateProjectClassroom(input: {
  classroomId: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}): Promise<ProjectClassroom> {
  const client = requireSupabaseClient();
  const patch: Record<string, unknown> = {};

  if (typeof input.name === 'string') {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Classroom name cannot be empty.');
    }
    patch.name = trimmedName;
  }

  if (typeof input.description === 'string') {
    patch.description = normalizeOptionalText(input.description);
  }

  if (typeof input.isActive === 'boolean') {
    patch.is_active = input.isActive;
  }

  const { data, error } = await client
    .from('project_classrooms')
    .update(patch)
    .eq('id', input.classroomId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectClassroom(data as ClassroomRow);
}

export async function deleteProjectClassroom(classroomId: string): Promise<void> {
  if (!classroomId.trim()) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client.from('project_classrooms').delete().eq('id', classroomId);

  if (error) {
    throw error;
  }
}

export async function loadClassroomBySlug(shareSlug: string): Promise<ProjectClassroom | null> {
  const trimmedSlug = shareSlug.trim();
  if (!trimmedSlug) {
    return null;
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('project_classrooms')
    .select('*')
    .eq('share_slug', trimmedSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProjectClassroom(data as ClassroomRow) : null;
}

export async function loadClassroomProjectBySlug(
  shareSlug: string
): Promise<ClassroomProjectLoadResult | null> {
  const trimmedSlug = shareSlug.trim();
  if (!trimmedSlug) {
    return null;
  }

  const client = requireSupabaseClient();
  const loadAttempt = async (parameterName: 'classroom_slug' | 'lookup_share_slug') =>
    client.rpc('get_classroom_project_by_slug', {
      [parameterName]: trimmedSlug
    });

  let response = await loadAttempt('classroom_slug');
  if (response.error && isMissingClassroomLoaderFunctionError(response.error)) {
    response = await loadAttempt('lookup_share_slug');
  }

  const { data, error } = response;

  if (error) {
    const errorDetails = getSupabaseErrorLike(error);
    console.error('[classrooms] failed to load classroom project', {
      message: errorDetails?.message ?? getSupabaseErrorMessage(error) ?? 'Unknown classroom project loading failure.',
      details: errorDetails?.details ?? null,
      hint: errorDetails?.hint ?? null,
      code: errorDetails?.code ?? null,
      shareSlug: trimmedSlug
    });

    if (isMissingClassroomLoaderFunctionError(error)) {
      throw new Error('Classroom loading setup is missing. Please apply the classroom project loader SQL in Supabase.');
    }

    throw new Error('Unable to load this classroom experience. Please try again.');
  }

  const row = Array.isArray(data)
    ? (data[0] as ClassroomProjectRpcRow | undefined)
    : data
      ? (data as ClassroomProjectRpcRow)
      : undefined;
  if (!row) {
    throw new Error('This classroom link is unavailable.');
  }

  return {
    classroom: mapProjectClassroomFromRpcRow(row),
    project: mapCloudProjectFromRpcRow(row)
  };
}
