import type { Project } from '../types/project';
import { validateProjectData } from './validation';

const LOCAL_DRAFT_KEY = 'xr-editor.local-draft.v1';

export type LocalDraftLoadResult =
  | { restored: false; project: null }
  | { restored: true; project: Project };

export function loadLocalDraft(): LocalDraftLoadResult {
  if (typeof window === 'undefined') {
    return { restored: false, project: null };
  }

  const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
  if (!raw) {
    return { restored: false, project: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = validateProjectData(parsed);
    if (!validated.ok) {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
      return { restored: false, project: null };
    }

    return { restored: true, project: validated.value };
  } catch {
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    return { restored: false, project: null };
  }
}

export function saveLocalDraft(project: Project): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDraft(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LOCAL_DRAFT_KEY);
}
