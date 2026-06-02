export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'scene_view'
  | 'hotspot_open'
  | 'hotspot_complete'
  | 'question_answer'
  | 'reflection_submit'
  | 'project_complete';

export type ProjectAnalyticsEvent = {
  id?: string;
  project_id: string;
  user_id?: string | null;
  session_id: string;
  event_type: AnalyticsEventType;
  scene_id?: string | null;
  scene_name?: string | null;
  hotspot_id?: string | null;
  hotspot_title?: string | null;
  hotspot_type?: string | null;
  response_text?: string | null;
  answer_correct?: boolean | null;
  progress_value?: number | null;
  device_type?: string | null;
  browser_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};
