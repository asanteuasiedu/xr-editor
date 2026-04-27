import type { Hotspot, Project, Scene } from '../types/project';
import { getDefaultZoneMetadata } from '../types/project';
import { STARTER_SCENE_PANORAMA_URL } from './sceneLibrary';

export type ProjectTemplateId = 'blankTour' | 'museumExhibit' | 'lessonModule' | 'photoStory';

export type ProjectTemplateOption = {
  id: ProjectTemplateId;
  name: string;
  description: string;
};

export const PROJECT_TEMPLATE_OPTIONS: ProjectTemplateOption[] = [
  {
    id: 'blankTour',
    name: 'Blank Tour',
    description: 'Start with one empty scene and build from scratch.'
  },
  {
    id: 'museumExhibit',
    name: 'Museum Exhibit',
    description: 'Two-room exhibit flow with starter navigation and notes.'
  },
  {
    id: 'lessonModule',
    name: 'Lesson Module',
    description: 'Single teaching scene with example insight hotspots.'
  },
  {
    id: 'photoStory',
    name: 'Photo Story',
    description: 'Three-scene visual story path with optional narration notes.'
  }
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function createScene(name: string, panoramaUrl = ''): Scene {
  return {
    id: makeId('scene'),
    name,
    mediaType: 'image',
    panoramaUrl,
    hotspots: []
  };
}

function createInfoHotspot(title: string, body: string, yaw: number, pitch: number): Hotspot {
  return {
    id: makeId('hotspot'),
    type: 'info',
    ...getDefaultZoneMetadata('info'),
    title,
    body,
    yaw,
    pitch
  };
}

export function createProjectFromTemplate(templateId: ProjectTemplateId): Project {
  const samplePanorama = '/sample-panorama.jpg';

  if (templateId === 'museumExhibit') {
    const lobby = createScene('Exhibit Lobby', samplePanorama);
    const gallery = createScene('Featured Gallery', samplePanorama);

    lobby.hotspots = [
      {
        id: makeId('hotspot'),
        type: 'sceneLink',
        ...getDefaultZoneMetadata('sceneLink'),
        title: 'Enter Gallery',
        body: 'Continue to the featured gallery scene.',
        yaw: 24,
        pitch: -1,
        targetSceneId: gallery.id
      },
      createInfoHotspot('Welcome Desk', 'Introduce visitors to this exhibit and key themes.', -28, 3)
    ];

    gallery.hotspots = [
      {
        id: makeId('hotspot'),
        type: 'sceneLink',
        ...getDefaultZoneMetadata('sceneLink'),
        title: 'Back to Lobby',
        body: 'Return to the lobby scene.',
        yaw: -34,
        pitch: 1,
        targetSceneId: lobby.id
      },
      createInfoHotspot('Featured Piece', 'Add details about your highlighted artwork here.', 42, 7)
    ];

    return {
      id: makeId('project'),
      name: 'Museum Exhibit Tour',
      description: 'A starter museum walkthrough with two connected scenes.',
      authorOrOrganization: 'Museum Team',
      projectObjective: 'Guide learners through a connected exhibit and prompt close observation of featured artifacts.',
      targetAgeOrGradeBand: 'General learners',
      subjectOrDomain: 'Museum education',
      scenes: [lobby, gallery],
      activeSceneId: lobby.id
    };
  }

  if (templateId === 'lessonModule') {
    const lessonScene = createScene('Lesson Overview', samplePanorama);
    lessonScene.hotspots = [
      createInfoHotspot('Learning Goal', 'Describe the primary objective for this lesson.', 8, -2),
      {
        id: makeId('hotspot'),
        type: 'externalLink',
        ...getDefaultZoneMetadata('externalLink'),
        title: 'Reference Material',
        body: 'Open supporting content for students.',
        yaw: -18,
        pitch: 6,
        url: 'https://example.com'
      }
    ];

    return {
      id: makeId('project'),
      name: 'Lesson Module Starter',
      description: 'A teaching-oriented starter scene with sample insights.',
      authorOrOrganization: 'Instructor',
      projectObjective: 'Introduce a topic through an immersive scene with supporting prompts and resources.',
      targetAgeOrGradeBand: 'Grade 6-12',
      subjectOrDomain: 'Interdisciplinary lesson',
      scenes: [lessonScene],
      activeSceneId: lessonScene.id
    };
  }

  if (templateId === 'photoStory') {
    const opening = createScene('Opening Shot', samplePanorama);
    const mid = createScene('Middle Scene', samplePanorama);
    const ending = createScene('Closing Scene', samplePanorama);

    opening.hotspots = [
      {
        id: makeId('hotspot'),
        type: 'sceneLink',
        ...getDefaultZoneMetadata('sceneLink'),
        title: 'Continue Story',
        body: 'Move to the next story scene.',
        yaw: 16,
        pitch: -2,
        targetSceneId: mid.id
      }
    ];

    mid.hotspots = [
      {
        id: makeId('hotspot'),
        type: 'sceneLink',
        ...getDefaultZoneMetadata('sceneLink'),
        title: 'Final Scene',
        body: 'Go to the closing scene.',
        yaw: 21,
        pitch: -1,
        targetSceneId: ending.id
      },
      createInfoHotspot('Narration Note', 'Add your story text or voiceover prompt here.', -26, 8)
    ];

    ending.hotspots = [
      {
        id: makeId('hotspot'),
        type: 'sceneLink',
        ...getDefaultZoneMetadata('sceneLink'),
        title: 'Restart Story',
        body: 'Return to the opening scene.',
        yaw: -30,
        pitch: 2,
        targetSceneId: opening.id
      }
    ];

    return {
      id: makeId('project'),
      name: 'Photo Story Starter',
      description: 'A simple three-scene story arc template.',
      authorOrOrganization: 'Story Team',
      projectObjective: 'Structure a visual story path that asks learners to notice sequence, setting, and perspective.',
      targetAgeOrGradeBand: 'General learners',
      subjectOrDomain: 'Storytelling',
      scenes: [opening, mid, ending],
      activeSceneId: opening.id
    };
  }

  const blankScene = createScene('Scene 1', STARTER_SCENE_PANORAMA_URL);
  return {
    id: makeId('project'),
    name: 'Blank Tour',
    description: 'Start with a starry scene, then upload or swap in your own panorama.',
    authorOrOrganization: '',
    projectObjective: '',
    targetAgeOrGradeBand: '',
    subjectOrDomain: '',
    scenes: [blankScene],
    activeSceneId: blankScene.id
  };
}
