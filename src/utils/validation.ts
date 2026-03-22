import type { Hotspot, Project, Scene } from '../types/project';

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function validateHotspot(value: unknown, sceneIndex: number, hotspotIndex: number): ValidationResult<Hotspot> {
  if (!isObject(value)) {
    return { ok: false, error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: expected object.` };
  }

  if (typeof value.id !== 'string' || value.id.trim() === '') {
    return { ok: false, error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: missing valid id.` };
  }

  if (typeof value.title !== 'string') {
    return { ok: false, error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: missing title.` };
  }

  if (typeof value.body !== 'string') {
    return { ok: false, error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: missing body.` };
  }

  if (!isNumber(value.yaw) || !isNumber(value.pitch)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: yaw and pitch must be numbers.`
    };
  }

  const type = value.type === undefined ? 'info' : value.type;
  if (
    type !== 'info' &&
    type !== 'sceneLink' &&
    type !== 'externalLink' &&
    type !== 'image' &&
    type !== 'multipleChoice'
  ) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: type must be info, sceneLink, externalLink, image, or multipleChoice.`
    };
  }

  const targetSceneId = value.targetSceneId;
  const url = value.url;
  const imageUrl = value.imageUrl;
  const questionPrompt = value.questionPrompt;
  const answerOptions = value.answerOptions;
  const correctAnswerIndex = value.correctAnswerIndex;
  const feedbackText = value.feedbackText;

  if (targetSceneId !== undefined && !isNonEmptyString(targetSceneId)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: targetSceneId must be a non-empty string if provided.`
    };
  }

  if (url !== undefined && !isNonEmptyString(url)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: url must be a non-empty string if provided.`
    };
  }

  if (imageUrl !== undefined && !isNonEmptyString(imageUrl)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: imageUrl must be a non-empty string if provided.`
    };
  }

  if (questionPrompt !== undefined && !isNonEmptyString(questionPrompt)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: questionPrompt must be a non-empty string if provided.`
    };
  }

  if (feedbackText !== undefined && typeof feedbackText !== 'string') {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: feedbackText must be a string if provided.`
    };
  }

  if (answerOptions !== undefined) {
    if (!Array.isArray(answerOptions)) {
      return {
        ok: false,
        error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: answerOptions must be an array if provided.`
      };
    }

    if (
      answerOptions.length < 2 ||
      answerOptions.length > 4 ||
      answerOptions.some((option) => !isNonEmptyString(option))
    ) {
      return {
        ok: false,
        error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: answerOptions must contain 2 to 4 non-empty strings.`
      };
    }
  }

  if (
    correctAnswerIndex !== undefined &&
    (!Number.isInteger(correctAnswerIndex) || Number(correctAnswerIndex) < 0)
  ) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: correctAnswerIndex must be a non-negative integer if provided.`
    };
  }

  if (type === 'sceneLink' && !isNonEmptyString(targetSceneId)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: sceneLink hotspots require targetSceneId.`
    };
  }

  if (type === 'externalLink' && !isNonEmptyString(url)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: externalLink hotspots require url.`
    };
  }

  if (type === 'image' && !isNonEmptyString(imageUrl)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: image hotspots require imageUrl.`
    };
  }

  if (type === 'multipleChoice') {
    if (!isNonEmptyString(questionPrompt)) {
      return {
        ok: false,
        error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: multipleChoice hotspots require questionPrompt.`
      };
    }

    if (
      !Array.isArray(answerOptions) ||
      answerOptions.length < 2 ||
      answerOptions.length > 4 ||
      answerOptions.some((option) => !isNonEmptyString(option))
    ) {
      return {
        ok: false,
        error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: multipleChoice hotspots require 2 to 4 non-empty answerOptions.`
      };
    }

    if (
      !Number.isInteger(correctAnswerIndex) ||
      Number(correctAnswerIndex) < 0 ||
      Number(correctAnswerIndex) >= answerOptions.length
    ) {
      return {
        ok: false,
        error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: multipleChoice hotspots require a valid correctAnswerIndex.`
      };
    }
  }

  const validatedAnswerOptions = Array.isArray(answerOptions) ? [...answerOptions] : undefined;
  const validatedCorrectAnswerIndex =
    typeof correctAnswerIndex === 'number' ? correctAnswerIndex : undefined;

  return {
    ok: true,
    value: {
      id: value.id,
      type,
      title: value.title,
      body: value.body,
      yaw: value.yaw,
      pitch: value.pitch,
      targetSceneId: type === 'sceneLink' ? targetSceneId : undefined,
      url: type === 'externalLink' ? url : undefined,
      imageUrl: type === 'image' ? imageUrl : undefined,
      questionPrompt: type === 'multipleChoice' ? questionPrompt : undefined,
      answerOptions: type === 'multipleChoice' ? validatedAnswerOptions : undefined,
      correctAnswerIndex: type === 'multipleChoice' ? validatedCorrectAnswerIndex : undefined,
      feedbackText: type === 'multipleChoice' ? feedbackText : undefined
    }
  };
}

function validateScene(value: unknown, sceneIndex: number): ValidationResult<Scene> {
  if (!isObject(value)) {
    return { ok: false, error: `Scene ${sceneIndex + 1}: expected object.` };
  }

  if (typeof value.id !== 'string' || value.id.trim() === '') {
    return { ok: false, error: `Scene ${sceneIndex + 1}: missing valid id.` };
  }

  if (typeof value.name !== 'string') {
    return { ok: false, error: `Scene ${sceneIndex + 1}: missing name.` };
  }

  // Panorama URL can be a path, http(s) URL, or embedded data URL.
  if (!isNonEmptyString(value.panoramaUrl)) {
    return { ok: false, error: `Scene ${sceneIndex + 1}: missing panoramaUrl.` };
  }

  if (!Array.isArray(value.hotspots)) {
    return { ok: false, error: `Scene ${sceneIndex + 1}: hotspots must be an array.` };
  }

  const hotspots: Hotspot[] = [];
  for (let hotspotIndex = 0; hotspotIndex < value.hotspots.length; hotspotIndex += 1) {
    const checked = validateHotspot(value.hotspots[hotspotIndex], sceneIndex, hotspotIndex);
    if (!checked.ok) {
      return checked;
    }
    hotspots.push(checked.value);
  }

  return {
    ok: true,
    value: {
      id: value.id,
      name: value.name,
      panoramaUrl: value.panoramaUrl,
      hotspots
    }
  };
}

export function validateProjectData(value: unknown): ValidationResult<Project> {
  if (!isObject(value)) {
    return { ok: false, error: 'Project must be a JSON object.' };
  }

  if (typeof value.id !== 'string' || value.id.trim() === '') {
    return { ok: false, error: 'Project is missing a valid id.' };
  }

  if (typeof value.name !== 'string') {
    return { ok: false, error: 'Project is missing name.' };
  }

  if (value.description !== undefined && typeof value.description !== 'string') {
    return { ok: false, error: 'Project description must be a string if provided.' };
  }

  if (value.authorOrOrganization !== undefined && typeof value.authorOrOrganization !== 'string') {
    return { ok: false, error: 'Project authorOrOrganization must be a string if provided.' };
  }

  if (typeof value.activeSceneId !== 'string' || value.activeSceneId.trim() === '') {
    return { ok: false, error: 'Project is missing activeSceneId.' };
  }

  if (!Array.isArray(value.scenes) || value.scenes.length === 0) {
    return { ok: false, error: 'Project scenes must be a non-empty array.' };
  }

  const scenes: Scene[] = [];
  for (let sceneIndex = 0; sceneIndex < value.scenes.length; sceneIndex += 1) {
    const checkedScene = validateScene(value.scenes[sceneIndex], sceneIndex);
    if (!checkedScene.ok) {
      return checkedScene;
    }
    scenes.push(checkedScene.value);
  }

  const sceneIdSet = new Set(scenes.map((scene) => scene.id));
  if (!sceneIdSet.has(value.activeSceneId)) {
    return { ok: false, error: 'activeSceneId does not match any scene id.' };
  }

  for (const scene of scenes) {
    for (const hotspot of scene.hotspots) {
      if (hotspot.targetSceneId === undefined) {
        continue;
      }

      if (hotspot.type !== 'sceneLink') {
        continue;
      }

      if (!sceneIdSet.has(hotspot.targetSceneId)) {
        return {
          ok: false,
          error: `Hotspot "${hotspot.title}" in scene "${scene.name}" references missing targetSceneId "${hotspot.targetSceneId}".`
        };
      }

      if (hotspot.targetSceneId === scene.id) {
        return {
          ok: false,
          error: `Hotspot "${hotspot.title}" in scene "${scene.name}" cannot link to the same scene.`
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      id: value.id,
      name: value.name,
      description: value.description,
      authorOrOrganization: value.authorOrOrganization,
      scenes,
      activeSceneId: value.activeSceneId
    }
  };
}
