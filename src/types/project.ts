export type HotspotType = 'info' | 'sceneLink' | 'externalLink' | 'image';

export type Hotspot = {
  id: string;
  type: HotspotType;
  title: string;
  body: string;
  yaw: number;
  pitch: number;
  targetSceneId?: string;
  url?: string;
  imageUrl?: string;
};

export type Scene = {
  id: string;
  name: string;
  panoramaUrl: string;
  hotspots: Hotspot[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  authorOrOrganization?: string;
  scenes: Scene[];
  activeSceneId: string;
};
