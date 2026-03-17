export type SceneLibraryItem = {
  id: string;
  label: string;
  panoramaUrl: string;
};

export const STARTER_SCENE_PANORAMA_URL = '/scene-library/starry-night-moon.jpg';

export const SCENE_LIBRARY_ITEMS: SceneLibraryItem[] = [
  {
    id: 'construction-site',
    label: 'The Construction Site',
    panoramaUrl: '/scene-library/The Construction Site.jpg'
  },
  {
    id: 'village-road',
    label: 'The Village Road',
    panoramaUrl: '/scene-library/The Village Road.jpg'
  },
  {
    id: 'water-processing-plant',
    label: 'The Water Processing Plant',
    panoramaUrl: '/scene-library/The Water Processing Plant.jpg'
  },
  {
    id: 'forge',
    label: 'The Forge',
    panoramaUrl: '/scene-library/The Forge.jpg'
  },
  {
    id: 'refinement-factory',
    label: 'The Refinement Factory',
    panoramaUrl: '/scene-library/The Refinement Factory.jpg'
  },
  {
    id: 'fabrication-lab',
    label: 'The Fabrication Lab',
    panoramaUrl: '/scene-library/The Fabrication Lab.jpg'
  },
  {
    id: 'global-classroom',
    label: 'The Global Classroom',
    panoramaUrl: '/scene-library/The Global Classroom.jpg'
  }
];
