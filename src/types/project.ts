export type HotspotType = 'info' | 'sceneLink' | 'externalLink' | 'image' | 'multipleChoice';
export type SceneMediaType = 'image';

export type ZoneType = 'information' | 'media' | 'question' | 'navigation' | 'externalResource';
export type ZoneIntent = 'observe' | 'reflect' | 'identify' | 'compare' | 'answer' | 'discover' | 'navigate';
export type ZoneDifficulty = 'introductory' | 'developing' | 'challenging';
export type ZoneInteractionType = 'read' | 'viewImage' | 'answerQuestion' | 'navigateScene' | 'openExternalResource';
export type ZoneCompletionLogic = 'viewed' | 'answered' | 'answeredCorrectly' | 'opened' | 'navigated';
export type FeedbackRewardState = {
  rewardType: 'none' | 'acknowledgement' | 'points' | 'badge';
  message?: string;
  points?: number;
  badgeId?: string;
};

export type HotspotLearningMetadata = {
  zoneType: ZoneType;
  zoneIntent: ZoneIntent;
  difficulty: ZoneDifficulty;
  interactionType: ZoneInteractionType;
  completionLogic: ZoneCompletionLogic;
  feedbackRewardState: FeedbackRewardState;
};

export type Hotspot = HotspotLearningMetadata & {
  id: string;
  type: HotspotType;
  title: string;
  body: string;
  yaw: number;
  pitch: number;
  targetSceneId?: string;
  url?: string;
  imageUrl?: string;
  questionPrompt?: string;
  answerOptions?: string[];
  correctAnswerIndex?: number;
  feedbackText?: string;
};

export type Scene = {
  id: string;
  name: string;
  mediaType: SceneMediaType;
  panoramaUrl: string;
  hotspots: Hotspot[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  authorOrOrganization?: string;
  projectObjective?: string;
  targetAgeOrGradeBand?: string;
  subjectOrDomain?: string;
  scenes: Scene[];
  activeSceneId: string;
};

export function getDefaultZoneMetadata(type: HotspotType): HotspotLearningMetadata {
  if (type === 'sceneLink') {
    return {
      zoneType: 'navigation',
      zoneIntent: 'navigate',
      difficulty: 'introductory',
      interactionType: 'navigateScene',
      completionLogic: 'navigated',
      feedbackRewardState: { rewardType: 'none' }
    };
  }

  if (type === 'externalLink') {
    return {
      zoneType: 'externalResource',
      zoneIntent: 'discover',
      difficulty: 'introductory',
      interactionType: 'openExternalResource',
      completionLogic: 'opened',
      feedbackRewardState: { rewardType: 'none' }
    };
  }

  if (type === 'image') {
    return {
      zoneType: 'media',
      zoneIntent: 'discover',
      difficulty: 'introductory',
      interactionType: 'viewImage',
      completionLogic: 'viewed',
      feedbackRewardState: { rewardType: 'acknowledgement', message: 'Image insight viewed.' }
    };
  }

  if (type === 'multipleChoice') {
    return {
      zoneType: 'question',
      zoneIntent: 'answer',
      difficulty: 'developing',
      interactionType: 'answerQuestion',
      completionLogic: 'answeredCorrectly',
      feedbackRewardState: { rewardType: 'acknowledgement', message: 'Question completed.' }
    };
  }

  return {
    zoneType: 'information',
    zoneIntent: 'observe',
    difficulty: 'introductory',
    interactionType: 'read',
    completionLogic: 'viewed',
    feedbackRewardState: { rewardType: 'acknowledgement', message: 'Insight viewed.' }
  };
}
