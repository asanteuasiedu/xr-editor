import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Layout from './components/Layout';
import Sidebar, { type EditSection } from './components/Sidebar';
import HotspotEditor from './components/HotspotEditor';
import PanoramaViewer from './components/PanoramaViewer';
import type { Hotspot, Project } from './types/project';
import { exportProjectToJson, importProjectFromFile } from './utils/exportImport';
import { imageFileToDataUrl } from './utils/fileAssets';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from './utils/localDraft';
import { exportPresentationPackage } from './utils/presentationPackage';
import { SCENE_LIBRARY_ITEMS, STARTER_SCENE_PANORAMA_URL } from './utils/sceneLibrary';
import {
  createProjectFromTemplate,
  PROJECT_TEMPLATE_OPTIONS,
  type ProjectTemplateId
} from './utils/templates';

const DEFAULT_PANORAMA_URL = STARTER_SCENE_PANORAMA_URL;

type PlacementMode =
  | { type: 'idle' }
  | { type: 'placingNewHotspot' }
  | { type: 'movingExistingHotspot'; hotspotId: string };

type SaveState = 'saved' | 'unsaved' | 'restored';
type AppMode = 'edit' | 'preview';
type QuestionResponse = {
  selectedIndex: number;
  isCorrect: boolean;
  sceneId: string;
};
const PREVIEW_HINT_DISMISSED_KEY = 'xr-editor.preview-hint-dismissed.v1';
const EDIT_WALKTHROUGH_DISMISSED_KEY = 'xr-editor.edit-walkthrough-dismissed.v1';

const EDIT_WALKTHROUGH_STEPS = [
  {
    id: 'controls',
    title: 'Project Controls',
    body: 'Start here to present the experience, export the project, replay the walkthrough, or swap in a curated pilot scene.'
  },
  {
    id: 'inspector',
    title: 'Project Inspector',
    body: 'Start here to name the project and set the overall framing before you build scenes.'
  },
  {
    id: 'scenes',
    title: 'Scenes',
    body: 'Use this panel to move between scenes and add new media locations to the experience.'
  },
  {
    id: 'sceneDetails',
    title: 'Active Scene Details',
    body: 'Update the selected scene name and upload or swap the panorama shown in the viewer.'
  },
  {
    id: 'hotspots',
    title: 'Hotspots',
    body: 'Review insight zones for the active scene and jump straight into editing or placement.'
  },
] as const;

function createDefaultProject(): Project {
  return createProjectFromTemplate('blankTour');
}

function hasProjectContent(project: Project) {
  if (project.scenes.length > 1) {
    return true;
  }

  if ((project.description ?? '').trim() || (project.authorOrOrganization ?? '').trim()) {
    return true;
  }

  return project.scenes.some(
    (scene) =>
      scene.hotspots.length > 0 ||
      scene.panoramaUrl.trim() !== STARTER_SCENE_PANORAMA_URL ||
      scene.name.trim() !== 'Scene 1' ||
      project.name.trim() !== 'Blank Tour'
  );
}

function loadPreviewHintDismissed() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(PREVIEW_HINT_DISMISSED_KEY) === '1';
}

function loadEditWalkthroughDismissed() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(EDIT_WALKTHROUGH_DISMISSED_KEY) === '1';
}

function RailIcon({ section }: { section: EditSection }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'edit-rail-svg'
  };

  if (section === 'controls') {
    return (
      <svg {...commonProps}>
        <line x1="5" y1="6" x2="19" y2="6" />
        <line x1="5" y1="12" x2="19" y2="12" />
        <line x1="5" y1="18" x2="19" y2="18" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="11" cy="18" r="2" />
      </svg>
    );
  }

  if (section === 'inspector') {
    return (
      <svg {...commonProps}>
        <path d="M4.5 7.5a2 2 0 0 1 2-2h4.7l2 2H17.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (section === 'scenes') {
    return (
      <svg {...commonProps}>
        <rect x="4.5" y="5" width="12" height="10" rx="2" />
        <path d="M7.5 12l2.5-2.5 2 2 2.5-3 2 2.5" />
        <circle cx="9" cy="8.5" r="1" />
        <path d="M17 9h2.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10" />
      </svg>
    );
  }

  if (section === 'sceneDetails') {
    return (
      <svg {...commonProps}>
        <path d="M7 4.5h7l4 4v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-13A2 2 0 0 1 7 4.5z" />
        <path d="M14 4.5v4h4" />
        <path d="M9 13h6" />
        <path d="M9 16h4" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 4.5l1.8 3.9 4.2.6-3 2.9.7 4.1-3.7-2-3.7 2 .7-4.1-3-2.9 4.2-.6z" />
    </svg>
  );
}

function getMultipleChoiceConfig(hotspot: Hotspot) {
  if (hotspot.type !== 'multipleChoice') {
    return null;
  }

  const prompt = hotspot.questionPrompt?.trim() ?? '';
  const options = (hotspot.answerOptions ?? []).map((option) => option.trim()).filter(Boolean);
  const correctAnswerIndex = hotspot.correctAnswerIndex;

  if (!prompt || options.length < 2 || options.length > 4) {
    return null;
  }

  if (
    typeof correctAnswerIndex !== 'number' ||
    !Number.isInteger(correctAnswerIndex) ||
    correctAnswerIndex < 0 ||
    correctAnswerIndex >= options.length
  ) {
    return null;
  }

  return {
    prompt,
    options,
    correctAnswerIndex,
    feedbackText: hotspot.feedbackText?.trim() ?? ''
  };
}

function deriveSceneNameFromFile(file: File, fallbackName: string) {
  const trimmedName = file.name.replace(/\.[^.]+$/, '').trim();
  return trimmedName || fallbackName;
}

function App() {
  const initialLoad = useMemo(() => loadLocalDraft(), []);
  const initialWalkthroughDismissed = useMemo(() => loadEditWalkthroughDismissed(), []);
  const shouldRunFirstStartFlow = !initialLoad.restored && !initialWalkthroughDismissed;
  const [project, setProject] = useState<Project>(
    initialLoad.restored ? initialLoad.project : createDefaultProject()
  );
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [, setCurrentView] = useState({ yaw: 0, pitch: 0 });
  const [appMode, setAppMode] = useState<AppMode>('edit');
  const [placementMode, setPlacementMode] = useState<PlacementMode>({ type: 'idle' });
  const [importError, setImportError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(initialLoad.restored ? 'restored' : 'saved');
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string; caption?: string } | null>(null);
  const [infoPreview, setInfoPreview] = useState<{ title: string; body: string } | null>(null);
  const [questionPreviewHotspotId, setQuestionPreviewHotspotId] = useState<string | null>(null);
  const [imagePreviewBroken, setImagePreviewBroken] = useState(false);
  const [discoveredHotspotIds, setDiscoveredHotspotIds] = useState<string[]>([]);
  const [questionResponses, setQuestionResponses] = useState<Record<string, QuestionResponse>>({});
  const [previewHintDismissed, setPreviewHintDismissed] = useState(loadPreviewHintDismissed);
  const [, setEditWalkthroughDismissed] = useState(initialWalkthroughDismissed);
  // First-run startup is deterministic: walkthrough first, Scene Library second.
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState<number | null>(
    shouldRunFirstStartFlow ? 0 : null
  );
  const [isScenePickerOpen, setIsScenePickerOpen] = useState(false);
  const [openScenePickerAfterWalkthrough, setOpenScenePickerAfterWalkthrough] = useState(shouldRunFirstStartFlow);
  const [previewEntryId, setPreviewEntryId] = useState(0);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState<EditSection>('controls');
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasMountedRef = useRef(false);
  const noticeTimeoutRef = useRef<number | null>(null);

  const showTemporaryNotice = useCallback((message: string, durationMs = 2200) => {
    setNoticeMessage(message);

    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }

    noticeTimeoutRef.current = window.setTimeout(() => {
      setNoticeMessage((current) => (current === message ? null : current));
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    setSaveState('unsaved');
    const timeoutId = window.setTimeout(() => {
      const saved = saveLocalDraft(project);
      setSaveState(saved ? 'saved' : 'unsaved');
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [project]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  const activeScene = useMemo(
    () => project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0],
    [project]
  );
  const activeWalkthroughStep = walkthroughStepIndex === null ? null : EDIT_WALKTHROUGH_STEPS[walkthroughStepIndex];

  const sceneNameById = useMemo(
    () => Object.fromEntries(project.scenes.map((scene) => [scene.id, scene.name || 'Untitled Scene'])),
    [project.scenes]
  );

  const selectedHotspot = useMemo(
    () => activeScene.hotspots.find((hotspot) => hotspot.id === selectedHotspotId),
    [activeScene.hotspots, selectedHotspotId]
  );
  const questionEntries = useMemo(
    () =>
      project.scenes.flatMap((scene) =>
        scene.hotspots
          .filter((hotspot) => hotspot.type === 'multipleChoice')
          .map((hotspot) => ({ hotspot, sceneId: scene.id }))
      ),
    [project.scenes]
  );
  const questionEntryById = useMemo(
    () => new Map(questionEntries.map((entry) => [entry.hotspot.id, entry])),
    [questionEntries]
  );
  const activeQuestionEntry = questionPreviewHotspotId ? questionEntryById.get(questionPreviewHotspotId) ?? null : null;
  const activeQuestionConfig = activeQuestionEntry ? getMultipleChoiceConfig(activeQuestionEntry.hotspot) : null;
  const activeQuestionResponse = activeQuestionEntry ? questionResponses[activeQuestionEntry.hotspot.id] : undefined;
  const totalProgressPoints = useMemo(
    () => project.scenes.reduce((count, scene) => count + scene.hotspots.length, 0),
    [project.scenes]
  );
  const progressPercent = totalProgressPoints === 0 ? 0 : (discoveredHotspotIds.length / totalProgressPoints) * 100;
  const totalQuestionCount = questionEntries.length;
  const answeredQuestionIds = useMemo(
    () => Object.keys(questionResponses).filter((hotspotId) => questionEntryById.has(hotspotId)),
    [questionEntryById, questionResponses]
  );
  const answeredQuestionCount = answeredQuestionIds.length;
  const totalCorrectAnswers = useMemo(
    () => answeredQuestionIds.filter((hotspotId) => questionResponses[hotspotId]?.isCorrect).length,
    [answeredQuestionIds, questionResponses]
  );
  const activeSceneQuestionHotspots = useMemo(
    () => activeScene.hotspots.filter((hotspot) => hotspot.type === 'multipleChoice'),
    [activeScene.hotspots]
  );
  const activeSceneCorrectCount = useMemo(
    () =>
      activeSceneQuestionHotspots.filter((hotspot) => questionResponses[hotspot.id]?.isCorrect).length,
    [activeSceneQuestionHotspots, questionResponses]
  );
  const isExperienceComplete =
    totalProgressPoints > 0 &&
    discoveredHotspotIds.length === totalProgressPoints &&
    answeredQuestionCount === totalQuestionCount;

  useEffect(() => {
    if (isExperienceComplete) {
      if (!completionDismissed) {
        setShowCompletionMessage(true);
      }
      return;
    }

    setShowCompletionMessage(false);
    setCompletionDismissed(false);
  }, [completionDismissed, isExperienceComplete]);

  const projectStats = useMemo(() => {
    const totalScenes = project.scenes.length;
    const totalHotspots = project.scenes.reduce((count, scene) => count + scene.hotspots.length, 0);
    const totalLinkedHotspots = project.scenes.reduce(
      (count, scene) =>
        count +
        scene.hotspots.filter((hotspot) => hotspot.type === 'sceneLink' && Boolean(hotspot.targetSceneId)).length,
      0
    );

    return {
      totalScenes,
      totalHotspots,
      totalLinkedHotspots,
      activeSceneName: activeScene.name || 'Untitled Scene'
    };
  }, [activeScene.name, project.scenes]);

  const updateHotspots = useCallback((updater: (current: Hotspot[]) => Hotspot[]) => {
    setProject((currentProject) => ({
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === currentProject.activeSceneId
          ? {
              ...scene,
              hotspots: updater(scene.hotspots)
            }
          : scene
      )
    }));
  }, []);

  const handleUpdateProjectMetadata = (
    patch: Partial<Pick<Project, 'name' | 'description' | 'authorOrOrganization'>>
  ) => {
    setProject((currentProject) => ({
      ...currentProject,
      ...patch
    }));
  };

  const handleSelectScene = (sceneId: string) => {
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setIsScenePickerOpen(false);
    setActiveEditSection('sceneDetails');
    setSelectedHotspotId(null);
    setPlacementMode({ type: 'idle' });
    setProject((currentProject) => {
      if (currentProject.activeSceneId === sceneId) {
        return currentProject;
      }

      return {
        ...currentProject,
        activeSceneId: sceneId
      };
    });
  };

  const handleAddScene = () => {
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setIsScenePickerOpen(false);
    setActiveEditSection('sceneDetails');
    setPlacementMode({ type: 'idle' });

    const newSceneId = `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newSceneNumber = project.scenes.length + 1;

    setProject((currentProject) => ({
      ...currentProject,
      activeSceneId: newSceneId,
      scenes: [
        ...currentProject.scenes,
        {
          id: newSceneId,
          name: `Scene ${newSceneNumber}`,
          panoramaUrl: DEFAULT_PANORAMA_URL,
          hotspots: []
        }
      ]
    }));

    setSelectedHotspotId(null);
  };

  const handleRenameActiveScene = (name: string) => {
    setProject((currentProject) => ({
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === currentProject.activeSceneId
          ? {
              ...scene,
              name
            }
          : scene
      )
    }));
  };

  const handleUpdateActiveScenePanorama = (panoramaUrl: string) => {
    setProject((currentProject) => ({
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === currentProject.activeSceneId
          ? {
              ...scene,
              panoramaUrl
            }
          : scene
      )
    }));
  };

  const handleCreateSceneFromPanorama = (panoramaUrl: string, sceneName?: string) => {
    const newSceneId = `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fallbackSceneName = `Scene ${project.scenes.length + 1}`;

    setProject((currentProject) => ({
      ...currentProject,
      activeSceneId: newSceneId,
      scenes: [
        ...currentProject.scenes,
        {
          id: newSceneId,
          name: sceneName?.trim() || fallbackSceneName,
          panoramaUrl,
          hotspots: []
        }
      ]
    }));

    setActiveEditSection('sceneDetails');
    setSelectedHotspotId(null);
    setPlacementMode({ type: 'idle' });
  };

  const handleDeleteScene = (sceneId: string) => {
    if (project.scenes.length <= 1) {
      return;
    }

    const sceneToDelete = project.scenes.find((scene) => scene.id === sceneId);
    const sceneLabel = sceneToDelete?.name || 'this scene';
    const confirmDelete = window.confirm(
      `Delete "${sceneLabel}"?\n\nAny hotspot links targeting this scene will be cleared. This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    const deletedActiveScene = sceneId === project.activeSceneId;

    setProject((currentProject) => {
      if (currentProject.scenes.length <= 1) {
        return currentProject;
      }

      const remainingScenes = currentProject.scenes
        .filter((scene) => scene.id !== sceneId)
        .map((scene) => ({
          ...scene,
          hotspots: scene.hotspots.map((hotspot) =>
            hotspot.type === 'sceneLink' && hotspot.targetSceneId === sceneId
              ? {
                  ...hotspot,
                  targetSceneId: undefined
                }
              : hotspot
          )
        }));

      const stillHasActiveScene = remainingScenes.some((scene) => scene.id === currentProject.activeSceneId);

      return {
        ...currentProject,
        scenes: remainingScenes,
        activeSceneId: stillHasActiveScene ? currentProject.activeSceneId : remainingScenes[0].id
      };
    });

    if (deletedActiveScene) {
      setSelectedHotspotId(null);
    }
    setImagePreview(null);
    setQuestionPreviewHotspotId(null);
    setPlacementMode({ type: 'idle' });
    setIsScenePickerOpen(false);
  };

  const handleStartPlacingHotspot = () => {
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setActiveEditSection('hotspots');
    setIsContextPanelOpen(true);
    setPlacementMode({ type: 'placingNewHotspot' });
  };

  const handleStartMovingSelectedHotspot = () => {
    if (!selectedHotspotId) {
      return;
    }

    setActiveEditSection('hotspots');
    setIsContextPanelOpen(true);
    setPlacementMode({ type: 'movingExistingHotspot', hotspotId: selectedHotspotId });
  };

  const handleDeleteHotspot = (hotspotId: string) => {
    const hotspotToDelete = activeScene.hotspots.find((hotspot) => hotspot.id === hotspotId);
    const hotspotLabel = hotspotToDelete?.title || 'this insight zone';
    const confirmDelete = window.confirm(
      `Delete "${hotspotLabel}"?\n\nThis will remove the insight zone from the active scene.`
    );

    if (!confirmDelete) {
      return;
    }

    updateHotspots((current) => current.filter((hotspot) => hotspot.id !== hotspotId));
    setSelectedHotspotId((currentId) => (currentId === hotspotId ? null : currentId));
  };

  const handleUpdateHotspot = useCallback(
    (hotspotId: string, patch: Partial<Hotspot>) => {
      updateHotspots((current) =>
        current.map((hotspot) => (hotspot.id === hotspotId ? { ...hotspot, ...patch } : hotspot))
      );
    },
    [updateHotspots]
  );

  const normalizeExternalLink = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return null;
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const handleActivateHotspot = useCallback(
    (hotspotId: string) => {
      if (placementMode.type !== 'idle') {
        return;
      }

      const clickedHotspot = activeScene.hotspots.find((hotspot) => hotspot.id === hotspotId);
      if (!clickedHotspot) {
        return;
      }

      if (appMode === 'preview') {
        setDiscoveredHotspotIds((current) => (current.includes(hotspotId) ? current : [...current, hotspotId]));
      }

      if (clickedHotspot.type === 'multipleChoice') {
        if (appMode === 'preview') {
          const questionConfig = getMultipleChoiceConfig(clickedHotspot);
          if (!questionConfig) {
            setImportError('Multiple Choice hotspot is missing a valid prompt, answers, or correct answer.');
            setSelectedHotspotId(hotspotId);
            return;
          }

          setImagePreview(null);
          setInfoPreview(null);
          setQuestionPreviewHotspotId(hotspotId);
          setSelectedHotspotId(null);
          return;
        }

        setImagePreview(null);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setSelectedHotspotId(hotspotId);
        return;
      }

      if (clickedHotspot.type === 'sceneLink') {
        if (!clickedHotspot.targetSceneId) {
          setImportError('Scene Link hotspot is missing a destination scene.');
          setSelectedHotspotId(hotspotId);
          return;
        }

        const targetExists = project.scenes.some((scene) => scene.id === clickedHotspot.targetSceneId);
        if (!targetExists || clickedHotspot.targetSceneId === activeScene.id) {
          setImportError('Destination scene is unavailable for this Scene Link hotspot.');
          setSelectedHotspotId(hotspotId);
          return;
        }

        setProject((currentProject) => ({
          ...currentProject,
          activeSceneId: clickedHotspot.targetSceneId as string
        }));
        setImagePreview(null);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setSelectedHotspotId(null);
        setPlacementMode({ type: 'idle' });
        return;
      }

      if (clickedHotspot.type === 'externalLink') {
        const normalized = normalizeExternalLink(clickedHotspot.url ?? '');
        if (!normalized) {
          setImportError('External Link hotspot has an invalid or missing URL.');
          setSelectedHotspotId(hotspotId);
          return;
        }

        window.open(normalized, '_blank', 'noopener,noreferrer');
        setImagePreview(null);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setSelectedHotspotId(hotspotId);
        return;
      }

      if (clickedHotspot.type === 'image') {
        const src = (clickedHotspot.imageUrl ?? '').trim();
        if (!src) {
          setImportError('Image hotspot is missing an image URL.');
          setSelectedHotspotId(hotspotId);
          return;
        }

        setImagePreview({
          src,
          title: clickedHotspot.title || 'Image Preview',
          caption: clickedHotspot.body || undefined
        });
        setImagePreviewBroken(false);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setSelectedHotspotId(hotspotId);
        return;
      }

      if (appMode === 'preview') {
        setSelectedHotspotId(null);
        setImagePreview(null);
        setInfoPreview({
          title: clickedHotspot.title || 'Info',
          body: clickedHotspot.body || 'No details provided.'
        });
        setQuestionPreviewHotspotId(null);
        return;
      }

      setInfoPreview(null);
      setQuestionPreviewHotspotId(null);
      setSelectedHotspotId(hotspotId);
    },
    [activeScene.hotspots, activeScene.id, appMode, placementMode.type, project.scenes]
  );

  const handlePanoramaClick = useCallback(
    ({ yaw, pitch }: { yaw: number; pitch: number }) => {
      if (placementMode.type === 'idle') {
        return;
      }

      if (placementMode.type === 'placingNewHotspot') {
        const hotspotId = `hotspot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const nextHotspot: Hotspot = {
          id: hotspotId,
          type: 'info',
          title: 'New Insight Zone',
          body: 'Add description here',
          yaw: Number(yaw.toFixed(2)),
          pitch: Number(pitch.toFixed(2))
        };

        updateHotspots((current) => [...current, nextHotspot]);
        setSelectedHotspotId(hotspotId);
        setPlacementMode({ type: 'idle' });
        showTemporaryNotice('Insight Zone placed');
        return;
      }

      const movingHotspotId = placementMode.hotspotId;
      const hotspotExists = activeScene.hotspots.some((hotspot) => hotspot.id === movingHotspotId);
      if (!hotspotExists) {
        setPlacementMode({ type: 'idle' });
        return;
      }

      handleUpdateHotspot(movingHotspotId, {
        yaw: Number(yaw.toFixed(2)),
        pitch: Number(pitch.toFixed(2))
      });
      setSelectedHotspotId(movingHotspotId);
      setPlacementMode({ type: 'idle' });
      showTemporaryNotice('Insight Zone moved');
    },
    [activeScene.hotspots, handleUpdateHotspot, placementMode, showTemporaryNotice, updateHotspots]
  );

  const handleCancelPlacement = () => {
    setPlacementMode({ type: 'idle' });
  };

  const handleAnswerMultipleChoice = useCallback(
    (hotspotId: string, selectedIndex: number) => {
      const entry = questionEntryById.get(hotspotId);
      if (!entry) {
        return;
      }

      const questionConfig = getMultipleChoiceConfig(entry.hotspot);
      if (!questionConfig) {
        setImportError('This question is missing required quiz fields.');
        return;
      }

      setQuestionResponses((current) => {
        if (current[hotspotId]) {
          return current;
        }

        return {
          ...current,
          [hotspotId]: {
            selectedIndex,
            isCorrect: selectedIndex === questionConfig.correctAnswerIndex,
            sceneId: entry.sceneId
          }
        };
      });
    },
    [questionEntryById]
  );

  const handleExportProject = () => {
    setImportError(null);
    setNoticeMessage(null);
    exportProjectToJson(project);
  };

  const handleExportPresentationPackage = () => {
    setImportError(null);
    exportPresentationPackage(project);
    setNoticeMessage(
      'Presentation package exported as HTML, JSON, and README files. Keep the exported files together when reviewing or hosting.'
    );
  };

  const openImportFilePicker = () => {
    setImportError(null);
    setNoticeMessage(null);
    fileInputRef.current?.click();
  };

  const handleImportFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const importedProject = await importProjectFromFile(file);
      setProject(importedProject);
      setDiscoveredHotspotIds([]);
      setQuestionResponses({});
      setImagePreview(null);
      setInfoPreview(null);
      setQuestionPreviewHotspotId(null);
      setIsScenePickerOpen(false);
      setSelectedHotspotId(null);
      setPlacementMode({ type: 'idle' });
      setImportError(null);
      setNoticeMessage(null);
      setSaveState('unsaved');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed due to an unknown error.');
    }
  };

  const handleResetLocalDraft = () => {
    const shouldReset = window.confirm(
      'Clear the local draft and reset to the starter project?\n\nThis will remove autosaved local changes.'
    );
    if (!shouldReset) {
      return;
    }

    clearLocalDraft();
    setProject(createDefaultProject());
    setDiscoveredHotspotIds([]);
    setQuestionResponses({});
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setImagePreviewBroken(false);
    setSelectedHotspotId(null);
    setPlacementMode({ type: 'idle' });
    setImportError(null);
    setNoticeMessage(null);
    setSaveState('unsaved');
    // Reset returns the app to the same first-run sequence used on a fresh start.
    setWalkthroughStepIndex(0);
    setEditWalkthroughDismissed(false);
    setOpenScenePickerAfterWalkthrough(true);
    setIsScenePickerOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(EDIT_WALKTHROUGH_DISMISSED_KEY);
    }
  };

  const handleToggleAppMode = () => {
    const nextMode: AppMode = appMode === 'edit' ? 'preview' : 'edit';
    setAppMode(nextMode);
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setIsScenePickerOpen(false);
    setPlacementMode({ type: 'idle' });

    if (nextMode === 'preview') {
      setPreviewEntryId((current) => current + 1);
      setSelectedHotspotId(null);
    }
  };

  const handleEnterPresentationMode = () => {
    setAppMode('preview');
    setPreviewEntryId((current) => current + 1);
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setIsScenePickerOpen(false);
    setPlacementMode({ type: 'idle' });
    setSelectedHotspotId(null);
  };

  const handleUploadScenePanorama = async (file: File) => {
    const result = await imageFileToDataUrl(file);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportError(null);
    setNoticeMessage(result.warning ?? null);
    handleUpdateActiveScenePanorama(result.dataUrl);
  };

  const handleCreateSceneFromImageFile = async (file: File) => {
    const result = await imageFileToDataUrl(file);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportError(null);
    setNoticeMessage(result.warning ?? `Created a new scene from "${deriveSceneNameFromFile(file, 'Captured Scene')}".`);
    handleCreateSceneFromPanorama(result.dataUrl, deriveSceneNameFromFile(file, `Scene ${project.scenes.length + 1}`));
  };

  const handleUploadHotspotImage = async (hotspotId: string, file: File) => {
    const result = await imageFileToDataUrl(file);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportError(null);
    setNoticeMessage(result.warning ?? null);
    handleUpdateHotspot(hotspotId, { imageUrl: result.dataUrl });
  };

  const handleStartEditWalkthrough = () => {
    // Manual replay should not re-trigger the first-run Scene Library handoff.
    setOpenScenePickerAfterWalkthrough(false);
    setIsScenePickerOpen(false);
    setWalkthroughStepIndex(0);
  };

  const handleDismissEditWalkthrough = () => {
    setWalkthroughStepIndex(null);
    setEditWalkthroughDismissed(true);
    setOpenScenePickerAfterWalkthrough(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EDIT_WALKTHROUGH_DISMISSED_KEY, '1');
    }
  };

  const handleWalkthroughNext = () => {
    if (walkthroughStepIndex === null) {
      return;
    }

    if (walkthroughStepIndex >= EDIT_WALKTHROUGH_STEPS.length - 1) {
      setWalkthroughStepIndex(null);
      setEditWalkthroughDismissed(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(EDIT_WALKTHROUGH_DISMISSED_KEY, '1');
      }
      if (openScenePickerAfterWalkthrough) {
        setIsScenePickerOpen(true);
        setOpenScenePickerAfterWalkthrough(false);
      }
      return;
    }

    setWalkthroughStepIndex(walkthroughStepIndex + 1);
  };

  const handleWalkthroughBack = () => {
    setWalkthroughStepIndex((current) => {
      if (current === null) {
        return null;
      }
      return Math.max(0, current - 1);
    });
  };

  const handleCreateProjectFromTemplate = (templateId: ProjectTemplateId) => {
    const replacingCurrent = hasProjectContent(project);
    if (replacingCurrent) {
      const shouldReplace = window.confirm(
        'Start a new project from template?\n\nThis will replace the current in-memory project. You can export first if needed.'
      );
      if (!shouldReplace) {
        return;
      }
    }

    const nextProject = createProjectFromTemplate(templateId);
    setProject(nextProject);
    setDiscoveredHotspotIds([]);
    setQuestionResponses({});
    setAppMode('edit');
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setImagePreviewBroken(false);
    setImportError(null);
    setNoticeMessage(null);
    setIsScenePickerOpen(false);
    setPlacementMode({ type: 'idle' });
    setSelectedHotspotId(null);
    setSaveState('unsaved');
  };

  const handleDismissPreviewHint = () => {
    setPreviewHintDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREVIEW_HINT_DISMISSED_KEY, '1');
    }
  };

  const handleClearSelectedHotspot = () => {
    setSelectedHotspotId(null);
    setActiveEditSection('hotspots');
    if (placementMode.type === 'movingExistingHotspot') {
      setPlacementMode({ type: 'idle' });
    }
  };

  const handleSelectHotspot = (hotspotId: string) => {
    setSelectedHotspotId(hotspotId);
    setActiveEditSection('hotspots');
    setIsContextPanelOpen(true);
  };

  const handleOpenScenePicker = () => {
    setIsScenePickerOpen(true);
    setImportError(null);
    setNoticeMessage(null);
  };

  const handleCloseScenePicker = () => {
    setIsScenePickerOpen(false);
    setOpenScenePickerAfterWalkthrough(false);
  };

  const handleApplySceneLibraryItem = (panoramaUrl: string, label: string) => {
    handleUpdateActiveScenePanorama(panoramaUrl);
    setIsScenePickerOpen(false);
    setImportError(null);
    setNoticeMessage(`Applied "${label}" to ${activeScene.name || 'the active scene'}.`);
  };

  const saveStateLabel =
    saveState === 'restored'
      ? 'Restored local draft'
      : saveState === 'unsaved'
        ? 'Unsaved changes'
        : 'Saved locally';

  const modeMessage =
    appMode === 'edit' && placementMode.type === 'placingNewHotspot'
      ? 'Click in the panorama to place a new insight zone.'
      : appMode === 'edit' && placementMode.type === 'movingExistingHotspot'
        ? 'Click in the panorama to move the selected insight zone.'
        : null;

  const viewerInteractionMode = appMode === 'preview' ? 'idle' : placementMode.type;
  // On the first-run path, onboarding overlays take precedence over the starter panorama.
  // Hold the viewer until the walkthrough / Scene Library handoff has completed.
  const shouldHoldInitialViewer =
    shouldRunFirstStartFlow && appMode === 'edit' && (activeWalkthroughStep !== null || isScenePickerOpen);

  return (
    <Layout
      title="XR Editor"
      subtitle="Local XR experience editor"
      mode={appMode}
      logoSrc="/branding/udeesa-logo.png"
      headerControls={
        <div className="header-mode-group">
          <span className="mode-indicator-pill">{appMode === 'edit' ? 'Edit Mode' : 'Preview Mode'}</span>
          {appMode === 'edit' ? (
            <button
              type="button"
              className="ui-button ui-button-primary mode-toggle-button"
              onClick={handleEnterPresentationMode}
            >
              Present Project
            </button>
          ) : (
            <button
              type="button"
              className="ui-button ui-button-secondary mode-toggle-button"
              onClick={handleToggleAppMode}
            >
              Return to Edit Mode
            </button>
          )}
        </div>
      }
      sidebar={
        appMode === 'edit' ? (
          <nav className="edit-nav-rail" aria-label="Editor sections">
            {[
              ['controls', 'Controls'],
              ['inspector', 'Project'],
              ['scenes', 'Scenes'],
              ['sceneDetails', 'Details'],
              ['hotspots', 'Insight Zones']
            ].map(([sectionId, label]) => {
              const isActive = activeEditSection === sectionId;
              return (
                <button
                  key={sectionId}
                  type="button"
                  className={`edit-rail-button ${isActive ? 'edit-rail-button-active' : ''}`}
                  onClick={() => {
                    setActiveEditSection(sectionId as EditSection);
                    setIsContextPanelOpen(true);
                  }}
                >
                  <span className="edit-rail-icon">
                    <RailIcon section={sectionId as EditSection} />
                  </span>
                  <span className="edit-rail-label">{label}</span>
                </button>
              );
            })}
          </nav>
        ) : null
      }
      contextPanel={
        appMode === 'edit' && isContextPanelOpen ? (
          <div className="context-panel-stack">
            <div className="context-panel-toolbar">
              <button
                type="button"
                className="context-panel-close"
                onClick={() => setIsContextPanelOpen(false)}
                aria-label="Close context panel"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {selectedHotspot ? (
              <section className="panel context-panel-primary">
                <div className="context-panel-heading">
                  <p className="sidebar-section-title">Selected Insight Zone</p>
                  <h2>Zone Editor</h2>
                  <p>Edit the selected insight zone with a clearer classroom-facing detail view.</p>
                </div>
                <HotspotEditor
                  hotspot={selectedHotspot}
                  destinationScenes={project.scenes.filter((scene) => scene.id !== activeScene.id)}
                  isPlacementModeActive={placementMode.type !== 'idle'}
                  onStartMovingHotspot={handleStartMovingSelectedHotspot}
                  onUploadHotspotImage={handleUploadHotspotImage}
                  onUpdateHotspot={handleUpdateHotspot}
                  onDeleteHotspot={handleDeleteHotspot}
                  onCloseEditor={handleClearSelectedHotspot}
                />
              </section>
            ) : (
              <section className="panel context-panel-primary context-panel-empty">
                <div className="context-panel-heading">
                  <p className="sidebar-section-title">Context</p>
                  <h2>Contextual Editing</h2>
                  <p>Select an insight zone to edit it here, or use the sections below to manage the scene.</p>
                </div>
              </section>
            )}
            <Sidebar
              activeSection={activeEditSection}
              project={project}
              projectStats={projectStats}
              scenes={project.scenes}
              activeSceneId={project.activeSceneId}
              activeScene={activeScene}
              hotspots={activeScene.hotspots}
              sceneNameById={sceneNameById}
              selectedHotspotId={selectedHotspotId}
              modeMessage={modeMessage}
              isPlacementModeActive={placementMode.type !== 'idle'}
              saveStateLabel={saveStateLabel}
              saveStateTone={saveState}
              templateOptions={PROJECT_TEMPLATE_OPTIONS}
              walkthroughSectionId={activeWalkthroughStep?.id ?? null}
              onAddScene={handleAddScene}
              onPresentProject={handleEnterPresentationMode}
              onCreateProjectFromTemplate={handleCreateProjectFromTemplate}
              onStartWalkthrough={handleStartEditWalkthrough}
              onOpenScenePicker={handleOpenScenePicker}
              onUpdateProjectMetadata={handleUpdateProjectMetadata}
              onSelectScene={handleSelectScene}
              onRenameActiveScene={handleRenameActiveScene}
              onUpdateActiveScenePanorama={handleUpdateActiveScenePanorama}
              onUploadScenePanorama={handleUploadScenePanorama}
              onCreateSceneFromImageFile={handleCreateSceneFromImageFile}
              onDeleteScene={handleDeleteScene}
              onAddHotspot={handleStartPlacingHotspot}
              onCancelPlacement={handleCancelPlacement}
              onExportProject={handleExportProject}
              onExportPresentationPackage={handleExportPresentationPackage}
              onImportProject={openImportFilePicker}
              onResetLocalDraft={handleResetLocalDraft}
              onSelectHotspot={handleSelectHotspot}
              onDeleteHotspot={handleDeleteHotspot}
            />
          </div>
        ) : null
      }
      main={
        <div className={`main-stack ${appMode === 'preview' ? 'main-stack-preview' : 'main-stack-edit'}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden-file-input"
            onChange={handleImportFileSelection}
          />
          {appMode === 'edit' ? (
            <section className="edit-workspace">
              {shouldHoldInitialViewer ? (
                <section className="panel panorama-panel viewer-card">
                  <h2 className="viewer-overlay-title">Your XR Media</h2>
                  <div className="pannellum-shell viewer-clip-boundary">
                    <div className="viewer-fallback-overlay" role="status" aria-live="polite">
                      <p className="placeholder-note">
                        Finish the guided setup, then choose a scene to begin your immersive environment.
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <PanoramaViewer
                  panoramaUrl={activeScene.panoramaUrl}
                  hotspots={activeScene.hotspots}
                  selectedHotspotId={selectedHotspotId}
                  isPreviewMode={false}
                  previewEntryId={0}
                  overlayContent={null}
                  editorPopoverContent={
                    selectedHotspot ? (
                      <div className="hotspot-popover-note">
                        <p className="hotspot-popover-kicker">Selected Zone</p>
                        <strong>{selectedHotspot.title || 'Untitled Insight Zone'}</strong>
                        <span>Continue editing in the details panel.</span>
                      </div>
                    ) : null
                  }
                  interactionMode={viewerInteractionMode}
                  onActivateHotspot={handleActivateHotspot}
                  onPanoramaClick={handlePanoramaClick}
                  onViewChange={setCurrentView}
                />
              )}
              {importError ? <p className="panel error-banner edit-toast">{importError}</p> : null}
              {noticeMessage ? <p className="panel info-banner edit-toast">{noticeMessage}</p> : null}
              {activeWalkthroughStep ? (
                <>
                  <div className="walkthrough-dim" />
                  <section className="walkthrough-card">
                    <p className="walkthrough-step">
                      Step {walkthroughStepIndex! + 1} of {EDIT_WALKTHROUGH_STEPS.length}
                    </p>
                    <h3>{activeWalkthroughStep.title}</h3>
                    <p>{activeWalkthroughStep.body}</p>
                    <div className="walkthrough-actions">
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={handleWalkthroughBack}
                        disabled={walkthroughStepIndex === 0}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={handleDismissEditWalkthrough}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-primary mini-button"
                        onClick={handleWalkthroughNext}
                      >
                        {walkthroughStepIndex === EDIT_WALKTHROUGH_STEPS.length - 1 ? 'Finish' : 'Next'}
                      </button>
                    </div>
                  </section>
                </>
              ) : null}
              {isScenePickerOpen ? (
                <div className="scene-picker-overlay" role="dialog" aria-modal="true" aria-label="Select a scene">
                  <div className="scene-picker-card">
                    <div className="scene-picker-header">
                      <div>
                        <p className="walkthrough-step">Scene Library</p>
                        <h3>Select a Scene</h3>
                        <p className="scene-picker-copy">
                          Choose one of seven local pilot environments and apply it to the active scene.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={handleCloseScenePicker}
                      >
                        Close
                      </button>
                    </div>
                    <div className="scene-library-grid">
                      {SCENE_LIBRARY_ITEMS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="scene-library-button"
                          onClick={() => handleApplySceneLibraryItem(item.panoramaUrl, item.label)}
                        >
                          <span className="scene-library-title">{item.label}</span>
                          <span className="scene-library-path">{item.panoramaUrl}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
          {appMode === 'preview' && importError ? <p className="presentation-toast">{importError}</p> : null}
          {appMode === 'preview' ? (
            <PanoramaViewer
              panoramaUrl={activeScene.panoramaUrl}
              hotspots={activeScene.hotspots}
              selectedHotspotId={selectedHotspotId}
              isPreviewMode
              previewEntryId={previewEntryId}
              overlayContent={
                <>
                  <div className="presentation-meta-overlay">
                    <div className="presentation-meta">
                      <div className="presentation-meta-top">
                        <div className="presentation-identity">
                          <p className="presentation-kicker">Presentation Mode</p>
                          <h2 className="presentation-title">{project.name || 'Untitled Project'}</h2>
                        </div>
                        <div className="presentation-meta-row">
                          <span>{activeScene.name || 'Untitled Scene'}</span>
                          <span>{project.scenes.length} scene(s)</span>
                        </div>
                      </div>
                      <div className="presentation-learning-card">
                        <p className="presentation-learning-kicker">Learning Goal</p>
                        <p className="presentation-description">
                          {project.description?.trim() ||
                            'Use this scene to guide discussion, observation, and reflection.'}
                        </p>
                      </div>
                    </div>
                    {!previewHintDismissed ? (
                      <div className="preview-hint-card">
                        <p>Tap hotspots to explore.</p>
                        <button
                          type="button"
                          className="ui-button ui-button-secondary mini-button"
                          onClick={handleDismissPreviewHint}
                        >
                          Hide
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="presentation-progress-overlay" role="status" aria-live="polite">
                    <div className="presentation-progress-card">
                      <div className="presentation-progress-header">
                        <p className="presentation-progress-kicker">Activity Progress</p>
                        <strong>
                          {discoveredHotspotIds.length}/{totalProgressPoints}
                        </strong>
                      </div>
                      <div className="presentation-progress-bar" aria-hidden="true">
                        <div
                          className="presentation-progress-fill"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="presentation-progress-label">
                        Insight Zones Found: {discoveredHotspotIds.length} of {totalProgressPoints}
                      </p>
                      {activeSceneQuestionHotspots.length > 0 ? (
                        <div className="presentation-score-block">
                          <p className="presentation-score-label">Scene Score</p>
                          <strong>
                            {activeSceneCorrectCount} / {activeSceneQuestionHotspots.length} correct
                          </strong>
                        </div>
                      ) : (
                        <p className="presentation-score-empty">No questions in this scene.</p>
                      )}
                    </div>
                  </div>
                </>
              }
              interactionMode={viewerInteractionMode}
              onActivateHotspot={handleActivateHotspot}
              onPanoramaClick={handlePanoramaClick}
              onViewChange={setCurrentView}
            />
          ) : null}
          {infoPreview ? (
            <div
              className="presentation-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Info hotspot details"
              onClick={() => setInfoPreview(null)}
            >
              <div className="presentation-modal info-preview-modal" onClick={(event) => event.stopPropagation()}>
                <div className="presentation-modal-header">
                  <div className="presentation-modal-heading">
                    <p className="presentation-modal-kicker">Insight Zone</p>
                    <h3>{infoPreview.title}</h3>
                  </div>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={() => setInfoPreview(null)}
                  >
                    Close
                  </button>
                </div>
                <p className="info-preview-body">{infoPreview.body || 'No details provided.'}</p>
              </div>
            </div>
          ) : null}
          {imagePreview ? (
            <div
              className="presentation-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={() => setImagePreview(null)}
            >
              <div className="presentation-modal image-preview-modal" onClick={(event) => event.stopPropagation()}>
                <div className="presentation-modal-header">
                  <div className="presentation-modal-heading">
                    <p className="presentation-modal-kicker">Image Hotspot</p>
                    <h3>{imagePreview.title}</h3>
                  </div>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={() => setImagePreview(null)}
                  >
                    Close
                  </button>
                </div>
                {imagePreviewBroken ? (
                  <p className="error-note">Unable to load image preview. Check the hotspot image URL.</p>
                ) : (
                  <>
                    <img
                      src={imagePreview.src}
                      alt={imagePreview.title}
                      className="image-preview-img"
                      onError={() => setImagePreviewBroken(true)}
                    />
                    {imagePreview.caption ? <p className="image-preview-caption">{imagePreview.caption}</p> : null}
                  </>
                )}
              </div>
            </div>
          ) : null}
          {activeQuestionEntry && activeQuestionConfig ? (
            <div
              className="presentation-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Multiple choice question"
              onClick={() => setQuestionPreviewHotspotId(null)}
            >
              <div className="presentation-modal quiz-preview-modal" onClick={(event) => event.stopPropagation()}>
                <div className="presentation-modal-header">
                  <div className="presentation-modal-heading">
                    <p className="presentation-modal-kicker">Multiple Choice</p>
                    <h3>{activeQuestionEntry.hotspot.title || 'Question'}</h3>
                  </div>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={() => setQuestionPreviewHotspotId(null)}
                  >
                    Close
                  </button>
                </div>
                <p className="quiz-question-prompt">{activeQuestionConfig.prompt}</p>
                <div className="quiz-choice-list">
                  {activeQuestionConfig.options.map((option, index) => {
                    const isAnswered = Boolean(activeQuestionResponse);
                    const isSelected = activeQuestionResponse?.selectedIndex === index;
                    const isCorrect = activeQuestionConfig.correctAnswerIndex === index;

                    return (
                      <button
                        key={`${activeQuestionEntry.hotspot.id}-option-${index}`}
                        type="button"
                        className={`quiz-choice-button ${
                          isAnswered
                            ? isCorrect
                              ? 'quiz-choice-correct'
                              : isSelected
                                ? 'quiz-choice-incorrect'
                                : ''
                            : ''
                        }`}
                        onClick={() => handleAnswerMultipleChoice(activeQuestionEntry.hotspot.id, index)}
                        disabled={isAnswered}
                      >
                        <span className="quiz-choice-index">{String.fromCharCode(65 + index)}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                {activeQuestionResponse ? (
                  <div
                    className={`quiz-result-banner ${
                      activeQuestionResponse.isCorrect ? 'quiz-result-correct' : 'quiz-result-incorrect'
                    }`}
                  >
                    <strong>{activeQuestionResponse.isCorrect ? 'Correct' : 'Not quite'}</strong>
                    <span>
                      {activeQuestionConfig.feedbackText ||
                        (activeQuestionResponse.isCorrect
                          ? 'Nice work. You found the correct answer.'
                          : `Correct answer: ${
                              activeQuestionConfig.options[activeQuestionConfig.correctAnswerIndex]
                            }`)}
                    </span>
                  </div>
                ) : (
                  <p className="quiz-helper-note">Choose one answer. Each question scores once per session.</p>
                )}
              </div>
            </div>
          ) : null}
          {appMode === 'preview' && showCompletionMessage ? (
            <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Experience complete">
              <div className="presentation-modal completion-modal">
                <div className="presentation-modal-heading">
                  <p className="presentation-modal-kicker">Experience Complete</p>
                  <h3>{project.name || 'XR Experience'}</h3>
                </div>
                <p className="completion-copy">
                  Every insight zone has been explored and every question has been answered for this session.
                </p>
                <div className="completion-stats">
                  <p>
                    Insight Zones Found <strong>{discoveredHotspotIds.length} / {totalProgressPoints}</strong>
                  </p>
                  <p>
                    Correct Answers <strong>{totalCorrectAnswers} / {totalQuestionCount}</strong>
                  </p>
                </div>
                <div className="editor-actions">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={() => {
                      setShowCompletionMessage(false);
                      setCompletionDismissed(true);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

export default App;
