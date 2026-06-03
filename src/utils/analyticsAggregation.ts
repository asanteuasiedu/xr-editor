import type {
  ProjectAnalyticsDailyMetric,
  ProjectAnalyticsDeviceUsage,
  ProjectAnalyticsEvent,
  ProjectAnalyticsHeatmapPoint,
  ProjectAnalyticsHotspotSummary,
  ProjectAnalyticsReflectionSummary,
  ProjectAnalyticsSceneReach,
  ProjectAnalyticsSummary
} from '../types/analytics';
import type { Hotspot, HotspotPolygonPoint, Project, Scene } from '../types/project';

type SessionEventGroup = {
  sessionId: string;
  events: ProjectAnalyticsEvent[];
};

type HeatmapAccumulator = {
  hotspotId: string | null;
  hotspotTitle: string;
  hotspotType: string | null;
  sceneId: string | null;
  sceneName: string;
  yaw: number;
  pitch: number;
  polygonPoints?: HotspotPolygonPoint[] | null;
  interactionCount: number;
  completionCount: number;
};

type EventMetadataCoordinates = {
  yaw: number | null;
  pitch: number | null;
  polygonPoints?: HotspotPolygonPoint[] | null;
  sceneId?: string | null;
  sceneName?: string | null;
  reflectionPrompt?: string | null;
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

function parseOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePolygonPoints(value: unknown): HotspotPolygonPoint[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const yaw = parseOptionalNumber((entry as { yaw?: unknown }).yaw);
      const pitch = parseOptionalNumber((entry as { pitch?: unknown }).pitch);

      if (yaw === null || pitch === null) {
        return null;
      }

      return { yaw, pitch };
    })
    .filter((entry): entry is HotspotPolygonPoint => Boolean(entry));

  return points.length > 0 ? points : null;
}

function getEventMetadataCoordinates(event: ProjectAnalyticsEvent): EventMetadataCoordinates {
  const metadata = event.metadata;

  if (!metadata || typeof metadata !== 'object') {
    return {
      yaw: null,
      pitch: null,
      polygonPoints: null,
      sceneId: null,
      sceneName: null,
      reflectionPrompt: null
    };
  }

  return {
    yaw: parseOptionalNumber(metadata.yaw),
    pitch: parseOptionalNumber(metadata.pitch),
    polygonPoints: parsePolygonPoints(metadata.polygonPoints),
    sceneId: typeof metadata.sceneId === 'string' ? metadata.sceneId : null,
    sceneName: typeof metadata.sceneName === 'string' ? metadata.sceneName : null,
    reflectionPrompt: typeof metadata.reflectionPrompt === 'string' ? metadata.reflectionPrompt : null
  };
}

function getHeatmapIntensity(interactionCount: number, maxInteractionCount: number): ProjectAnalyticsHeatmapPoint['intensity'] {
  if (maxInteractionCount <= 1) {
    return interactionCount >= 1 ? 'medium' : 'low';
  }

  const ratio = interactionCount / maxInteractionCount;
  if (ratio >= 0.7) {
    return 'high';
  }

  if (ratio >= 0.35) {
    return 'medium';
  }

  return 'low';
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
  const sceneViewSessionMap = new Map<string, Set<string>>();
  const sceneFallbackSessionMap = new Map<string, Set<string>>();
  const deviceCounts = new Map<string, number>();
  const dailySessionMap = new Map<string, Set<string>>();
  const dailyDurationMap = new Map<string, number[]>();
  const reflections: ProjectAnalyticsReflectionSummary[] = [];
  const heatmapPoints = new Map<string, HeatmapAccumulator>();

  const scenesById = new Map(projectData?.scenes.map((scene) => [scene.id, scene]) ?? []);
  const hotspotSceneById = new Map<string, Scene>();
  const hotspotsById = new Map<string, Hotspot>();

  for (const scene of projectData?.scenes ?? []) {
    for (const hotspot of scene.hotspots) {
      hotspotSceneById.set(hotspot.id, scene);
      hotspotsById.set(hotspot.id, hotspot);
    }
  }

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
      const fallbackSceneSessions = sceneFallbackSessionMap.get(event.scene_id) ?? new Set<string>();
      fallbackSceneSessions.add(event.session_id);
      sceneFallbackSessionMap.set(event.scene_id, fallbackSceneSessions);

      if (event.event_type === 'scene_view') {
        const viewedSceneSessions = sceneViewSessionMap.get(event.scene_id) ?? new Set<string>();
        viewedSceneSessions.add(event.session_id);
        sceneViewSessionMap.set(event.scene_id, viewedSceneSessions);
      }
    }

    if (event.hotspot_id) {
      const sourceHotspot = hotspotsById.get(event.hotspot_id);
      const sourceScene = hotspotSceneById.get(event.hotspot_id) ?? (event.scene_id ? scenesById.get(event.scene_id) : undefined);
      const existing = hotspotSummaries.get(event.hotspot_id) ?? {
        hotspotId: event.hotspot_id,
        hotspotTitle: event.hotspot_title?.trim() || formatHotspotLabel(sourceHotspot),
        hotspotType: event.hotspot_type ?? sourceHotspot?.type ?? null,
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

      const metadataCoordinates = getEventMetadataCoordinates(event);
      const yaw = metadataCoordinates.yaw ?? sourceHotspot?.yaw ?? null;
      const pitch = metadataCoordinates.pitch ?? sourceHotspot?.pitch ?? null;
      const polygonPoints = metadataCoordinates.polygonPoints ?? sourceHotspot?.polygonPoints ?? null;

      if (yaw !== null && pitch !== null && (isOpen || isCompletion)) {
        const currentPoint = heatmapPoints.get(event.hotspot_id) ?? {
          hotspotId: event.hotspot_id,
          hotspotTitle: existing.hotspotTitle,
          hotspotType: existing.hotspotType,
          sceneId: metadataCoordinates.sceneId ?? event.scene_id ?? sourceScene?.id ?? null,
          sceneName: formatSceneLabel(sourceScene, metadataCoordinates.sceneName ?? event.scene_name ?? null),
          yaw,
          pitch,
          polygonPoints,
          interactionCount: 0,
          completionCount: 0
        };

        currentPoint.yaw = yaw;
        currentPoint.pitch = pitch;
        currentPoint.polygonPoints = polygonPoints;
        currentPoint.sceneId = currentPoint.sceneId ?? metadataCoordinates.sceneId ?? event.scene_id ?? sourceScene?.id ?? null;
        currentPoint.sceneName = formatSceneLabel(sourceScene, metadataCoordinates.sceneName ?? event.scene_name ?? null);
        currentPoint.hotspotTitle = existing.hotspotTitle;
        currentPoint.hotspotType = existing.hotspotType;
        currentPoint.interactionCount += 1;
        if (isCompletion) {
          currentPoint.completionCount += 1;
        }

        heatmapPoints.set(event.hotspot_id, currentPoint);
      }
    }

    if (event.event_type === 'reflection_submit' && event.response_text?.trim()) {
      const reflectionHotspot = event.hotspot_id ? hotspotsById.get(event.hotspot_id) : null;
      const reflectionScene = event.scene_id ? scenesById.get(event.scene_id) : event.hotspot_id ? hotspotSceneById.get(event.hotspot_id) : null;
      const metadataCoordinates = getEventMetadataCoordinates(event);

      reflections.push({
        hotspotId: event.hotspot_id ?? null,
        hotspotTitle:
          event.hotspot_title?.trim() ||
          formatHotspotLabel(reflectionHotspot),
        sceneName: formatSceneLabel(reflectionScene, event.scene_name),
        reflectionPrompt:
          metadataCoordinates.reflectionPrompt ??
          reflectionHotspot?.reflectionPrompt?.trim() ??
          null,
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
  const sceneReachSource = sceneViewSessionMap.size > 0 ? sceneViewSessionMap : sceneFallbackSessionMap;

  const sceneReach: ProjectAnalyticsSceneReach[] =
    projectData?.scenes.map((scene, index) => {
      const reachedSessions = sceneReachSource.get(scene.id)?.size ?? 0;
      return {
        sceneId: scene.id,
        sceneName: formatSceneLabel(scene),
        sessionsReached: reachedSessions,
        reachRate: toPercentage(reachedSessions, totalSessions),
        thumbnailUrl: scene.panoramaUrl?.trim() || null,
        order: index
      };
    }) ??
    Array.from(sceneReachSource.entries()).map(([sceneId, reachedSessions], index) => ({
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

  const maxHeatmapCount = Array.from(heatmapPoints.values()).reduce(
    (highest, point) => Math.max(highest, point.interactionCount),
    0
  );

  const normalizedHeatmapPoints: ProjectAnalyticsHeatmapPoint[] = Array.from(heatmapPoints.values())
    .map((point) => ({
      ...point,
      intensity: getHeatmapIntensity(point.interactionCount, maxHeatmapCount),
      intensityValue:
        maxHeatmapCount > 0 ? Number((point.interactionCount / maxHeatmapCount).toFixed(2)) : 0
    }))
    .sort((left, right) => right.interactionCount - left.interactionCount);

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
    reflectionDetails: reflections
      .sort((left, right) => {
        const leftTime = getValidTimestamp(left.createdAt) ?? 0;
        const rightTime = getValidTimestamp(right.createdAt) ?? 0;
        return rightTime - leftTime;
      }),
    recentReflections: reflections
      .sort((left, right) => {
        const leftTime = getValidTimestamp(left.createdAt) ?? 0;
        const rightTime = getValidTimestamp(right.createdAt) ?? 0;
        return rightTime - leftTime;
      })
      .slice(0, 8),
    dailySessions,
    dailyAverageTime,
    uniqueHotspotsInteracted: hotspotInteractionCounts.length,
    heatmapPoints: normalizedHeatmapPoints
  };
}
