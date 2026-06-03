import type {
  ProjectAnalyticsDailyMetric,
  ProjectAnalyticsDeviceUsage,
  ProjectAnalyticsEvent,
  ProjectAnalyticsHotspotSummary,
  ProjectAnalyticsReflectionSummary,
  ProjectAnalyticsSceneReach,
  ProjectAnalyticsSummary
} from '../types/analytics';
import type { Hotspot, Project, Scene } from '../types/project';

type SessionEventGroup = {
  sessionId: string;
  events: ProjectAnalyticsEvent[];
};

function getValidTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getDayKey(value?: string) {
  return value?.slice(0, 10) ?? 'unknown';
}

function formatHotspotLabel(hotspot?: Hotspot | null) {
  const title = hotspot?.title?.trim();
  return title || 'Untitled Insight Zone';
}

function formatSceneLabel(scene?: Scene | null, fallback?: string | null) {
  const sceneName = scene?.name?.trim();
  if (sceneName) {
    return sceneName;
  }

  const fallbackName = fallback?.trim();
  return fallbackName || 'Untitled Scene';
}

function toPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

export function aggregateProjectAnalytics(
  events: ProjectAnalyticsEvent[],
  projectData?: Project
): ProjectAnalyticsSummary {
  const sortedEvents = [...events].sort((left, right) => {
    const leftTime = getValidTimestamp(left.created_at) ?? 0;
    const rightTime = getValidTimestamp(right.created_at) ?? 0;
    return leftTime - rightTime;
  });

  const eventsBySession = new Map<string, ProjectAnalyticsEvent[]>();
  const hotspotSummaries = new Map<string, ProjectAnalyticsHotspotSummary>();
  const sceneSessionMap = new Map<string, Set<string>>();
  const deviceCounts = new Map<string, number>();
  const dailySessionMap = new Map<string, Set<string>>();
  const dailyDurationMap = new Map<string, number[]>();
  const reflections: ProjectAnalyticsReflectionSummary[] = [];

  const scenesById = new Map(projectData?.scenes.map((scene) => [scene.id, scene]) ?? []);
  const hotspotsById = new Map(
    projectData?.scenes.flatMap((scene) => scene.hotspots.map((hotspot) => [hotspot.id, hotspot] as const)) ?? []
  );

  for (const event of sortedEvents) {
    if (!event.session_id) {
      continue;
    }

    const sessionEvents = eventsBySession.get(event.session_id);
    if (sessionEvents) {
      sessionEvents.push(event);
    } else {
      eventsBySession.set(event.session_id, [event]);
    }

    if (event.scene_id) {
      const sceneSessions = sceneSessionMap.get(event.scene_id) ?? new Set<string>();
      sceneSessions.add(event.session_id);
      sceneSessionMap.set(event.scene_id, sceneSessions);
    }

    if (event.hotspot_id) {
      const existing = hotspotSummaries.get(event.hotspot_id) ?? {
        hotspotId: event.hotspot_id,
        hotspotTitle: event.hotspot_title?.trim() || formatHotspotLabel(hotspotsById.get(event.hotspot_id)),
        hotspotType: event.hotspot_type ?? hotspotsById.get(event.hotspot_id)?.type ?? null,
        interactions: 0,
        completions: 0,
        opens: 0
      };

      const isOpen = event.event_type === 'hotspot_open';
      const isCompletion =
        event.event_type === 'hotspot_complete' ||
        event.event_type === 'question_answer' ||
        event.event_type === 'reflection_submit';

      if (isOpen || isCompletion) {
        existing.interactions += 1;
      }

      if (isOpen) {
        existing.opens += 1;
      }

      if (isCompletion) {
        existing.completions += 1;
      }

      hotspotSummaries.set(event.hotspot_id, existing);
    }

    if (event.event_type === 'reflection_submit' && event.response_text?.trim()) {
      reflections.push({
        hotspotId: event.hotspot_id ?? null,
        hotspotTitle:
          event.hotspot_title?.trim() ||
          formatHotspotLabel(event.hotspot_id ? hotspotsById.get(event.hotspot_id) : null),
        sceneName: formatSceneLabel(event.scene_id ? scenesById.get(event.scene_id) : null, event.scene_name),
        responseText: event.response_text.trim(),
        createdAt: event.created_at ?? ''
      });
    }
  }

  const sessions = Array.from(eventsBySession.entries()).map(([sessionId, sessionEvents]) => ({
    sessionId,
    events: sessionEvents
  })) as SessionEventGroup[];

  const totalSessions = sessions.length;
  const totalCompletions = sessions.filter((session) =>
    session.events.some((event) => event.event_type === 'project_complete')
  ).length;

  const sessionDurationsMinutes: number[] = [];

  for (const session of sessions) {
    const sortedSessionEvents = [...session.events].sort((left, right) => {
      const leftTime = getValidTimestamp(left.created_at) ?? 0;
      const rightTime = getValidTimestamp(right.created_at) ?? 0;
      return leftTime - rightTime;
    });

    const firstEvent = sortedSessionEvents[0];
    const lastEvent = sortedSessionEvents[sortedSessionEvents.length - 1];
    const firstTimestamp = getValidTimestamp(firstEvent?.created_at);
    const lastTimestamp = getValidTimestamp(lastEvent?.created_at);
    const deviceType =
      sortedSessionEvents.find((event) => event.event_type === 'session_start')?.device_type ??
      firstEvent?.device_type ??
      'unknown';

    deviceCounts.set(deviceType || 'unknown', (deviceCounts.get(deviceType || 'unknown') ?? 0) + 1);

    const dayKey = getDayKey(firstEvent?.created_at);
    const daySessions = dailySessionMap.get(dayKey) ?? new Set<string>();
    daySessions.add(session.sessionId);
    dailySessionMap.set(dayKey, daySessions);

    if (firstTimestamp !== null && lastTimestamp !== null && lastTimestamp >= firstTimestamp) {
      const durationMinutes = Number((((lastTimestamp - firstTimestamp) / 1000) / 60).toFixed(2));
      sessionDurationsMinutes.push(durationMinutes);
      const durationBucket = dailyDurationMap.get(dayKey) ?? [];
      durationBucket.push(durationMinutes);
      dailyDurationMap.set(dayKey, durationBucket);
    }
  }

  const averageTimeMinutes =
    sessionDurationsMinutes.length > 0
      ? Number(
          (
            sessionDurationsMinutes.reduce((sum, duration) => sum + duration, 0) /
            sessionDurationsMinutes.length
          ).toFixed(1)
        )
      : null;

  const hotspotInteractionCounts = Array.from(hotspotSummaries.values()).sort((left, right) => {
    if (right.interactions !== left.interactions) {
      return right.interactions - left.interactions;
    }

    return left.hotspotTitle.localeCompare(right.hotspotTitle);
  });

  const topHotspot = hotspotInteractionCounts[0] ?? null;

  const sceneReach: ProjectAnalyticsSceneReach[] =
    projectData?.scenes.map((scene, index) => {
      const reachedSessions = sceneSessionMap.get(scene.id)?.size ?? 0;
      return {
        sceneId: scene.id,
        sceneName: formatSceneLabel(scene),
        sessionsReached: reachedSessions,
        reachRate: toPercentage(reachedSessions, totalSessions),
        thumbnailUrl: scene.panoramaUrl?.trim() || null,
        order: index
      };
    }) ??
    Array.from(sceneSessionMap.entries()).map(([sceneId, reachedSessions], index) => ({
      sceneId,
      sceneName: formatSceneLabel(null, sortedEvents.find((event) => event.scene_id === sceneId)?.scene_name ?? null),
      sessionsReached: reachedSessions.size,
      reachRate: toPercentage(reachedSessions.size, totalSessions),
      thumbnailUrl: null,
      order: index
    }));

  const deviceUsage: ProjectAnalyticsDeviceUsage[] = Array.from(deviceCounts.entries())
    .map(([deviceType, count]) => ({
      deviceType,
      count,
      percentage: toPercentage(count, totalSessions)
    }))
    .sort((left, right) => right.count - left.count);

  const dailySessions: ProjectAnalyticsDailyMetric[] = Array.from(dailySessionMap.entries())
    .map(([date, sessionIds]) => ({
      date,
      value: sessionIds.size
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const dailyAverageTime: ProjectAnalyticsDailyMetric[] = Array.from(dailySessionMap.keys())
    .map((date) => {
      const durations = dailyDurationMap.get(date) ?? [];
      return {
        date,
        value:
          durations.length > 0
            ? Number((durations.reduce((sum, duration) => sum + duration, 0) / durations.length).toFixed(1))
            : null
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    totalSessions,
    totalEvents: sortedEvents.length,
    averageTimeMinutes,
    completionRate: toPercentage(totalCompletions, totalSessions),
    totalCompletions,
    topHotspot,
    hotspotInteractionCounts,
    sceneReach,
    deviceUsage,
    reflectionCount: reflections.length,
    recentReflections: reflections
      .sort((left, right) => {
        const leftTime = getValidTimestamp(left.createdAt) ?? 0;
        const rightTime = getValidTimestamp(right.createdAt) ?? 0;
        return rightTime - leftTime;
      })
      .slice(0, 5),
    dailySessions,
    dailyAverageTime,
    uniqueHotspotsInteracted: hotspotInteractionCounts.length
  };
}
