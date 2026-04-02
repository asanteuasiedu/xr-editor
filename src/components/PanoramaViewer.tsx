import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';
import type { Hotspot } from '../types/project';

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
  interactionMode: 'idle' | 'placingNewHotspot' | 'movingExistingHotspot';
  onActivateHotspot: (hotspotId: string, anchor?: { x: number; y: number }) => void;
  onPanoramaClick: (position: { yaw: number; pitch: number }) => void;
  onViewChange: (position: { yaw: number; pitch: number }) => void;
};

// Set true temporarily to compare click-derived coordinates with viewer debug output.
const PANNELLUM_HOTSPOT_DEBUG = false;

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
  onActivateHotspot,
  onPanoramaClick,
  onViewChange
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const editorPopoverRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ReturnType<typeof window.pannellum.viewer> | null>(null);
  const renderedHotspotIdsRef = useRef<Set<string>>(new Set());
  const pointerDownRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const previousPanoramaUrlRef = useRef<string>('');
  const loadingTimeoutRef = useRef<number | null>(null);
  const previewAnimationTimeoutsRef = useRef<number[]>([]);
  const previewEntryAnimatedRef = useRef<number | null>(null);
  const onActivateHotspotRef = useRef(onActivateHotspot);
  const onPanoramaClickRef = useRef(onPanoramaClick);
  const onViewChangeRef = useRef(onViewChange);
  const interactionModeRef = useRef(interactionMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPanoramaLoading, setIsPanoramaLoading] = useState(false);
  const [editorPopoverStyle, setEditorPopoverStyle] = useState<CSSProperties | null>(null);
  const [useEditorPopoverFallback, setUseEditorPopoverFallback] = useState(false);

  useEffect(() => {
    onActivateHotspotRef.current = onActivateHotspot;
  }, [onActivateHotspot]);

  useEffect(() => {
    onPanoramaClickRef.current = onPanoramaClick;
  }, [onPanoramaClick]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    const trimmedPanoramaUrl = panoramaUrl.trim();
    const hasChanged = previousPanoramaUrlRef.current !== '' && previousPanoramaUrlRef.current !== trimmedPanoramaUrl;
    previousPanoramaUrlRef.current = trimmedPanoramaUrl;

    if (viewerRef.current && trimmedPanoramaUrl === '') {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    if (trimmedPanoramaUrl === '') {
      renderedHotspotIdsRef.current.clear();
      setIsPanoramaLoading(false);
      setErrorMessage('No panorama URL set for this scene. Add one in Active Scene Details.');
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

    viewerRef.current = viewer;
    renderedHotspotIdsRef.current.clear();
    previewAnimationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    previewAnimationTimeoutsRef.current = [];

    if (isPreviewMode && previewEntryAnimatedRef.current !== previewEntryId) {
      viewer.lookAt(16, -34, 148, 0);
    }

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
      if (isPreviewMode && previewEntryAnimatedRef.current !== previewEntryId) {
        previewEntryAnimatedRef.current = previewEntryId;
        const sweepTimeout = window.setTimeout(() => {
          if (viewerRef.current !== viewer) {
            return;
          }

          viewer.lookAt(6, 24, 114, 920);
        }, 40);
        const settleTimeout = window.setTimeout(() => {
          if (viewerRef.current !== viewer) {
            return;
          }

          viewer.lookAt(0, 0, 100, 760);
        }, 540);
        previewAnimationTimeoutsRef.current = [sweepTimeout, settleTimeout];
      }
      emitViewPosition();
      clearLoading();
    });
    viewer.on('mouseup', emitViewPosition);
    viewer.on('touchend', emitViewPosition);
    viewer.on('mousedown', (event: unknown) => {
      if (!(event instanceof MouseEvent) || !viewerRef.current) {
        pointerDownRef.current = null;
        return;
      }

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
      setIsPanoramaLoading(false);
      setErrorMessage('Unable to load panorama image. Check the active scene panorama URL/path.');
    });

    const intervalId = window.setInterval(emitViewPosition, 300);

    return () => {
      window.clearInterval(intervalId);
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      previewAnimationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      previewAnimationTimeoutsRef.current = [];

      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      renderedHotspotIdsRef.current.clear();
    };
  }, [isPreviewMode, panoramaUrl, previewEntryId]);

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

    hotspots.forEach((hotspot) => {
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
        {overlayContent ? <div className="panorama-overlay-slot">{overlayContent}</div> : null}
        {isPreviewMode && isPanoramaLoading ? <div className="preview-scene-transition-veil" aria-hidden="true" /> : null}
        {isPanoramaLoading ? (
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
        {errorMessage ? (
          <div className="viewer-fallback-overlay" role="status" aria-live="polite">
            <p className="error-note">{errorMessage}</p>
            <p className="placeholder-note">
              Set a valid panorama URL/path in the active scene to continue editing in the viewer.
            </p>
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
