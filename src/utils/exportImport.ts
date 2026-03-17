import type { Project } from '../types/project';
import { validateProjectData } from './validation';

export function sanitizeFileBaseName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 80);
}

export function downloadTextFile(fileName: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export function getProjectExportFileName(project: Project) {
  const base = sanitizeFileBaseName(project.name);
  return base ? `${base}.json` : 'project.json';
}

export function exportProjectToJson(project: Project, fileName = getProjectExportFileName(project)) {
  const jsonString = JSON.stringify(project, null, 2);
  downloadTextFile(fileName, jsonString, 'application/json');
}

export async function importProjectFromFile(file: File): Promise<Project> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON syntax. Please select a valid .json file.');
  }

  const validated = validateProjectData(parsed);
  if (!validated.ok) {
    throw new Error(`Invalid project structure: ${validated.error}`);
  }

  return validated.value;
}
