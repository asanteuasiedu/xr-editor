import { authConfigurationError, supabase } from './supabaseClient';
import type { ProjectAnalyticsEvent } from '../types/analytics';

type LoadProjectAnalyticsEventsParams = {
  projectId: string;
  userId: string;
  dateFrom?: string;
  dateTo?: string;
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

function mapAnalyticsEventRow(row: Record<string, unknown>): ProjectAnalyticsEvent {
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    project_id: typeof row.project_id === 'string' ? row.project_id : '',
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    session_id: typeof row.session_id === 'string' ? row.session_id : '',
    event_type: row.event_type as ProjectAnalyticsEvent['event_type'],
    scene_id: typeof row.scene_id === 'string' ? row.scene_id : null,
    scene_name: typeof row.scene_name === 'string' ? row.scene_name : null,
    hotspot_id: typeof row.hotspot_id === 'string' ? row.hotspot_id : null,
    hotspot_title: typeof row.hotspot_title === 'string' ? row.hotspot_title : null,
    hotspot_type: typeof row.hotspot_type === 'string' ? row.hotspot_type : null,
    response_text: typeof row.response_text === 'string' ? row.response_text : null,
    answer_correct: typeof row.answer_correct === 'boolean' ? row.answer_correct : null,
    progress_value: typeof row.progress_value === 'number' ? row.progress_value : null,
    device_type: typeof row.device_type === 'string' ? row.device_type : null,
    browser_name: typeof row.browser_name === 'string' ? row.browser_name : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined
  };
}

export async function trackProjectAnalyticsEvent(event: ProjectAnalyticsEvent): Promise<void> {
  if (!event.project_id?.trim() || !event.session_id?.trim()) {
    return;
  }

  if (!supabase) {
    if (isDevelopmentEnvironment()) {
      console.warn('[analytics] skipped event because Supabase is not configured', {
        eventType: event.event_type,
        projectId: event.project_id
      });
    }
    return;
  }

  try {
    const client = requireSupabaseClient();
    const { error } = await client.from('project_analytics_events').insert({
      project_id: event.project_id,
      user_id: event.user_id ?? null,
      session_id: event.session_id,
      event_type: event.event_type,
      scene_id: event.scene_id ?? null,
      scene_name: event.scene_name ?? null,
      hotspot_id: event.hotspot_id ?? null,
      hotspot_title: event.hotspot_title ?? null,
      hotspot_type: event.hotspot_type ?? null,
      response_text: event.response_text ?? null,
      answer_correct: event.answer_correct ?? null,
      progress_value: event.progress_value ?? null,
      device_type: event.device_type ?? null,
      browser_name: event.browser_name ?? null,
      metadata: event.metadata ?? null
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    if (isDevelopmentEnvironment()) {
      console.warn('[analytics] failed to track project event', {
        eventType: event.event_type,
        projectId: event.project_id,
        error: error instanceof Error ? error.message : 'Unknown analytics tracking failure.'
      });
    }
  }
}

export async function loadProjectAnalyticsEvents({
  projectId,
  userId,
  dateFrom,
  dateTo
}: LoadProjectAnalyticsEventsParams): Promise<ProjectAnalyticsEvent[]> {
  if (!projectId.trim() || !userId.trim()) {
    return [];
  }

  if (!supabase) {
    if (isDevelopmentEnvironment()) {
      console.warn('[analytics] skipped load because Supabase is not configured', {
        projectId
      });
    }
    return [];
  }

  const client = requireSupabaseClient();
  let query = client
    .from('project_analytics_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(mapAnalyticsEventRow);
}
