import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';
import type { Hotspot, HotspotPolygonPoint } from '../types/project';

type PanoramaViewerProps = {
  panoramaUrl: string;
  hotspots: Hotspot[];
  selectedHotspotId: string | null;
  activePreviewHotspotId?: string | null;
  visitedPreviewHotspotIds?: string[];
  isPreviewMode?: boolean;
  previewEntryId?: number;
  overlayContent?: ReactNode;
  editorPopoverContent?: ReactNode;
  interactionMode: 'idle' | 'placingNewHotspot' | 'movingExistingHotspot' | 'drawingPolygon';
  drawingPolygonPoints: HotspotPolygonPoint[];
  onActivateHotspot: (hotspotId: string, anchor?: { x: number; y: number }) => void;
  onPanoramaClick: (position: { yaw: number; pitch: number }) => void;
  onQuickPlaceHotspot?: (position: { yaw: number; pitch: number }) => void;
  onToggleOverlays?: () => void;
  onViewChange: (position: { yaw: number; pitch: number }) => void;
};

type ScreenPoint = {
  x: number;
  y: number;
};

type ProjectedPolygon = {
  hotspotId: string;
  points: ScreenPoint[];
  centroid: ScreenPoint;
  isSelected: boolean;
  isVisited: boolean;
  isActivePreview: boolean;
};

// Set true temporarily to compare click-derived coordinates with viewer debug output.
const PANNELLUM_HOTSPOT_DEBUG = false;
const PREVIEW_INTERACTION_DEBUG = false;
const MOBILE_LONG_PRESS_DELAY_MS = 500;
const MOBILE_LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const IDLE_AUTOROTATE_RESUME_DELAY_MS = 5000;
const IDLE_AUTOROTATE_SPEED = -0.35;
const PREVIEW_RIPPLE_DURATION_MS = 980;
const PREVIEW_RIPPLE_POST_LOAD_DELAY_MS = 320;

function getHotspotShape(hotspot: Hotspot) {
  return hotspot.shape === 'polygon' ? 'polygon' : 'point';
}

function doesPolygonCrossSeam(points: HotspotPolygonPoint[]) {
  if (points.length < 3) {
    return false;
  }

  const yaws = points.map((point) => point.yaw);
  return Math.max(...yaws) - Math.min(...yaws) > 180;
}

function getPolygonAnchor(points: ScreenPoint[]) {
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;

  return { x, y };
}

function PanoramaViewer({
  panoramaUrl,
  hotspots,
  selectedHotspotId,
  activePreviewHotspotId = null,
  visitedPreviewHotspotIds = [],
  isPreviewMode = false,
  previewEntryId = 0,
  overlayContent,
  editorPopoverContent,
  interactionMode,
  drawingPolygonPoints,
  onActivateHotspot,
  onPanoramaClick,
  onQuickPlaceHotspot,
  onToggleOverlays,
  onViewChange
}: PanoramaViewerProps) {
  const trimmedPanoramaUrl = panoramaUrl.trim();
  const hasSceneMedia = trimmedPanoramaUrl !== '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const editorPopoverRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ReturnType<typeof window.pannellum.viewer> | null>(null);
  const renderedHotspotIdsRef = useRef<Set<string>>(new Set());
  const pointerDownRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const previousPanoramaUrlRef = useRef<string>('');
  const loadingTimeoutRef = useRef<number | null>(null);
  const onActivateHotspotRef = useRef(onActivateHotspot);
  const onPanoramaClickRef = useRef(onPanoramaClick);
  const onQuickPlaceHotspotRef = useRef(onQuickPlaceHotspot);
  const onToggleOverlaysRef = useRef(onToggleOverlays);
  const onViewChangeRef = useRef(onViewChange);
  const interactionModeRef = useRef(interactionMode);
  const isPreviewModeRef = useRef(isPreviewMode);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTouchRef = useRef<{ x: number; y: number; touchId: number } | null>(null);
  const autoRotateResumeTimeoutRef = useRef<number | null>(null);
  const previewRippleTimeoutRef = useRef<number | null>(null);
  const pendingPreviewRippleEntryRef = useRef<number | null>(null);
  const previewRippleStartDelayRef = useRef<number | null>(null);
  const placementTouchRef = useRef<{ x: number; y: number; touchId: number } | null>(null);
  const projectedPolygonSignatureRef = useRef('');
  const projectedDrawingSignatureRef = useRef('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPanoramaLoading, setIsPanoramaLoading] = useState(false);
  const [isLoadingOverlayVisible, setIsLoadingOverlayVisible] = useState(false);
  const [editorPopoverStyle, setEditorPopoverStyle] = useState<CSSProperties | null>(null);
  const [useEditorPopoverFallback, setUseEditorPopoverFallback] = useState(false);
  const [showPreviewEntryRipple, setShowPreviewEntryRipple] = useState(false);
  const [projectedPolygons, setProjectedPolygons] = useState<ProjectedPolygon[]>([]);
  const [projectedDrawingPoints, setProjectedDrawingPoints] = useState<ScreenPoint[]>([]);

  useEffect(() => {
    onActivateHotspotRef.current = onActivateHotspot;
  }, [onActivateHotspot]);

  useEffect(() => {
    onPanoramaClickRef.current = onPanoramaClick;
  }, [onPanoramaClick]);

  useEffect(() => {
    onQuickPlaceHotspotRef.current = onQuickPlaceHotspot;
  }, [onQuickPlaceHotspot]);

  useEffect(() => {
    onToggleOverlaysRef.current = onToggleOverlays;
  }, [onToggleOverlays]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    isPreviewModeRef.current = isPreviewMode;
  }, [isPreviewMode]);

  useEffect(() => {
    if (!isPreviewMode) {
      setShowPreviewEntryRipple(false);
      pendingPreviewRippleEntryRef.current = null;
      if (previewRippleStartDelayRef.current !== null) {
        window.clearTimeout(previewRippleStartDelayRef.current);
        previewRippleStartDelayRef.current = null;
      }
      if (previewRippleTimeoutRef.current !== null) {
        window.clearTimeout(previewRippleTimeoutRef.current);
        previewRippleTimeoutRef.current = null;
      }
      return;
    }

    pendingPreviewRippleEntryRef.current = previewEntryId;
    setShowPreviewEntryRipple(false);

    return () => {
      if (previewRippleTimeoutRef.current !== null) {
        window.clearTimeout(previewRippleTimeoutRef.current);
        previewRippleTimeoutRef.current = null;
      }
    };
  }, [isPreviewMode, previewEntryId]);

  useEffect(() => {
    setIsLoadingOverlayVisible(isPanoramaLoading);
  }, [isPanoramaLoading]);

  useEffect(() => {
    if (!isPreviewMode || isLoadingOverlayVisible || pendingPreviewRippleEntryRef.current === null) {
      return;
    }

    previewRippleStartDelayRef.current = window.setTimeout(() => {
      setShowPreviewEntryRipple(true);
      pendingPreviewRippleEntryRef.current = null;
      previewRippleStartDelayRef.current = null;

      if (previewRippleTimeoutRef.current !== null) {
        window.clearTimeout(previewRippleTimeoutRef.current);
      }
      previewRippleTimeoutRef.current = window.setTimeout(() => {
        setShowPreviewEntryRipple(false);
        previewRippleTimeoutRef.current = null;
      }, PREVIEW_RIPPLE_DURATION_MS);
    }, PREVIEW_RIPPLE_POST_LOAD_DELAY_MS);

    return () => {
      if (previewRippleStartDelayRef.current !== null) {
        window.clearTimeout(previewRippleStartDelayRef.current);
        previewRippleStartDelayRef.current = null;
      }
    };
  }, [isLoadingOverlayVisible, isPreviewMode]);

  useEffect(() => {
    if (!PREVIEW_INTERACTION_DEBUG || !isPreviewMode) {
      return;
    }

    const shell = shellRef.current;
    const container = containerRef.current;
    const shellPointerEvents = shell ? window.getComputedStyle(shell).pointerEvents : null;
    const containerPointerEvents = container ? window.getComputedStyle(container).pointerEvents : null;

    console.info('[preview-interaction-debug] viewer state', {
      isPreviewMode,
      isPanoramaLoading,
      isLoadingOverlayVisible,
      showPreviewEntryRipple,
      hasOverlayContent: Boolean(overlayContent),
      selectedHotspotId,
      interactionMode,
      shellPointerEvents,
      containerPointerEvents,
      projectedPolygonCount: projectedPolygons.length
    });
  }, [
    drawingPolygonPoints.length,
    interactionMode,
    isLoadingOverlayVisible,
    isPanoramaLoading,
    isPreviewMode,
    overlayContent,
    projectedPolygons.length,
    selectedHotspotId,
    showPreviewEntryRipple
  ]);

  useEffect(() => {
    const clearAutoRotateResume = () => {
      if (autoRotateResumeTimeoutRef.current !== null) {
        window.clearTimeout(autoRotateResumeTimeoutRef.current);
        autoRotateResumeTimeoutRef.current = null;
      }
    };

    const stopIdleAutoRotate = () => {
      if (!viewerRef.current) {
        return;
      }

      (viewerRef.current as typeof viewerRef.current & { stopMovement: () => void }).stopMovement();
    };

    const startIdleAutoRotate = () => {
      const viewer = viewerRef.current;
      if (!viewer) {
        return;
      }

      (viewer as typeof viewer & { startAutoRotate: (speed?: number, pitch?: number) => void }).startAutoRotate(
        IDLE_AUTOROTATE_SPEED,
        viewer.getPitch()
      );
    };

    const scheduleIdleAutoRotateResume = () => {
      clearAutoRotateResume();
      autoRotateResumeTimeoutRef.current = window.setTimeout(() => {
        startIdleAutoRotate();
        autoRotateResumeTimeoutRef.current = null;
      }, IDLE_AUTOROTATE_RESUME_DELAY_MS);
    };

    const markViewerInteraction = () => {
      stopIdleAutoRotate();
      scheduleIdleAutoRotateResume();
    };

    const clearLongPress = () => {
      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      longPressTouchRef.current = null;
    };

    const shouldIgnoreGestureTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(
        target.closest(
          '.panorama-overlay-slot, .pnlm-hotspot-base, .pnlm-controls-container, .pnlm-compass, .pnlm-orientation-button'
        )
      );
    };

    const getCoordsFromClient = (clientX: number, clientY: number) => {
      const viewer = viewerRef.current;
      if (!viewer || !shellRef.current) {
        return null;
      }

      const syntheticEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY
      });
      const coords = viewer.mouseEventToCoords?.(syntheticEvent);
      if (!coords || coords.length < 2) {
        return null;
      }

      const [pitch, yaw] = coords;
      if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) {
        return null;
      }

      return { yaw, pitch };
    };

    const hasChanged = previousPanoramaUrlRef.current !== '' && previousPanoramaUrlRef.current !== trimmedPanoramaUrl;
    previousPanoramaUrlRef.current = trimmedPanoramaUrl;

    if (viewerRef.current && trimmedPanoramaUrl === '') {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    if (trimmedPanoramaUrl === '') {
      renderedHotspotIdsRef.current.clear();
      setIsPanoramaLoading(false);
      setErrorMessage(null);
      return;
    }

    if (!containerRef.current || !window.pannellum?.viewer) {
      return;
    }

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    setErrorMessage(null);
    setIsPanoramaLoading(true);

    const viewerConfig = {
      type: 'equirectangular',
      panorama: trimmedPanoramaUrl,
      autoLoad: true,
      compass: true,
      showZoomCtrl: true,
      showFullscreenCtrl: false,
      hotSpotDebug: PANNELLUM_HOTSPOT_DEBUG,
      hotSpots: []
    } as unknown as Parameters<typeof window.pannellum.viewer>[1];

    const viewer = window.pannellum.viewer(containerRef.current, viewerConfig);
    const shell = shellRef.current;
    const dragFix = shell?.querySelector<HTMLElement>('.pnlm-dragfix') ?? null;
    const aboutMessage = shell?.querySelector<HTMLElement>('.pnlm-about-msg') ?? null;
    const orbControl = shell?.querySelector<HTMLElement>('.pnlm-compass') ?? null;

    viewerRef.current = viewer;
    renderedHotspotIdsRef.current.clear();

    const emitViewPosition = () => {
      if (!viewerRef.current) {
        return;
      }

      const yaw = viewerRef.current.getYaw();
      const pitch = viewerRef.current.getPitch();

      if (Number.isFinite(yaw) && Number.isFinite(pitch)) {
        onViewChangeRef.current({ yaw, pitch });
      }
    };

    const clearLoading = () => {
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = window.setTimeout(() => {
        setIsPanoramaLoading(false);
        loadingTimeoutRef.current = null;
      }, hasChanged ? 320 : 120);
    };

    viewer.on('load', () => {
      emitViewPosition();
      clearLoading();
      scheduleIdleAutoRotateResume();
    });
    viewer.on('mouseup', emitViewPosition);
    viewer.on('touchend', emitViewPosition);
    viewer.on('mousedown', (event: unknown) => {
      if (!(event instanceof MouseEvent) || !viewerRef.current) {
        pointerDownRef.current = null;
        return;
      }

      markViewerInteraction();

      const coords = viewerRef.current.mouseEventToCoords?.(event);
      if (!coords || coords.length < 2) {
        pointerDownRef.current = null;
        return;
      }

      const [pitch, yaw] = coords;
      if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) {
        pointerDownRef.current = null;
        return;
      }

      // Store exact click-derived panorama coordinates at pointer down.
      pointerDownRef.current = { x: event.clientX, y: event.clientY, yaw, pitch };
    });
    viewer.on('mouseup', (event: unknown) => {
      if (!(event instanceof MouseEvent) || !viewerRef.current) {
        pointerDownRef.current = null;
        return;
      }

      if (interactionModeRef.current === 'idle') {
        pointerDownRef.current = null;
        return;
      }

      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!down) {
        return;
      }

      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 6) {
        return;
      }

      onPanoramaClickRef.current({ yaw: down.yaw, pitch: down.pitch });
    });
    viewer.on('error', () => {
      clearAutoRotateResume();
      setIsPanoramaLoading(false);
      setErrorMessage('Unable to load scene media.');
    });

    const handleContextMenu = (event: MouseEvent) => {
      if (isPreviewModeRef.current || interactionModeRef.current !== 'idle' || !onQuickPlaceHotspotRef.current) {
        return;
      }

      if (shouldIgnoreGestureTarget(event.target)) {
        return;
      }

      const coords = getCoordsFromClient(event.clientX, event.clientY);
      if (!coords) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      markViewerInteraction();
      aboutMessage?.style.setProperty('display', 'none');
      aboutMessage?.style.setProperty('opacity', '0');
      onQuickPlaceHotspotRef.current(coords);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isPreviewModeRef.current) {
        return;
      }

      if (event.touches.length !== 1 || shouldIgnoreGestureTarget(event.target)) {
        clearLongPress();
        placementTouchRef.current = null;
        return;
      }

      markViewerInteraction();

      const touch = event.touches[0];
      placementTouchRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        touchId: touch.identifier
      };

      if (interactionModeRef.current !== 'idle') {
        clearLongPress();
        return;
      }

      longPressTouchRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        touchId: touch.identifier
      };

      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }

      longPressTimeoutRef.current = window.setTimeout(() => {
        const activeTouch = longPressTouchRef.current;
        if (!activeTouch || !onQuickPlaceHotspotRef.current) {
          clearLongPress();
          return;
        }

        const coords = getCoordsFromClient(activeTouch.x, activeTouch.y);
        clearLongPress();
        if (!coords) {
          return;
        }

        onQuickPlaceHotspotRef.current(coords);
      }, MOBILE_LONG_PRESS_DELAY_MS);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const activePlacementTouch = placementTouchRef.current;
      if (activePlacementTouch) {
        const matchingPlacementTouch = Array.from(event.touches).find(
          (touch) => touch.identifier === activePlacementTouch.touchId
        );
        if (!matchingPlacementTouch) {
          placementTouchRef.current = null;
        } else {
          const distance = Math.hypot(
            matchingPlacementTouch.clientX - activePlacementTouch.x,
            matchingPlacementTouch.clientY - activePlacementTouch.y
          );
          if (distance > MOBILE_LONG_PRESS_MOVE_TOLERANCE_PX) {
            placementTouchRef.current = null;
          }
        }
      }

      const activeTouch = longPressTouchRef.current;
      if (!activeTouch) {
        return;
      }

      const matchingTouch = Array.from(event.touches).find((touch) => touch.identifier === activeTouch.touchId);
      if (!matchingTouch) {
        clearLongPress();
        return;
      }

      const distance = Math.hypot(matchingTouch.clientX - activeTouch.x, matchingTouch.clientY - activeTouch.y);
      if (distance > MOBILE_LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearLongPress();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const activePlacementTouch = placementTouchRef.current;
      if (
        !isPreviewModeRef.current &&
        interactionModeRef.current !== 'idle' &&
        activePlacementTouch &&
        !shouldIgnoreGestureTarget(event.target)
      ) {
        const coords = getCoordsFromClient(activePlacementTouch.x, activePlacementTouch.y);
        placementTouchRef.current = null;
        if (coords) {
          onPanoramaClickRef.current(coords);
        }
      } else {
        placementTouchRef.current = null;
      }

      clearLongPress();
    };

    const handleOrbToggle = (event: Event) => {
      if (!onToggleOverlaysRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearLongPress();
      markViewerInteraction();
      onToggleOverlaysRef.current();
    };

    const handleOrbKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      handleOrbToggle(event);
    };

    if (orbControl) {
      orbControl.setAttribute('role', 'button');
      orbControl.setAttribute('tabindex', '0');
      orbControl.setAttribute('aria-label', 'Toggle overlays');
      orbControl.setAttribute('title', 'Toggle overlays');
    }

    dragFix?.addEventListener('contextmenu', handleContextMenu, { capture: true });
    const handlePreviewPointerDebug = (event: PointerEvent) => {
      if (!PREVIEW_INTERACTION_DEBUG || !isPreviewModeRef.current) {
        return;
      }

      const topElement = document.elementFromPoint(event.clientX, event.clientY);
      console.info('[preview-interaction-debug] pointerdown target', {
        clientX: event.clientX,
        clientY: event.clientY,
        targetTag: event.target instanceof HTMLElement ? event.target.tagName : null,
        targetClassName: event.target instanceof HTMLElement ? event.target.className : null,
        topElementTag: topElement instanceof HTMLElement ? topElement.tagName : null,
        topElementClassName: topElement instanceof HTMLElement ? topElement.className : null
      });
    };

    shell?.addEventListener('pointerdown', markViewerInteraction, { passive: true });
    shell?.addEventListener('pointerdown', handlePreviewPointerDebug, { capture: true, passive: true });
    shell?.addEventListener('wheel', markViewerInteraction, { passive: true });
    shell?.addEventListener('touchstart', handleTouchStart, { passive: true });
    shell?.addEventListener('touchmove', handleTouchMove, { passive: true });
    shell?.addEventListener('touchend', handleTouchEnd);
    shell?.addEventListener('touchcancel', handleTouchEnd);
    orbControl?.addEventListener('click', handleOrbToggle);
    orbControl?.addEventListener('touchend', handleOrbToggle);
    orbControl?.addEventListener('keydown', handleOrbKeyDown);

    const intervalId = window.setInterval(emitViewPosition, 300);

    return () => {
      dragFix?.removeEventListener('contextmenu', handleContextMenu, true);
      shell?.removeEventListener('pointerdown', markViewerInteraction);
      shell?.removeEventListener('pointerdown', handlePreviewPointerDebug, true);
      shell?.removeEventListener('wheel', markViewerInteraction);
      shell?.removeEventListener('touchstart', handleTouchStart);
      shell?.removeEventListener('touchmove', handleTouchMove);
      shell?.removeEventListener('touchend', handleTouchEnd);
      shell?.removeEventListener('touchcancel', handleTouchEnd);
      orbControl?.removeEventListener('click', handleOrbToggle);
      orbControl?.removeEventListener('touchend', handleOrbToggle);
      orbControl?.removeEventListener('keydown', handleOrbKeyDown);
      clearLongPress();
      clearAutoRotateResume();
      window.clearInterval(intervalId);
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      renderedHotspotIdsRef.current.clear();
    };
  }, [panoramaUrl]);

  useEffect(() => {
    const polygonHotspots = hotspots.filter(
      (hotspot) => getHotspotShape(hotspot) === 'polygon' && (hotspot.polygonPoints?.length ?? 0) >= 3
    );

    if (polygonHotspots.length === 0 && drawingPolygonPoints.length === 0) {
      projectedPolygonSignatureRef.current = '';
      projectedDrawingSignatureRef.current = '';
      setProjectedPolygons([]);
      setProjectedDrawingPoints([]);
      return;
    }

    let frameId = 0;

    const updateProjectedGeometry = () => {
      const viewer = viewerRef.current as
        | (ReturnType<typeof window.pannellum.viewer> & {
            getRenderer?: () => { getCanvas?: () => HTMLCanvasElement | null } | null;
            getHfov?: () => number;
          })
        | null;
      const shell = shellRef.current;
      const renderer = viewer?.getRenderer?.();
      const canvas = renderer?.getCanvas?.() ?? shell?.querySelector('canvas');
      const canvasWidth = canvas?.clientWidth ?? shell?.clientWidth ?? 0;
      const canvasHeight = canvas?.clientHeight ?? shell?.clientHeight ?? 0;
      const viewerYaw = viewer?.getYaw?.() ?? 0;
      const viewerPitch = viewer?.getPitch?.() ?? 0;
      const viewerHfov = viewer?.getHfov?.() ?? 0;

      const shouldReset =
        !viewer ||
        !shell ||
        canvasWidth <= 0 ||
        canvasHeight <= 0 ||
        !Number.isFinite(viewerYaw) ||
        !Number.isFinite(viewerPitch) ||
        !Number.isFinite(viewerHfov) ||
        viewerHfov <= 0;

      if (shouldReset) {
        if (projectedPolygonSignatureRef.current !== '') {
          projectedPolygonSignatureRef.current = '';
          setProjectedPolygons([]);
        }
        if (projectedDrawingSignatureRef.current !== '') {
          projectedDrawingSignatureRef.current = '';
          setProjectedDrawingPoints([]);
        }
        frameId = window.requestAnimationFrame(updateProjectedGeometry);
        return;
      }

      const projectPoint = (point: HotspotPolygonPoint): ScreenPoint | null => {
        const hotspotPitchSin = Math.sin((point.pitch * Math.PI) / 180);
        const hotspotPitchCos = Math.cos((point.pitch * Math.PI) / 180);
        const configPitchSin = Math.sin((viewerPitch * Math.PI) / 180);
        const configPitchCos = Math.cos((viewerPitch * Math.PI) / 180);
        const yawCos = Math.cos(((-point.yaw + viewerYaw) * Math.PI) / 180);
        const z = hotspotPitchSin * configPitchSin + hotspotPitchCos * yawCos * configPitchCos;

        if (z <= 0) {
          return null;
        }

        const yawSin = Math.sin(((-point.yaw + viewerYaw) * Math.PI) / 180);
        const hfovTan = Math.tan((viewerHfov * Math.PI) / 360);
        const x = -canvasWidth / hfovTan * yawSin * hotspotPitchCos / z / 2 + canvasWidth / 2;
        const y =
          -canvasWidth / hfovTan * (hotspotPitchSin * configPitchCos - hotspotPitchCos * yawCos * configPitchSin) / z / 2 +
          canvasHeight / 2;

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return { x, y };
      };

      const nextProjectedPolygons = polygonHotspots.flatMap((hotspot) => {
          const polygonPoints = hotspot.polygonPoints ?? [];
          if (doesPolygonCrossSeam(polygonPoints)) {
            return [];
          }

          const projectedPoints = polygonPoints.map(projectPoint);
          if (projectedPoints.some((point) => point === null)) {
            return [];
          }

          const visiblePoints = projectedPoints.filter((point): point is ScreenPoint => point !== null);
          if (visiblePoints.length < 3) {
            return [];
          }

          return [
            {
              hotspotId: hotspot.id,
              points: visiblePoints,
              centroid: getPolygonAnchor(visiblePoints),
              isSelected: hotspot.id === selectedHotspotId,
              isVisited: isPreviewMode && visitedPreviewHotspotIds.includes(hotspot.id),
              isActivePreview: hotspot.id === activePreviewHotspotId
            }
          ];
        });

      const nextProjectedPolygonSignature = JSON.stringify(
        nextProjectedPolygons.map((polygon) => ({
          hotspotId: polygon.hotspotId,
          points: polygon.points.map((point) => [Math.round(point.x), Math.round(point.y)]),
          isSelected: polygon.isSelected,
          isVisited: polygon.isVisited,
          isActivePreview: polygon.isActivePreview
        }))
      );

      if (nextProjectedPolygonSignature !== projectedPolygonSignatureRef.current) {
        projectedPolygonSignatureRef.current = nextProjectedPolygonSignature;
        setProjectedPolygons(nextProjectedPolygons);
      }

      const nextDrawingPoints =
        interactionMode === 'drawingPolygon'
          ? drawingPolygonPoints
              .map(projectPoint)
              .filter((point): point is ScreenPoint => point !== null)
          : [];
      const nextDrawingSignature = JSON.stringify(
        nextDrawingPoints.map((point) => [Math.round(point.x), Math.round(point.y)])
      );

      if (nextDrawingSignature !== projectedDrawingSignatureRef.current) {
        projectedDrawingSignatureRef.current = nextDrawingSignature;
        setProjectedDrawingPoints(nextDrawingPoints);
      }

      frameId = window.requestAnimationFrame(updateProjectedGeometry);
    };

    frameId = window.requestAnimationFrame(updateProjectedGeometry);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    activePreviewHotspotId,
    drawingPolygonPoints,
    hotspots,
    interactionMode,
    isPreviewMode,
    selectedHotspotId,
    visitedPreviewHotspotIds
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    renderedHotspotIdsRef.current.forEach((hotspotId) => {
      try {
        viewer.removeHotSpot(hotspotId);
      } catch {
        // Remove can throw when instance has already discarded hotspot.
      }
    });
    renderedHotspotIdsRef.current.clear();

    hotspots
      .filter((hotspot) => getHotspotShape(hotspot) === 'point')
      .forEach((hotspot) => {
      const isVisitedInPreview = isPreviewMode && visitedPreviewHotspotIds.includes(hotspot.id);
      // Keep one native-compatible baseline marker class, then add a single
      // type class for themed meaning without changing the anchor geometry.
      const markerClassName = `xr-hotspot-marker-native xr-hotspot-type-${hotspot.type}${
        isVisitedInPreview ? ' xr-hotspot-visited-preview' : ''
      }${
        hotspot.id === activePreviewHotspotId ? ' xr-hotspot-active-preview' : ''
      }${hotspot.id === selectedHotspotId ? ' xr-hotspot-selected-editor' : ''}`;

      viewer.addHotSpot({
        id: hotspot.id,
        type: 'info',
        cssClass: markerClassName,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        text: '',
        createTooltipFunc: (hotspotElement: HTMLElement) => {
          hotspotElement.dataset.hotspotId = hotspot.id;
        },
        clickHandlerFunc:
          interactionModeRef.current === 'idle'
            ? () => {
                const hotspotElement = shellRef.current?.querySelector<HTMLElement>(
                  `.pnlm-hotspot-base[data-hotspot-id="${hotspot.id}"]`
                );
                const shellRect = shellRef.current?.getBoundingClientRect();
                const hotspotRect = hotspotElement?.getBoundingClientRect();
                const anchor =
                  shellRect && hotspotRect
                    ? {
                        x: hotspotRect.left - shellRect.left + hotspotRect.width / 2,
                        y: hotspotRect.top - shellRect.top + hotspotRect.height / 2
                      }
                    : undefined;

                onActivateHotspotRef.current(hotspot.id, anchor);
              }
            : undefined
      });
      renderedHotspotIdsRef.current.add(hotspot.id);
      });
  }, [
    activePreviewHotspotId,
    hotspots,
    interactionMode,
    isPreviewMode,
    onActivateHotspot,
    selectedHotspotId,
    visitedPreviewHotspotIds
  ]);

  useEffect(() => {
    if (!selectedHotspotId) {
      return;
    }

    const selectedHotspot = hotspots.find((hotspot) => hotspot.id === selectedHotspotId);
    if (!selectedHotspot || !viewerRef.current) {
      return;
    }

    viewerRef.current.lookAt(selectedHotspot.pitch, selectedHotspot.yaw, undefined, 300);
  }, [hotspots, selectedHotspotId]);

  useEffect(() => {
    if (isPreviewMode || !selectedHotspotId || !editorPopoverContent) {
      setEditorPopoverStyle(null);
      setUseEditorPopoverFallback(false);
      return;
    }

    const updatePopoverPosition = () => {
      const shell = shellRef.current;
      const popover = editorPopoverRef.current;
      if (!shell || !popover) {
        return;
      }

      if (window.innerWidth < 960) {
        setUseEditorPopoverFallback(true);
        setEditorPopoverStyle(null);
        return;
      }

      const hotspotElement = Array.from(shell.querySelectorAll<HTMLElement>('.pnlm-hotspot-base')).find(
        (element) => element.dataset.hotspotId === selectedHotspotId
      );
      if (!hotspotElement) {
        setUseEditorPopoverFallback(true);
        setEditorPopoverStyle(null);
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      const hotspotRect = hotspotElement.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth;
      const popoverHeight = popover.offsetHeight;
      const anchorX = hotspotRect.left - shellRect.left + hotspotRect.width / 2;
      const anchorY = hotspotRect.top - shellRect.top + hotspotRect.height / 2;
      const padding = 16;
      const gap = 20;
      const hasRoomRight = anchorX + gap + popoverWidth <= shellRect.width - padding;
      const hasRoomLeft = anchorX - gap - popoverWidth >= padding;

      let left = hasRoomRight
        ? anchorX + gap
        : hasRoomLeft
          ? anchorX - popoverWidth - gap
          : Math.min(Math.max(anchorX - popoverWidth / 2, padding), shellRect.width - popoverWidth - padding);

      let top = Math.min(Math.max(anchorY - popoverHeight / 2, padding), shellRect.height - popoverHeight - padding);

      if (popoverWidth > shellRect.width - padding * 2 || popoverHeight > shellRect.height - padding * 2) {
        setUseEditorPopoverFallback(true);
        setEditorPopoverStyle(null);
        return;
      }

      left = Math.max(padding, left);
      top = Math.max(padding, top);

      setUseEditorPopoverFallback(false);
      setEditorPopoverStyle({
        left,
        top
      });
    };

    const frameId = window.requestAnimationFrame(updatePopoverPosition);
    const intervalId = window.setInterval(updatePopoverPosition, 220);
    window.addEventListener('resize', updatePopoverPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', updatePopoverPosition);
    };
  }, [editorPopoverContent, isPreviewMode, selectedHotspotId, hotspots, panoramaUrl]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const resetOrbPointer = () => {
      shell.style.setProperty('--orb-pointer-x', '50%');
      shell.style.setProperty('--orb-pointer-y', '50%');
      shell.style.setProperty('--orb-drift-x', '0px');
      shell.style.setProperty('--orb-drift-y', '0px');
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = shell.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clampedX = Math.min(1, Math.max(0, x));
      const clampedY = Math.min(1, Math.max(0, y));
      const driftX = (clampedX - 0.5) * 10;
      const driftY = (clampedY - 0.5) * 10;

      shell.style.setProperty('--orb-pointer-x', `${(clampedX * 100).toFixed(2)}%`);
      shell.style.setProperty('--orb-pointer-y', `${(clampedY * 100).toFixed(2)}%`);
      shell.style.setProperty('--orb-drift-x', `${driftX.toFixed(2)}px`);
      shell.style.setProperty('--orb-drift-y', `${driftY.toFixed(2)}px`);
    };

    resetOrbPointer();
    shell.addEventListener('pointermove', handlePointerMove);
    shell.addEventListener('pointerleave', resetOrbPointer);

    return () => {
      shell.removeEventListener('pointermove', handlePointerMove);
      shell.removeEventListener('pointerleave', resetOrbPointer);
    };
  }, []);

  return (
    <section className={`panel panorama-panel viewer-card ${isPreviewMode ? 'panorama-panel-preview' : ''}`}>
      {!isPreviewMode ? <h2 className="viewer-overlay-title">Your XR Media</h2> : null}
      <div className="pannellum-shell viewer-clip-boundary" ref={shellRef}>
      <div
        className={`pannellum-container ${interactionMode !== 'idle' ? 'pannellum-container-placement' : ''}`}
        ref={containerRef}
        aria-label="Panorama viewer"
      />
        {projectedPolygons.length > 0 || projectedDrawingPoints.length > 0 ? (
          <svg
            className={`polygon-overlay-svg ${interactionMode === 'drawingPolygon' ? 'polygon-overlay-svg-drawing' : ''}`}
            viewBox={`0 0 ${shellRef.current?.clientWidth || 1} ${shellRef.current?.clientHeight || 1}`}
            preserveAspectRatio="none"
          >
            {projectedPolygons.map((polygon) => (
              <g
                key={polygon.hotspotId}
                className={`polygon-overlay-group${polygon.isSelected ? ' polygon-overlay-group-selected' : ''}${
                  polygon.isVisited ? ' polygon-overlay-group-visited' : ''
                }${polygon.isActivePreview ? ' polygon-overlay-group-active' : ''}`}
              >
                <polygon
                  className="polygon-overlay-shape"
                  points={polygon.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onActivateHotspot(polygon.hotspotId, polygon.centroid);
                  }}
                />
                {!isPreviewMode && polygon.isSelected
                  ? polygon.points.map((point, index) => (
                      <circle
                        key={`${polygon.hotspotId}-vertex-${index}`}
                        className="polygon-overlay-vertex"
                        cx={point.x}
                        cy={point.y}
                        r={5}
                      />
                    ))
                  : null}
              </g>
            ))}
            {projectedDrawingPoints.length > 0 ? (
              <g className="polygon-overlay-drawing">
                {projectedDrawingPoints.length >= 3 ? (
                  <polygon
                    className="polygon-overlay-drawing-fill"
                    points={projectedDrawingPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                  />
                ) : null}
                <polyline
                  className="polygon-overlay-drawing-line"
                  points={projectedDrawingPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                />
                {projectedDrawingPoints.map((point, index) => (
                  <circle key={`drawing-point-${index}`} className="polygon-overlay-drawing-vertex" cx={point.x} cy={point.y} r={5} />
                ))}
              </g>
            ) : null}
          </svg>
        ) : null}
        {overlayContent ? <div className="panorama-overlay-slot">{overlayContent}</div> : null}
        {isPreviewMode && showPreviewEntryRipple ? (
          <div className="preview-entry-ripple" aria-hidden="true" key={`preview-ripple-${previewEntryId}`}>
            <div className="preview-entry-ripple-core" />
            <div className="preview-entry-ripple-rings" />
            <div className="preview-entry-ripple-sheen" />
          </div>
        ) : null}
        {isPreviewMode && isLoadingOverlayVisible ? <div className="preview-scene-transition-veil" aria-hidden="true" /> : null}
        {isLoadingOverlayVisible ? (
          <div className="panorama-loading-overlay" role="status" aria-live="polite">
            <div className="panorama-loading-core">
              <div className="panorama-loading-sky">
                <div className="panorama-loading-star panorama-loading-star-one" />
                <div className="panorama-loading-star panorama-loading-star-two" />
                <div className="panorama-loading-star panorama-loading-star-three" />
                <div className="panorama-loading-moon" />
              </div>
              <div className="panorama-loading-orbit" />
              <div className="panorama-loading-ring" />
              <p>Composing your immersive environment...</p>
            </div>
          </div>
        ) : null}
        {!hasSceneMedia || errorMessage ? (
          <div className="viewer-fallback-overlay viewer-fallback-overlay-empty" role="status" aria-live="polite">
            <div className="viewer-empty-ripple" aria-hidden="true">
              <div className="viewer-empty-ripple-core" />
              <div className="viewer-empty-ripple-rings" />
              <div className="viewer-empty-ripple-sheen" />
            </div>
            <p className="viewer-empty-message">{errorMessage ?? 'Select or upload a scene'}</p>
          </div>
        ) : null}
        {!isPreviewMode && editorPopoverContent ? (
          <div
            ref={editorPopoverRef}
            className={`pannellum-editor-popover ${
              useEditorPopoverFallback ? 'pannellum-editor-popover-fallback' : 'pannellum-editor-popover-anchored'
            }`}
            style={useEditorPopoverFallback ? undefined : editorPopoverStyle ?? undefined}
          >
            {editorPopoverContent}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default PanoramaViewer;
