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

export type ProjectAnalyticsHotspotSummary = {
  hotspotId: string | null;
  hotspotTitle: string;
  hotspotType: string | null;
  interactions: number;
  completions: number;
  opens: number;
};

export type ProjectAnalyticsSceneReach = {
  sceneId: string;
  sceneName: string;
  sessionsReached: number;
  reachRate: number;
  thumbnailUrl?: string | null;
  order: number;
};

export type ProjectAnalyticsDeviceUsage = {
  deviceType: string;
  count: number;
  percentage: number;
};

export type ProjectAnalyticsDailyMetric = {
  date: string;
  value: number | null;
};

export type ProjectAnalyticsReflectionSummary = {
  hotspotId: string | null;
  hotspotTitle: string;
  sceneName: string;
  reflectionPrompt?: string | null;
  responseText: string;
  createdAt: string;
};

export type ProjectAnalyticsHeatmapPoint = {
  hotspotId: string | null;
  hotspotTitle: string;
  hotspotType: string | null;
  sceneId: string | null;
  sceneName: string;
  yaw: number;
  pitch: number;
  polygonPoints?: Array<{ yaw: number; pitch: number }> | null;
  interactionCount: number;
  completionCount: number;
  intensity: 'low' | 'medium' | 'high';
  intensityValue: number;
};

export type ProjectAnalyticsSummary = {
  totalSessions: number;
  totalEvents: number;
  averageTimeMinutes: number | null;
  completionRate: number;
  totalCompletions: number;
  topHotspot: ProjectAnalyticsHotspotSummary | null;
  hotspotInteractionCounts: ProjectAnalyticsHotspotSummary[];
  sceneReach: ProjectAnalyticsSceneReach[];
  deviceUsage: ProjectAnalyticsDeviceUsage[];
  reflectionCount: number;
  recentReflections: ProjectAnalyticsReflectionSummary[];
  reflectionDetails: ProjectAnalyticsReflectionSummary[];
  dailySessions: ProjectAnalyticsDailyMetric[];
  dailyAverageTime: ProjectAnalyticsDailyMetric[];
  uniqueHotspotsInteracted: number;
  heatmapPoints: ProjectAnalyticsHeatmapPoint[];
};
