const ANALYTICS_SESSION_STORAGE_PREFIX = 'xr-editor.analytics-session';

function getAnalyticsSessionStorageKey(projectId: string) {
  return `${ANALYTICS_SESSION_STORAGE_PREFIX}.${projectId}`;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function getOrCreateAnalyticsSessionId(projectId: string): string {
  if (typeof window === 'undefined' || !projectId.trim()) {
    return createSessionId();
  }

  const storageKey = getAnalyticsSessionStorageKey(projectId);
  const existing = window.sessionStorage.getItem(storageKey)?.trim();

  if (existing) {
    return existing;
  }

  const nextId = createSessionId();
  window.sessionStorage.setItem(storageKey, nextId);
  return nextId;
}

export function resetAnalyticsSessionId(projectId: string): void {
  if (typeof window === 'undefined' || !projectId.trim()) {
    return;
  }

  window.sessionStorage.removeItem(getAnalyticsSessionStorageKey(projectId));
}

export function getDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (/ipad|tablet|playbook|silk/.test(userAgent)) {
    return 'tablet';
  }

  if (/mobi|iphone|android/.test(userAgent)) {
    return /ipad|tablet/.test(userAgent) ? 'tablet' : 'mobile';
  }

  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
    return 'tablet';
  }

  return 'desktop';
}

export function getBrowserName(): 'Chrome' | 'Safari' | 'Edge' | 'Firefox' | 'unknown' {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const userAgent = navigator.userAgent;

  if (/Edg\//.test(userAgent)) {
    return 'Edge';
  }

  if (/Firefox\//.test(userAgent)) {
    return 'Firefox';
  }

  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) {
    return 'Chrome';
  }

  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent) && !/CriOS\//.test(userAgent)) {
    return 'Safari';
  }

  return 'unknown';
}
