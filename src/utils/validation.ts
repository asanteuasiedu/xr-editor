import type {
  FeedbackRewardState,
  Hotspot,
  HotspotPolygonPoint,
  HotspotType,
  Project,
  Scene,
  ZoneCompletionLogic,
  ZoneDifficulty,
  ZoneIntent,
  ZoneInteractionType,
  ZoneType
} from '../types/project';
import {
  DEFAULT_REFLECTION_PLACEHOLDER as DEFAULT_REFLECTION_PLACEHOLDER_VALUE,
  DEFAULT_REFLECTION_PROMPT as DEFAULT_REFLECTION_PROMPT_VALUE,
  getDefaultZoneMetadata
} from '../types/project';

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

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function getPolygonAnchorPosition(points: HotspotPolygonPoint[]) {
  const yaw = points.reduce((sum, point) => sum + point.yaw, 0) / points.length;
  const pitch = points.reduce((sum, point) => sum + point.pitch, 0) / points.length;

  return {
    yaw: Number(yaw.toFixed(2)),
    pitch: Number(pitch.toFixed(2))
  };
}

const zoneTypes: ZoneType[] = ['information', 'media', 'question', 'navigation', 'externalResource'];
const zoneIntents: ZoneIntent[] = ['observe', 'reflect', 'identify', 'compare', 'answer', 'discover', 'navigate'];
const zoneDifficulties: ZoneDifficulty[] = ['introductory', 'developing', 'challenging'];
const zoneInteractionTypes: ZoneInteractionType[] = [
  'read',
  'viewImage',
  'answerQuestion',
  'writeReflection',
  'navigateScene',
  'openExternalResource'
];
const zoneCompletionLogicValues: ZoneCompletionLogic[] = [
  'viewed',
  'answered',
  'answeredCorrectly',
  'submitted',
  'opened',
  'navigated'
];
const rewardTypes: FeedbackRewardState['rewardType'][] = ['none', 'acknowledgement', 'points', 'badge'];

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

function validateFeedbackRewardState(
  value: unknown,
  fallback: FeedbackRewardState,
  sceneIndex: number,
  hotspotIndex: number
): ValidationResult<FeedbackRewardState> {
  if (value === undefined) {
    return { ok: true, value: fallback };
  }

  if (!isObject(value)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: feedbackRewardState must be an object if provided.`
    };
  }

  const rewardType = value.rewardType === undefined ? fallback.rewardType : value.rewardType;
  if (!isOneOf(rewardType, rewardTypes)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: feedbackRewardState.rewardType must be none, acknowledgement, points, or badge.`
    };
  }

  if (value.message !== undefined && typeof value.message !== 'string') {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: feedbackRewardState.message must be a string if provided.`
    };
  }

  if (value.points !== undefined && (!Number.isInteger(value.points) || Number(value.points) < 0)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: feedbackRewardState.points must be a non-negative integer if provided.`
    };
  }

  if (value.badgeId !== undefined && !isNonEmptyString(value.badgeId)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: feedbackRewardState.badgeId must be a non-empty string if provided.`
    };
  }

  return {
    ok: true,
    value: {
      rewardType,
      message: typeof value.message === 'string' ? value.message : fallback.message,
      points: typeof value.points === 'number' ? value.points : fallback.points,
      badgeId: typeof value.badgeId === 'string' ? value.badgeId : fallback.badgeId
    }
  };
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

  const type = (value.type === undefined ? 'info' : value.type) as HotspotType;
  if (
    type !== 'info' &&
    type !== 'sceneLink' &&
    type !== 'externalLink' &&
    type !== 'image' &&
    type !== 'multipleChoice' &&
    type !== 'reflection'
  ) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: type must be info, sceneLink, externalLink, image, multipleChoice, or reflection.`
    };
  }

  const targetSceneId = value.targetSceneId;
  const url = value.url;
  const imageUrl = value.imageUrl;
  const questionPrompt = value.questionPrompt;
  const answerOptions = value.answerOptions;
  const correctAnswerIndex = value.correctAnswerIndex;
  const feedbackText = value.feedbackText;
  const reflectionPrompt = value.reflectionPrompt;
  const reflectionPlaceholder = value.reflectionPlaceholder;
  const shape = value.shape === 'polygon' ? 'polygon' : 'point';
  let polygonPoints: HotspotPolygonPoint[] | undefined;

  if (value.shape !== undefined && value.shape !== 'point' && value.shape !== 'polygon') {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: shape must be point or polygon if provided.`
    };
  }

  if (shape === 'polygon') {
    if (!Array.isArray(value.polygonPoints) || value.polygonPoints.length < 3) {
      return {
        ok: false,
        error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: polygon hotspots require at least 3 polygonPoints.`
      };
    }

    polygonPoints = [];
    for (let pointIndex = 0; pointIndex < value.polygonPoints.length; pointIndex += 1) {
      const point = value.polygonPoints[pointIndex];
      if (!isObject(point) || !isNumber(point.yaw) || !isNumber(point.pitch)) {
        return {
          ok: false,
          error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: polygon point ${pointIndex + 1} must include numeric yaw and pitch.`
        };
      }

      polygonPoints.push({
        yaw: Number(point.yaw.toFixed(2)),
        pitch: Number(point.pitch.toFixed(2))
      });
    }
  }

  const derivedAnchor =
    shape === 'polygon' && polygonPoints ? getPolygonAnchorPosition(polygonPoints) : null;
  const yaw = isNumber(value.yaw) ? value.yaw : derivedAnchor?.yaw;
  const pitch = isNumber(value.pitch) ? value.pitch : derivedAnchor?.pitch;

  if (!isNumber(yaw) || !isNumber(pitch)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: yaw and pitch must be numbers.`
    };
  }

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

  if (reflectionPrompt !== undefined && !isNonEmptyString(reflectionPrompt)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: reflectionPrompt must be a non-empty string if provided.`
    };
  }

  if (reflectionPlaceholder !== undefined && !isNonEmptyString(reflectionPlaceholder)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: reflectionPlaceholder must be a non-empty string if provided.`
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

  const normalizedReflectionPrompt =
    typeof reflectionPrompt === 'string' && reflectionPrompt.trim()
      ? reflectionPrompt.trim()
      : DEFAULT_REFLECTION_PROMPT_VALUE;
  const normalizedReflectionPlaceholder =
    typeof reflectionPlaceholder === 'string' && reflectionPlaceholder.trim()
      ? reflectionPlaceholder.trim()
      : DEFAULT_REFLECTION_PLACEHOLDER_VALUE;

  const validatedAnswerOptions = Array.isArray(answerOptions) ? [...answerOptions] : undefined;
  const validatedCorrectAnswerIndex =
    typeof correctAnswerIndex === 'number' ? correctAnswerIndex : undefined;
  const defaultZoneMetadata = getDefaultZoneMetadata(type);

  if (value.zoneType !== undefined && !isOneOf(value.zoneType, zoneTypes)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: zoneType must be information, media, question, navigation, or externalResource.`
    };
  }

  if (value.zoneIntent !== undefined && !isOneOf(value.zoneIntent, zoneIntents)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: zoneIntent must be observe, reflect, identify, compare, answer, discover, or navigate.`
    };
  }

  if (value.difficulty !== undefined && !isOneOf(value.difficulty, zoneDifficulties)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: difficulty must be introductory, developing, or challenging.`
    };
  }

  if (value.interactionType !== undefined && !isOneOf(value.interactionType, zoneInteractionTypes)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: interactionType must be read, viewImage, answerQuestion, writeReflection, navigateScene, or openExternalResource.`
    };
  }

  if (value.completionLogic !== undefined && !isOneOf(value.completionLogic, zoneCompletionLogicValues)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}, hotspot ${hotspotIndex + 1}: completionLogic must be viewed, answered, answeredCorrectly, submitted, opened, or navigated.`
    };
  }

  const checkedFeedbackRewardState = validateFeedbackRewardState(
    value.feedbackRewardState,
    defaultZoneMetadata.feedbackRewardState,
    sceneIndex,
    hotspotIndex
  );
  if (!checkedFeedbackRewardState.ok) {
    return checkedFeedbackRewardState;
  }
  const zoneType = isOneOf(value.zoneType, zoneTypes) ? value.zoneType : defaultZoneMetadata.zoneType;
  const zoneIntent = isOneOf(value.zoneIntent, zoneIntents) ? value.zoneIntent : defaultZoneMetadata.zoneIntent;
  const difficulty = isOneOf(value.difficulty, zoneDifficulties) ? value.difficulty : defaultZoneMetadata.difficulty;
  const interactionType = isOneOf(value.interactionType, zoneInteractionTypes)
    ? value.interactionType
    : defaultZoneMetadata.interactionType;
  const completionLogic = isOneOf(value.completionLogic, zoneCompletionLogicValues)
    ? value.completionLogic
    : defaultZoneMetadata.completionLogic;

  return {
    ok: true,
    value: {
      id: value.id,
      shape,
      type,
      zoneType,
      zoneIntent,
      difficulty,
      interactionType,
      completionLogic,
      feedbackRewardState: checkedFeedbackRewardState.value,
      title: value.title,
      body: value.body,
      yaw: Number(yaw.toFixed(2)),
      pitch: Number(pitch.toFixed(2)),
      polygonPoints,
      targetSceneId: type === 'sceneLink' ? targetSceneId : undefined,
      url: type === 'externalLink' ? url : undefined,
      imageUrl: type === 'image' ? imageUrl : undefined,
      questionPrompt: type === 'multipleChoice' ? questionPrompt : undefined,
      answerOptions: type === 'multipleChoice' ? validatedAnswerOptions : undefined,
      correctAnswerIndex: type === 'multipleChoice' ? validatedCorrectAnswerIndex : undefined,
      feedbackText: type === 'multipleChoice' ? feedbackText : undefined,
      reflectionPrompt: type === 'reflection' ? normalizedReflectionPrompt : undefined,
      reflectionPlaceholder: type === 'reflection' ? normalizedReflectionPlaceholder : undefined
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

  if (typeof value.panoramaUrl !== 'string') {
    return { ok: false, error: `Scene ${sceneIndex + 1}: panoramaUrl must be a string.` };
  }

  if (value.mediaType !== undefined && value.mediaType !== 'image') {
    return { ok: false, error: `Scene ${sceneIndex + 1}: mediaType must be image.` };
  }

  if (value.aiGenerated !== undefined && typeof value.aiGenerated !== 'boolean') {
    return { ok: false, error: `Scene ${sceneIndex + 1}: aiGenerated must be a boolean if provided.` };
  }

  if (!isOptionalString(value.generationPrompt)) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}: generationPrompt must be a string if provided.`
    };
  }

  if (
    value.generationAttemptCount !== undefined &&
    (!Number.isInteger(value.generationAttemptCount) || Number(value.generationAttemptCount) < 1)
  ) {
    return {
      ok: false,
      error: `Scene ${sceneIndex + 1}: generationAttemptCount must be a positive integer if provided.`
    };
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
      mediaType: 'image',
      panoramaUrl: value.panoramaUrl,
      aiGenerated: typeof value.aiGenerated === 'boolean' ? value.aiGenerated : undefined,
      generationPrompt: typeof value.generationPrompt === 'string' ? value.generationPrompt : undefined,
      generationAttemptCount:
        typeof value.generationAttemptCount === 'number' ? value.generationAttemptCount : undefined,
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

  if (!isOptionalString(value.projectObjective)) {
    return { ok: false, error: 'Project projectObjective must be a string if provided.' };
  }

  if (!isOptionalString(value.targetAgeOrGradeBand)) {
    return { ok: false, error: 'Project targetAgeOrGradeBand must be a string if provided.' };
  }

  if (!isOptionalString(value.subjectOrDomain)) {
    return { ok: false, error: 'Project subjectOrDomain must be a string if provided.' };
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
      projectObjective:
        typeof value.projectObjective === 'string'
          ? value.projectObjective
          : typeof value.description === 'string'
            ? value.description
            : '',
      targetAgeOrGradeBand:
        typeof value.targetAgeOrGradeBand === 'string' ? value.targetAgeOrGradeBand : '',
      subjectOrDomain: typeof value.subjectOrDomain === 'string' ? value.subjectOrDomain : '',
      scenes,
      activeSceneId: value.activeSceneId
    }
  };
}
