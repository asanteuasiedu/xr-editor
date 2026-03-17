import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';
import type { Hotspot } from '../types/project';

type PanoramaViewerProps = {
  panoramaUrl: string;
  hotspots: Hotspot[];
  selectedHotspotId: string | null;
  isPreviewMode?: boolean;
  previewEntryId?: number;
  overlayContent?: ReactNode;
  interactionMode: 'idle' | 'placingNewHotspot' | 'movingExistingHotspot';
  onActivateHotspot: (hotspotId: string) => void;
  onPanoramaClick: (position: { yaw: number; pitch: number }) => void;
  onViewChange: (position: { yaw: number; pitch: number }) => void;
};

// Set true temporarily to compare click-derived coordinates with viewer debug output.
const PANNELLUM_HOTSPOT_DEBUG = false;

function PanoramaViewer({
  panoramaUrl,
  hotspots,
  selectedHotspotId,
  isPreviewMode = false,
  previewEntryId = 0,
  overlayContent,
  interactionMode,
  onActivateHotspot,
  onPanoramaClick,
  onViewChange
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
      // Keep pannellum native hotspot anchoring. Visual identity is CSS-only on this
      // marker class, and root marker geometry must stay minimal to preserve alignment.
      const markerClassName = [
        'xr-hotspot-marker-native',
        `xr-hotspot-type-${hotspot.type}`,
        selectedHotspotId === hotspot.id ? 'xr-hotspot-selected' : '',
        hotspot.type === 'sceneLink' && hotspot.targetSceneId ? 'xr-hotspot-linked' : ''
      ]
        .filter(Boolean)
        .join(' ');

      viewer.addHotSpot({
        id: hotspot.id,
        type: 'info',
        cssClass: markerClassName,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        text: '',
        clickHandlerFunc:
          interactionModeRef.current === 'idle'
            ? () => onActivateHotspotRef.current(hotspot.id)
            : undefined
      });
      renderedHotspotIdsRef.current.add(hotspot.id);
    });
  }, [hotspots, interactionMode, selectedHotspotId, onActivateHotspot]);

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

  return (
    <section className={`panel panorama-panel viewer-card ${isPreviewMode ? 'panorama-panel-preview' : ''}`}>
      {!isPreviewMode ? <h2 className="panel-title">Your XR Media</h2> : null}
      <div className="pannellum-shell viewer-clip-boundary">
        <div
          className={`pannellum-container ${interactionMode !== 'idle' ? 'pannellum-container-placement' : ''}`}
          ref={containerRef}
          aria-label="Panorama viewer"
        />
        {overlayContent ? <div className="panorama-overlay-slot">{overlayContent}</div> : null}
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
      </div>
    </section>
  );
}

export default PanoramaViewer;
