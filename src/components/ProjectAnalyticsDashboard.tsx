import { useCallback, useMemo, useState } from 'react';
import type {
  ProjectAnalyticsDailyMetric,
  ProjectAnalyticsEvent,
  ProjectAnalyticsHeatmapPoint
} from '../types/analytics';
import type { CloudProject } from '../types/cloudProject';
import { aggregateProjectAnalytics } from '../utils/analyticsAggregation';

type ProjectAnalyticsDashboardProps = {
  project: CloudProject;
  events: ProjectAnalyticsEvent[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenProject?: (projectId: string) => void;
};

function formatRangeLabel(events: ProjectAnalyticsEvent[]) {
  if (events.length === 0) {
    return 'All activity';
  }

  const timestamps = events
    .map((event) => event.created_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  if (timestamps.length === 0) {
    return 'All activity';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium'
  });

  const start = formatter.format(timestamps[0]);
  const end = formatter.format(timestamps[timestamps.length - 1]);
  return start === end ? start : `${start} - ${end}`;
}

function formatMinutes(value: number | null) {
  if (value === null) {
    return '—';
  }

  if (value < 1) {
    return '< 1 min';
  }

  return `${value.toFixed(1)} min`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function buildSparklinePath(points: ProjectAnalyticsDailyMetric[]) {
  const values = points.map((point) => point.value ?? 0);
  const maxValue = Math.max(...values, 1);

  return points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 100 - (((point.value ?? 0) / maxValue) * 100);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function downloadAnalyticsCsv(project: CloudProject, events: ProjectAnalyticsEvent[]) {
  const headers = ['event_type', 'session_id', 'scene_name', 'hotspot_title', 'created_at', 'response_text'];
  const rows = events.map((event) =>
    [
      event.event_type,
      event.session_id,
      event.scene_name ?? '',
      event.hotspot_title ?? '',
      event.created_at ?? '',
      event.response_text ?? ''
    ]
      .map(escapeCsvValue)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = (project.title || 'xr-project').trim().replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();

  link.href = url;
  link.download = `${fileName || 'xr-project'}-analytics.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getHeatmapBlobStyle(point: ProjectAnalyticsHeatmapPoint) {
  const left = ((point.yaw + 180) / 360) * 100;
  const top = ((90 - point.pitch) / 180) * 100;
  const size = 72 + point.intensityValue * 110;
  const opacity = 0.24 + point.intensityValue * 0.58;

  return {
    left: `${Math.min(100, Math.max(0, left))}%`,
    top: `${Math.min(100, Math.max(0, top))}%`,
    width: `${size}px`,
    height: `${size}px`,
    opacity
  };
}

function ProjectAnalyticsDashboard({
  project,
  events,
  loading = false,
  error = null,
  onClose,
  onRefresh,
  onOpenProject
}: ProjectAnalyticsDashboardProps) {
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const summary = useMemo(
    () => aggregateProjectAnalytics(events, project.project_data),
    [events, project.project_data]
  );
  const rangeLabel = useMemo(() => formatRangeLabel(events), [events]);
  const sessionsSparkline = useMemo(() => buildSparklinePath(summary.dailySessions), [summary.dailySessions]);
  const timeSparkline = useMemo(() => buildSparklinePath(summary.dailyAverageTime), [summary.dailyAverageTime]);
  const emptyState = !loading && !error && events.length === 0;
  const activeScene = useMemo(
    () =>
      project.project_data.scenes.find((scene) => scene.id === project.project_data.activeSceneId) ??
      project.project_data.scenes[0] ??
      null,
    [project.project_data]
  );
  const heatmapPoints = useMemo(() => {
    if (!activeScene) {
      return summary.heatmapPoints;
    }

    const activeScenePoints = summary.heatmapPoints.filter((point) => point.sceneId === activeScene.id);
    return activeScenePoints.length > 0 ? activeScenePoints : summary.heatmapPoints;
  }, [activeScene, summary.heatmapPoints]);
  const handleExportCsv = useCallback(() => {
    if (events.length === 0) {
      return;
    }

    downloadAnalyticsCsv(project, events);
  }, [events, project]);

  return (
    <div
      className="auth-modal-backdrop analytics-dashboard-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title || 'Project'} analytics dashboard`}
      onClick={onClose}
    >
      <div className="analytics-dashboard" onClick={(event) => event.stopPropagation()}>
        <header className="analytics-dashboard-header">
          <div className="analytics-dashboard-heading">
            <p className="analytics-dashboard-kicker">Analytics</p>
            <h2>{project.title || 'Untitled XR Project'}</h2>
            <p className="analytics-dashboard-range">{rangeLabel}</p>
          </div>
          <div className="analytics-dashboard-toolbar">
            <button
              type="button"
              className="ui-button ui-button-secondary mini-button"
              onClick={onRefresh}
              disabled={loading || !onRefresh}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary mini-button"
              onClick={handleExportCsv}
              disabled={events.length === 0}
            >
              Export CSV
            </button>
            <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="analytics-dashboard-grid">
          <section className="analytics-hero-card">
            <div className="analytics-hero-media">
              {project.thumbnail_url ? (
                <img src={project.thumbnail_url} alt={project.title || 'Project preview'} />
              ) : (
                <div className="analytics-hero-placeholder" aria-hidden="true">
                  <span>360</span>
                </div>
              )}
              <div className="analytics-heatmap-layer" aria-hidden="true">
                {heatmapPoints.map((point) => (
                  <span
                    key={`${point.hotspotId ?? point.hotspotTitle}-${point.sceneId ?? 'scene'}`}
                    className={`analytics-heatmap-blob analytics-heatmap-blob-${point.intensity}`}
                    style={getHeatmapBlobStyle(point)}
                    title={`${point.hotspotTitle}: ${point.interactionCount} interactions`}
                  />
                ))}
              </div>
              <div className="analytics-hero-overlay" />
              <div className="analytics-hero-copy">
                <span
                  className={`profile-experience-status profile-experience-status-${
                    project.status === 'published' ? 'published' : 'draft'
                  }`}
                >
                  {project.status === 'published' ? 'Published' : 'Draft'}
                </span>
                <h3>{project.title || 'Untitled XR Project'}</h3>
                <p>
                  {project.description?.trim() ||
                    'Track how learners move through scenes, interact with insight zones, and complete reflective activities.'}
                </p>
              </div>
            </div>
            <div className="analytics-hero-actions">
              <button
                type="button"
                className="ui-button ui-button-primary mini-button"
                onClick={() => onOpenProject?.(project.id)}
              >
                Open in Editor
              </button>
              <div className="analytics-hero-meta">
                <span>{summary.totalEvents} tracked event{summary.totalEvents === 1 ? '' : 's'}</span>
                <span>{summary.uniqueHotspotsInteracted} active zone{summary.uniqueHotspotsInteracted === 1 ? '' : 's'}</span>
              </div>
            </div>
          </section>

          <section className="analytics-metric-card">
            <p className="analytics-card-label">Sessions</p>
            <strong>{summary.totalSessions}</strong>
            <span>Unique preview sessions recorded</span>
          </section>
          <section className="analytics-metric-card">
            <p className="analytics-card-label">Average Time</p>
            <strong>{formatMinutes(summary.averageTimeMinutes)}</strong>
            <span>Estimated from first to last event in each session</span>
          </section>
          <section className="analytics-metric-card">
            <p className="analytics-card-label">Completion Rate</p>
            <strong>{summary.completionRate.toFixed(1)}%</strong>
            <span>{summary.totalCompletions} completed session{summary.totalCompletions === 1 ? '' : 's'}</span>
          </section>
          <section className="analytics-metric-card">
            <p className="analytics-card-label">Top Insight Zone</p>
            <strong>{summary.topHotspot?.hotspotTitle ?? 'No top insight zone yet'}</strong>
            <span>
              {summary.topHotspot
                ? `${summary.topHotspot.interactions} tracked interactions`
                : 'Preview or share this experience to begin collecting analytics.'}
            </span>
          </section>

          {loading ? (
            <section className="analytics-section-card analytics-section-wide">
              <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
                Loading analytics for this project...
              </p>
            </section>
          ) : null}

          {error ? (
            <section className="analytics-section-card analytics-section-wide">
              <p className="auth-modal-status auth-modal-status-error" role="status" aria-live="polite">
                {error}
              </p>
            </section>
          ) : null}

          {emptyState ? (
            <section className="analytics-section-card analytics-section-wide analytics-empty-state">
              <h3>No learner activity has been recorded for this experience yet.</h3>
              <p>Preview or share this experience to begin collecting analytics.</p>
            </section>
          ) : null}

          <section className="analytics-section-card analytics-section-wide">
            <div className="analytics-section-header">
              <div>
                <p className="analytics-card-label">Engagement Over Time</p>
                <h3>Sessions by day</h3>
              </div>
              <span className="analytics-section-note">Average time is shown as a companion trend line.</span>
            </div>
            {summary.dailySessions.length > 0 ? (
              <div className="analytics-chart-grid">
                <div className="analytics-chart-card">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="analytics-sparkline" aria-hidden="true">
                    <path d={sessionsSparkline} />
                  </svg>
                  <div className="analytics-chart-labels">
                    {summary.dailySessions.map((point) => (
                      <div key={point.date}>
                        <strong>{point.value ?? 0}</strong>
                        <span>{formatDayLabel(point.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="analytics-chart-card">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="analytics-sparkline analytics-sparkline-secondary"
                    aria-hidden="true"
                  >
                    <path d={timeSparkline} />
                  </svg>
                  <div className="analytics-chart-labels">
                    {summary.dailyAverageTime.map((point) => (
                      <div key={point.date}>
                        <strong>{point.value !== null ? `${point.value.toFixed(1)}m` : '—'}</strong>
                        <span>{formatDayLabel(point.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="analytics-empty-inline">No time-based activity is available yet.</p>
            )}
          </section>

          <section className="analytics-section-card">
            <div className="analytics-section-header">
              <div>
                <p className="analytics-card-label">Insight Zone Interactions</p>
                <h3>Top interactions</h3>
              </div>
            </div>
            {summary.hotspotInteractionCounts.length > 0 ? (
              <ul className="analytics-ranked-list">
                {summary.hotspotInteractionCounts.slice(0, 6).map((hotspot) => (
                  <li key={hotspot.hotspotId ?? hotspot.hotspotTitle}>
                    <div>
                      <strong>{hotspot.hotspotTitle}</strong>
                      <span>{hotspot.hotspotType ?? 'insight zone'}</span>
                    </div>
                    <div className="analytics-list-metric">
                      <strong>{hotspot.interactions}</strong>
                      <span>{hotspot.completions} completions</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analytics-empty-inline">No hotspot interactions yet.</p>
            )}
          </section>

          <section className="analytics-section-card">
            <div className="analytics-section-header">
              <div>
                <p className="analytics-card-label">Device Usage</p>
                <h3>Session mix</h3>
              </div>
            </div>
            {summary.deviceUsage.length > 0 ? (
              <ul className="analytics-device-list">
                {summary.deviceUsage.map((device) => (
                  <li key={device.deviceType}>
                    <div className="analytics-device-copy">
                      <strong>{device.deviceType}</strong>
                      <span>{device.count} session{device.count === 1 ? '' : 's'}</span>
                    </div>
                    <strong>{device.percentage.toFixed(1)}%</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analytics-empty-inline">No device data recorded yet.</p>
            )}
          </section>

          <section className="analytics-section-card analytics-section-wide">
            <div className="analytics-section-header">
              <div>
                <p className="analytics-card-label">Learning Pathway</p>
                <h3>Scene reach</h3>
              </div>
              <span className="analytics-section-note">Percentages are based on sessions that reached each scene.</span>
            </div>
            {summary.sceneReach.length > 0 ? (
              <div className="analytics-scene-grid">
                {summary.sceneReach.map((scene) => (
                  <article key={scene.sceneId} className="analytics-scene-card">
                    <div className="analytics-scene-thumb">
                      {scene.thumbnailUrl ? (
                        <img src={scene.thumbnailUrl} alt={scene.sceneName} />
                      ) : (
                        <div className="analytics-scene-thumb-placeholder" aria-hidden="true">
                          {scene.order + 1}
                        </div>
                      )}
                    </div>
                    <div className="analytics-scene-copy">
                      <strong>{scene.sceneName}</strong>
                      <span>{scene.sessionsReached} session{scene.sessionsReached === 1 ? '' : 's'} reached this scene</span>
                      <div className="analytics-scene-progress" aria-hidden="true">
                        <div style={{ width: `${scene.reachRate}%` }} />
                      </div>
                      <span>{scene.reachRate.toFixed(1)}% reached</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="analytics-empty-inline">Scene reach will appear after learners start moving through the experience.</p>
            )}
          </section>

          <section className="analytics-section-card">
            <div className="analytics-section-header">
              <div>
                <p className="analytics-card-label">Reflection Points</p>
                <h3>Written responses</h3>
              </div>
              <div className="analytics-reflection-actions">
                <span className="analytics-stat-chip">{summary.reflectionCount}</span>
                <button
                  type="button"
                  className="ui-button ui-button-secondary mini-button"
                  onClick={() => setIsReflectionModalOpen(true)}
                  disabled={summary.reflectionDetails.length === 0}
                >
                  View reflections
                </button>
              </div>
            </div>
            {summary.recentReflections.length > 0 ? (
              <ul className="analytics-reflection-list">
                {summary.recentReflections.slice(0, 3).map((reflection) => (
                  <li key={`${reflection.hotspotId ?? reflection.hotspotTitle}-${reflection.createdAt}`}>
                    <div>
                      <strong>{reflection.hotspotTitle}</strong>
                      <span>{reflection.sceneName}</span>
                    </div>
                    {reflection.reflectionPrompt ? (
                      <p className="analytics-reflection-prompt">{reflection.reflectionPrompt}</p>
                    ) : null}
                    <p>{reflection.responseText}</p>
                    <time>{formatDateTime(reflection.createdAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analytics-empty-inline">No reflection submissions have been recorded yet.</p>
            )}
          </section>

          <section className="analytics-section-card">
            <div className="analytics-section-header">
              <div>
                <p className="analytics-card-label">Heatmap</p>
                <h3>Engagement legend</h3>
              </div>
            </div>
            <div className="analytics-heatmap-gradient" aria-hidden="true" />
            <div className="analytics-heatmap-scale">
              <span>Low Engagement</span>
              <span>High Engagement</span>
            </div>
            <p className="analytics-section-note">
              Warmer colors indicate areas with higher interaction and focus. Positions are approximated from hotspot yaw and pitch on the flattened scene preview.
            </p>
          </section>
        </div>

        {isReflectionModalOpen ? (
          <div className="analytics-reflection-modal-backdrop" role="presentation" onClick={() => setIsReflectionModalOpen(false)}>
            <div
              className="analytics-reflection-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Reflection responses"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="analytics-reflection-modal-header">
                <div>
                  <p className="analytics-card-label">Reflection Details</p>
                  <h3>Submitted learner reflections</h3>
                </div>
                <button
                  type="button"
                  className="ui-button ui-button-secondary mini-button"
                  onClick={() => setIsReflectionModalOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="analytics-reflection-modal-list">
                {summary.reflectionDetails.map((reflection) => (
                  <article
                    key={`${reflection.hotspotId ?? reflection.hotspotTitle}-${reflection.createdAt}`}
                    className="analytics-reflection-detail-card"
                  >
                    <div className="analytics-reflection-detail-top">
                      <div>
                        <strong>{reflection.hotspotTitle}</strong>
                        <span>{reflection.sceneName}</span>
                      </div>
                      <time>{formatDateTime(reflection.createdAt)}</time>
                    </div>
                    {reflection.reflectionPrompt ? (
                      <p className="analytics-reflection-prompt">{reflection.reflectionPrompt}</p>
                    ) : null}
                    <p>{reflection.responseText}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ProjectAnalyticsDashboard;
