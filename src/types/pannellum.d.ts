type TooltipArgs = {
  title: string;
  selected: boolean;
  linked: boolean;
};

type PannellumHotspot = {
  id: string;
  type: 'info';
  yaw: number;
  pitch: number;
  cssClass?: string;
  text?: string;
  clickHandlerFunc?: () => void;
  createTooltipFunc?: (hotSpotDiv: HTMLElement, args: TooltipArgs) => void;
  createTooltipArgs?: TooltipArgs;
};

type PannellumConfig = {
  type: 'equirectangular';
  panorama: string;
  autoLoad?: boolean;
  compass?: boolean;
  hotSpotDebug?: boolean;
  showZoomCtrl?: boolean;
  showFullscreenCtrl?: boolean;
  hotSpots?: PannellumHotspot[];
};

type PannellumViewer = {
  addHotSpot: (hotspot: PannellumHotspot) => void;
  removeHotSpot: (id: string) => void;
  on: (eventName: string, callback: (...args: unknown[]) => void) => void;
  mouseEventToCoords?: (event: MouseEvent) => [number, number];
  getYaw: () => number;
  getPitch: () => number;
  lookAt: (pitch: number, yaw: number, hfov?: number, animated?: number | boolean) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    pannellum: {
      viewer: (container: HTMLElement, config: PannellumConfig) => PannellumViewer;
    };
  }
}

declare module 'pannellum/build/pannellum.js';
declare module 'pannellum/build/pannellum.css';

export {};
