const CLASSROOM_PATH_PREFIX = '/classroom';

export function getClassroomPath(shareSlug: string): string {
  const trimmedSlug = shareSlug.trim();
  if (!trimmedSlug) {
    return CLASSROOM_PATH_PREFIX;
  }

  return `${CLASSROOM_PATH_PREFIX}/${encodeURIComponent(trimmedSlug)}`;
}

export function getClassroomShareUrl(shareSlug: string): string {
  const path = getClassroomPath(shareSlug);

  if (typeof window === 'undefined') {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export function getClassroomSlugFromPath(pathname?: string | null): string | null {
  const normalizedPath =
    typeof pathname === 'string' && pathname.trim()
      ? pathname.trim()
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '';

  const match = normalizedPath.match(/^\/classroom\/([^/]+)\/?$/i);
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}
