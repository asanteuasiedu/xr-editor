import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import Layout from './components/Layout';
import AuthControls from './components/AuthControls';
import AuthModal, { type AuthModalMode } from './components/AuthModal';
import ExploreProjectsPanel from './components/ExploreProjectsPanel';
import ExternalExperienceViewer from './components/ExternalExperienceViewer';
import ProfileModal from './components/ProfileModal';
import ProjectAnalyticsDashboard from './components/ProjectAnalyticsDashboard';
import UserProfilePanel from './components/UserProfilePanel';
import ClassroomManagerPanel from './components/ClassroomManagerPanel';
import CreationOnboarding from './components/CreationOnboarding';
import Sidebar, { type EditSection } from './components/Sidebar';
import HotspotEditor from './components/HotspotEditor';
import PanoramaViewer from './components/PanoramaViewer';
import { EditIcon, PresentIcon } from './components/icons';
import { useAuth } from './context/AuthContext';
import { loadProjectAnalyticsEvents, trackProjectAnalyticsEvent } from './lib/analyticsService';
import {
  createProjectClassroom,
  deleteProjectClassroom,
  loadClassroomProjectBySlug,
  loadProjectClassrooms,
  updateProjectClassroom
} from './lib/classroomService';
import {
  deleteCloudProject,
  loadCloudProject,
  loadPublishedProjects,
  loadUserProjects,
  saveProjectToCloud,
  updateCloudProjectStatus
} from './lib/projectService';
import { isSupabaseConfigured } from './lib/supabaseClient';
import type { ProjectAnalyticsEvent } from './types/analytics';
import type { ProjectClassroom } from './types/classroom';
import type { CloudProject, CloudProjectWithProfile } from './types/cloudProject';
import type { ExternalFeaturedExperience } from './types/externalExperience';
import type { Hotspot, HotspotPolygonPoint, Project } from './types/project';
import {
  DEFAULT_REFLECTION_TITLE,
  DEFAULT_REFLECTION_PLACEHOLDER,
  DEFAULT_REFLECTION_PROMPT,
  getDefaultZoneMetadata
} from './types/project';
import { exportProjectToJson, importProjectFromFile } from './utils/exportImport';
import { imageFileToDataUrl } from './utils/fileAssets';
import { getBrowserName, getDeviceType, getOrCreateAnalyticsSessionId, resetAnalyticsSessionId } from './utils/analyticsSession';
import { getClassroomSlugFromPath } from './utils/classroomLinks';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from './utils/localDraft';
import { featuredExternalExperiences } from './data/featuredExternalExperiences';
import { SCENE_LIBRARY_ITEMS, STARTER_SCENE_PANORAMA_URL } from './utils/sceneLibrary';
import { createProjectFromTemplate } from './utils/templates';

const DEFAULT_PANORAMA_URL = STARTER_SCENE_PANORAMA_URL;

type PlacementMode =
  | { type: 'idle' }
  | { type: 'placingNewHotspot' }
  | { type: 'movingExistingHotspot'; hotspotId: string }
  | { type: 'drawingPolygon'; points: HotspotPolygonPoint[] };

type SaveState = 'saved' | 'unsaved' | 'restored';
type AppMode = 'edit' | 'preview' | 'arPreview';
type QuestionResponse = {
  selectedIndex: number;
  isCorrect: boolean;
  sceneId: string;
};
type RevealOrigin = {
  x: number;
  y: number;
};
type Generate360SceneApiResponse = {
  imageDataUrl?: string;
  revisedPrompt?: string;
  error?: string;
  message?: string;
};
type Generate360SceneRequestOptions = {
  mode?: 'improve';
  previousIssue?: string;
};
type Generate360SceneResult = {
  imageDataUrl: string;
  revisedPrompt?: string;
};
type CloudSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type CloudProjectsStatus = 'idle' | 'loading' | 'ready' | 'error';
type AnalyticsProjectSource = 'owned' | 'explore' | 'classroom' | null;
const PREVIEW_HINT_DISMISSED_KEY = 'xr-editor.preview-hint-dismissed.v1';
const EDIT_WALKTHROUGH_DISMISSED_KEY = 'xr-editor.edit-walkthrough-dismissed.v1';
const PREVIEW_INTERACTION_DEBUG = false;

const EDIT_WALKTHROUGH_STEPS = [
  {
    id: 'project',
    title: 'Project',
    body: 'Start here to name the project, review save status, reset the local draft, and launch walkthrough, scene, export, or presentation actions.'
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

function getActiveSceneFromProject(project: Project) {
  return project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0] ?? null;
}

function projectHasValidActiveScene(project: Project) {
  return Boolean(getActiveSceneFromProject(project)?.panoramaUrl.trim());
}

function isDevelopmentEnvironment() {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

function getErrorMessageLike(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const possibleMessage = (error as { message?: unknown }).message;
    return typeof possibleMessage === 'string' ? possibleMessage : '';
  }

  return '';
}

function getErrorCodeLike(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const possibleCode = (error as { code?: unknown }).code;
    return typeof possibleCode === 'string' ? possibleCode : '';
  }

  return '';
}

function getErrorDetailsLike(error: unknown) {
  if (error && typeof error === 'object' && 'details' in error) {
    const possibleDetails = (error as { details?: unknown }).details;
    return typeof possibleDetails === 'string' ? possibleDetails : '';
  }

  return '';
}

function getErrorHintLike(error: unknown) {
  if (error && typeof error === 'object' && 'hint' in error) {
    const possibleHint = (error as { hint?: unknown }).hint;
    return typeof possibleHint === 'string' ? possibleHint : '';
  }

  return '';
}

function getFriendlyCloudProjectErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Cloud project actions could not be completed right now.';
  }

  const normalized = error.message.trim().toLowerCase();

  if (
    normalized.includes('relation \"projects\" does not exist') ||
    normalized.includes('could not find the table')
  ) {
    return 'Project storage is not ready yet. Apply the Supabase projects SQL and try again.';
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security policy')
  ) {
    return 'Project permissions are not configured correctly in Supabase yet.';
  }

  if (normalized.includes('authentication is not configured')) {
    return 'Cloud project saving is not configured yet. Add the Supabase Vite environment variables to continue.';
  }

  if (normalized.includes('json')) {
    return 'This project could not be loaded from cloud storage because its saved data is invalid.';
  }

  return error.message;
}

function getFriendlyAnalyticsErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Analytics could not be loaded right now.';
  }

  const normalized = error.message.trim().toLowerCase();

  if (
    normalized.includes('relation "project_analytics_events" does not exist') ||
    normalized.includes('relation \"project_analytics_events\" does not exist') ||
    normalized.includes('could not find the table')
  ) {
    return 'Analytics storage is not ready yet. Apply the Supabase analytics SQL and try again.';
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security policy')
  ) {
    return 'Analytics permissions are not configured correctly in Supabase yet.';
  }

  if (normalized.includes('authentication is not configured')) {
    return 'Analytics is not configured yet. Add the Supabase Vite environment variables to continue.';
  }

  return error.message;
}

function getFriendlyClassroomErrorMessage(error: unknown) {
  const message = getErrorMessageLike(error);
  if (!message) {
    return 'Classroom links could not be loaded right now.';
  }

  const normalized = message.trim().toLowerCase();
  const errorCode = getErrorCodeLike(error);

  if (
    normalized.includes('relation "project_classrooms" does not exist') ||
    normalized.includes('relation \"project_classrooms\" does not exist') ||
    normalized.includes('could not find the table')
  ) {
    return 'Classroom links are not ready yet. Apply the Supabase classroom SQL and try again.';
  }

  if (
    errorCode === '42883' ||
    normalized.includes('could not find the function public.get_classroom_project_by_slug') ||
    normalized.includes('schema cache')
  ) {
    return 'Classroom loading setup is missing. Please apply the classroom project loader SQL in Supabase.';
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security policy')
  ) {
    return 'Classroom permissions are not configured correctly in Supabase yet.';
  }

  if (normalized.includes('authentication is not configured')) {
    return 'Classroom links are unavailable until Supabase is configured.';
  }

  if (normalized.includes('this classroom link is unavailable')) {
    return 'This classroom link is unavailable.';
  }

  if (normalized.includes('unable to load this classroom experience')) {
    return 'Unable to load this classroom experience. Please try again.';
  }

  return message;
}

function getFriendlyExploreErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Published experiences could not be loaded right now.';
  }

  const normalized = error.message.trim().toLowerCase();

  if (
    normalized.includes('relation "projects" does not exist') ||
    normalized.includes('relation \"projects\" does not exist') ||
    normalized.includes('could not find the table')
  ) {
    return 'Explore is not ready yet. Apply the Supabase projects SQL and try again.';
  }

  if (
    normalized.includes('relation "public_creator_profiles" does not exist') ||
    normalized.includes('relation \"public_creator_profiles\" does not exist')
  ) {
    return 'Explore creator profiles are not ready yet. Apply the published-project explore SQL and try again.';
  }

  if (normalized.includes('authentication is not configured')) {
    return 'Explore is unavailable until Supabase is configured.';
  }

  return error.message;
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

function getInitialClassroomSlug() {
  return getClassroomSlugFromPath();
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

  if (section === 'project') {
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

function deriveProjectNameFromPrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return 'Generated XR Project';
  }

  const words = trimmed.split(/\s+/).slice(0, 7);
  const label = words.join(' ').trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Generated XR Project';
}

function buildFreshProjectFromPanorama(params: {
  panoramaUrl: string;
  projectName: string;
  generationPrompt?: string;
}): Project {
  const baseProject = createProjectFromTemplate('blankTour');
  const activeSceneId = baseProject.activeSceneId;
  const normalizedProjectName = params.projectName.trim() || 'Untitled XR Project';
  const trimmedGenerationPrompt = params.generationPrompt?.trim();

  return {
    ...baseProject,
    name: normalizedProjectName,
    description: trimmedGenerationPrompt || baseProject.description,
    projectObjective: trimmedGenerationPrompt || baseProject.projectObjective,
    scenes: baseProject.scenes.map((scene) =>
      scene.id === activeSceneId
        ? {
            ...scene,
            name: 'Scene 1',
            panoramaUrl: params.panoramaUrl,
            hotspots: [],
            aiGenerated: trimmedGenerationPrompt ? true : undefined,
            generationPrompt: trimmedGenerationPrompt || undefined,
            generationAttemptCount: trimmedGenerationPrompt ? 1 : undefined
          }
        : scene
    )
  };
}

function getHotspotShape(hotspot: Hotspot) {
  return hotspot.shape === 'polygon' ? 'polygon' : 'point';
}

function getPolygonAnchorPosition(points: HotspotPolygonPoint[]) {
  const yaw = points.reduce((sum, point) => sum + point.yaw, 0) / points.length;
  const pitch = points.reduce((sum, point) => sum + point.pitch, 0) / points.length;

  return {
    yaw: Number(yaw.toFixed(2)),
    pitch: Number(pitch.toFixed(2))
  };
}

function polygonCrossesPanoramaSeam(points: HotspotPolygonPoint[]) {
  if (points.length < 3) {
    return false;
  }

  const yaws = points.map((point) => point.yaw);
  return Math.max(...yaws) - Math.min(...yaws) > 180;
}

async function requestGenerated360Scene(
  prompt: string,
  options?: Generate360SceneRequestOptions
): Promise<Generate360SceneResult> {
  console.info('[generate-360-scene] request started', {
    promptLength: prompt.trim().length,
    mode: options?.mode ?? 'default'
  });
  const response = await fetch('/api/generate-360-scene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      ...(options?.mode ? { mode: options.mode } : {}),
      ...(options?.previousIssue ? { previousIssue: options.previousIssue } : {})
    })
  });

  const data = (await response.json().catch(() => ({}))) as Generate360SceneApiResponse;
  console.info('[generate-360-scene] response received', {
    status: response.status,
    ok: response.ok,
    hasImageDataUrl: typeof data.imageDataUrl === 'string',
    imageDataUrlPrefix: typeof data.imageDataUrl === 'string' ? data.imageDataUrl.slice(0, 30) : null
  });

  if (!response.ok) {
    const fallbackMessage =
      response.status === 404
        ? 'Scene generation is not available in this environment yet.'
        : 'Scene generation could not finish. Try again.';
    console.error('[generate-360-scene] request failed', {
      status: response.status,
      message: data.error ?? data.message ?? fallbackMessage
    });
    throw new Error(data.error ?? data.message ?? fallbackMessage);
  }

  if (!data.imageDataUrl || !data.imageDataUrl.startsWith('data:image/')) {
    console.error('[generate-360-scene] usable image missing from response', {
      imageDataUrlPrefix: data.imageDataUrl?.slice(0, 30) ?? null
    });
    throw new Error('Scene generation finished without a usable image. Try again.');
  }

  return {
    imageDataUrl: data.imageDataUrl,
    revisedPrompt: data.revisedPrompt
  };
}

function getScreenSpaceMarkerPosition(hotspot: Hotspot, index: number) {
  const baseLeft = ((hotspot.yaw + 180) / 360) * 72 + 14;
  const baseTop = 52 - hotspot.pitch * 1.6 + ((index % 3) - 1) * 4;

  return {
    left: `${Math.min(86, Math.max(14, baseLeft))}%`,
    top: `${Math.min(78, Math.max(20, baseTop))}%`,
    animationDelay: `${index * 140}ms`
  };
}

function App() {
  const { user } = useAuth();
  const initialClassroomSlug = useMemo(() => getInitialClassroomSlug(), []);
  const isBootstrappingClassroomRoute = Boolean(initialClassroomSlug);
  const initialLoad = useMemo(() => loadLocalDraft(), []);
  const initialWalkthroughDismissed = useMemo(() => loadEditWalkthroughDismissed(), []);
  const initialProject = useMemo(
    () =>
      isBootstrappingClassroomRoute
        ? createDefaultProject()
        : initialLoad.restored
          ? initialLoad.project
          : createDefaultProject(),
    [initialLoad, isBootstrappingClassroomRoute]
  );
  const [project, setProject] = useState<Project>(
    initialProject
  );
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [, setCurrentView] = useState({ yaw: 0, pitch: 0 });
  const [appMode, setAppMode] = useState<AppMode>(isBootstrappingClassroomRoute ? 'preview' : 'edit');
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMyProjectsModalOpen, setIsMyProjectsModalOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [activeExternalExperience, setActiveExternalExperience] = useState<ExternalFeaturedExperience | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>({ type: 'idle' });
  const [importError, setImportError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(
    isBootstrappingClassroomRoute ? 'saved' : initialLoad.restored ? 'restored' : 'saved'
  );
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [activeCloudProjectOwnerId, setActiveCloudProjectOwnerId] = useState<string | null>(null);
  const [activeAnalyticsProjectId, setActiveAnalyticsProjectId] = useState<string | null>(null);
  const [activeAnalyticsProjectOwnerId, setActiveAnalyticsProjectOwnerId] = useState<string | null>(null);
  const [activeAnalyticsProjectSource, setActiveAnalyticsProjectSource] = useState<AnalyticsProjectSource>(null);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<CloudSaveStatus>('idle');
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [cloudProjectsStatus, setCloudProjectsStatus] = useState<CloudProjectsStatus>('idle');
  const [cloudProjectsError, setCloudProjectsError] = useState<string | null>(null);
  const [publishedProjects, setPublishedProjects] = useState<CloudProjectWithProfile[]>([]);
  const [publishedProjectsLoading, setPublishedProjectsLoading] = useState(false);
  const [publishedProjectsError, setPublishedProjectsError] = useState<string | null>(null);
  const [viewingPublishedProjectId, setViewingPublishedProjectId] = useState<string | null>(null);
  const [viewingPublishedProjectOwnerId, setViewingPublishedProjectOwnerId] = useState<string | null>(null);
  const [activeClassroom, setActiveClassroom] = useState<ProjectClassroom | null>(null);
  const [analyticsProject, setAnalyticsProject] = useState<CloudProject | null>(null);
  const [analyticsEvents, setAnalyticsEvents] = useState<ProjectAnalyticsEvent[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [classroomManagerProject, setClassroomManagerProject] = useState<CloudProject | null>(null);
  const [projectClassrooms, setProjectClassrooms] = useState<ProjectClassroom[]>([]);
  const [projectClassroomsLoading, setProjectClassroomsLoading] = useState(false);
  const [projectClassroomsError, setProjectClassroomsError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string; caption?: string } | null>(null);
  const [infoPreview, setInfoPreview] = useState<{ title: string; body: string } | null>(null);
  const [questionPreviewHotspotId, setQuestionPreviewHotspotId] = useState<string | null>(null);
  const [reflectionPreviewHotspotId, setReflectionPreviewHotspotId] = useState<string | null>(null);
  const [imagePreviewBroken, setImagePreviewBroken] = useState(false);
  const [discoveredHotspotIds, setDiscoveredHotspotIds] = useState<string[]>([]);
  const [questionResponses, setQuestionResponses] = useState<Record<string, QuestionResponse>>({});
  const [reflectionResponses, setReflectionResponses] = useState<Record<string, string>>({});
  const [showGuestEditPrompt, setShowGuestEditPrompt] = useState(false);
  const [previewHintDismissed, setPreviewHintDismissed] = useState(loadPreviewHintDismissed);
  const [, setEditWalkthroughDismissed] = useState(initialWalkthroughDismissed);
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState<number | null>(null);
  const [isScenePickerOpen, setIsScenePickerOpen] = useState(false);
  const [showCreationOnboarding, setShowCreationOnboarding] = useState(() =>
    isBootstrappingClassroomRoute ? false : !projectHasValidActiveScene(initialProject)
  );
  const [pendingWalkthroughAfterOnboarding, setPendingWalkthroughAfterOnboarding] = useState(false);
  const [previewEntryId, setPreviewEntryId] = useState(0);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [completionPendingAfterOverlayClose, setCompletionPendingAfterOverlayClose] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState<EditSection>('project');
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(!isBootstrappingClassroomRoute);
  const [areViewerOverlaysHidden, setAreViewerOverlaysHidden] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPreviewRequestId, setCameraPreviewRequestId] = useState(0);
  const [arPreviewSelectedHotspotId, setArPreviewSelectedHotspotId] = useState<string | null>(null);
  const [activePreviewHotspotId, setActivePreviewHotspotId] = useState<string | null>(null);
  const [previewRevealOrigin, setPreviewRevealOrigin] = useState<RevealOrigin | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const arVideoRef = useRef<HTMLVideoElement | null>(null);
  const arStreamRef = useRef<MediaStream | null>(null);
  const hasMountedRef = useRef(false);
  const noticeTimeoutRef = useRef<number | null>(null);
  const previewHotspotPulseTimeoutRef = useRef<number | null>(null);
  const previousAppModeRef = useRef<AppMode>('edit');
  const previousUserIdRef = useRef<string | null>(user?.id ?? null);
  const skipNextLocalDraftSaveRef = useRef(false);
  const analyticsSessionIdRef = useRef<string | null>(null);
  const analyticsProjectIdRef = useRef<string | null>(null);
  const analyticsUserIdRef = useRef<string | null>(null);
  const analyticsProjectOwnerIdRef = useRef<string | null>(null);
  const analyticsProjectSourceRef = useRef<AnalyticsProjectSource>(null);
  const analyticsClassroomIdRef = useRef<string | null>(null);
  const analyticsClassroomNameRef = useRef<string | null>(null);
  const analyticsShareSlugRef = useRef<string | null>(null);
  const lastTrackedPreviewSceneKeyRef = useRef<string | null>(null);
  const completedProjectSessionKeyRef = useRef<string | null>(null);
  const initialClassroomSlugRef = useRef(initialClassroomSlug);
  const hasResolvedInitialClassroomRouteRef = useRef(false);

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

  const trackPreviewAnalyticsEvent = useCallback(
    (event: Omit<ProjectAnalyticsEvent, 'project_id' | 'user_id' | 'session_id' | 'device_type' | 'browser_name'>) => {
      if (appMode !== 'preview' || !activeAnalyticsProjectId) {
        if (isDevelopmentEnvironment()) {
          console.info('[analytics] skipped', {
            reason: appMode !== 'preview' ? 'not_in_preview_mode' : 'missing_analytics_project_id',
            cloudProjectId,
            analyticsProjectId: activeAnalyticsProjectId,
            mode: appMode
          });
        }
        return;
      }

      const sessionId =
        analyticsSessionIdRef.current && analyticsProjectIdRef.current === activeAnalyticsProjectId
          ? analyticsSessionIdRef.current
          : getOrCreateAnalyticsSessionId(activeAnalyticsProjectId);
      const viewerIsOwner = Boolean(user?.id && activeAnalyticsProjectOwnerId === user.id);
      const analyticsSource =
        activeAnalyticsProjectSource === 'classroom'
          ? 'classroom'
          : activeAnalyticsProjectSource === 'explore'
            ? 'explore'
            : 'owner_preview';
      const activeClassroomId = activeClassroom?.id ?? null;
      const activeClassroomName = activeClassroom?.name ?? null;
      const activeShareSlug = activeClassroom?.share_slug ?? null;

      analyticsSessionIdRef.current = sessionId;
      analyticsProjectIdRef.current = activeAnalyticsProjectId;
      analyticsUserIdRef.current = user?.id ?? null;
      analyticsProjectOwnerIdRef.current = activeAnalyticsProjectOwnerId;
      analyticsProjectSourceRef.current = activeAnalyticsProjectSource;
      analyticsClassroomIdRef.current = activeClassroomId;
      analyticsClassroomNameRef.current = activeClassroomName;
      analyticsShareSlugRef.current = activeShareSlug;

      if (isDevelopmentEnvironment()) {
        console.info('[analytics] tracking event', {
          projectId: activeAnalyticsProjectId,
          eventType: event.event_type,
          sessionId,
          source: analyticsSource,
          classroomId: activeClassroomId,
          hasUser: Boolean(user?.id)
        });
      }

      void trackProjectAnalyticsEvent({
        ...event,
        project_id: activeAnalyticsProjectId,
        user_id: user?.id ?? null,
        classroom_id: activeClassroomId,
        classroom_name: activeClassroomName,
        share_slug: activeShareSlug,
        session_id: sessionId,
        device_type: getDeviceType(),
        browser_name: getBrowserName(),
        metadata: {
          ...(event.metadata ?? {}),
          source: analyticsSource,
          isPublicView: !viewerIsOwner,
          ownerId: activeAnalyticsProjectOwnerId,
          viewerIsOwner,
          classroomId: activeClassroomId,
          classroomName: activeClassroomName,
          shareSlug: activeShareSlug
        }
      });
    },
    [
      activeAnalyticsProjectId,
      activeAnalyticsProjectOwnerId,
      activeAnalyticsProjectSource,
      activeClassroom,
      appMode,
      cloudProjectId,
      user?.id
    ]
  );

  const handleOpenSignIn = useCallback(() => {
    setAuthModalMode('signIn');
  }, []);

  const handleOpenSignUp = useCallback(() => {
    setAuthModalMode('signUp');
  }, []);

  const handleCloseAuthModal = useCallback(() => {
    setAuthModalMode(null);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  const handleOpenProfileEditor = useCallback(() => {
    if (!user) {
      return;
    }

    setIsMyProjectsModalOpen(false);
    setIsProfileModalOpen(true);
  }, [user]);

  const refreshCloudProjects = useCallback(async () => {
    if (!user?.id) {
      setCloudProjects([]);
      setCloudProjectsStatus('idle');
      setCloudProjectsError(null);
      return;
    }

    setCloudProjectsStatus('loading');
    setCloudProjectsError(null);

    try {
      const projects = await loadUserProjects(user.id);
      setCloudProjects(projects);
      setCloudProjectsStatus('ready');
    } catch (error) {
      setCloudProjects([]);
      setCloudProjectsStatus('error');
      setCloudProjectsError(getFriendlyCloudProjectErrorMessage(error));
    }
  }, [user?.id]);

  const handleOpenProfile = useCallback(() => {
    if (!user) {
      return;
    }

    setIsMyProjectsModalOpen(true);
    void refreshCloudProjects();
  }, [refreshCloudProjects, user]);

  const handleOpenMyProjects = useCallback(() => {
    if (!user) {
      return;
    }

    setIsMyProjectsModalOpen(true);
    void refreshCloudProjects();
  }, [refreshCloudProjects, user]);

  const handleCloseMyProjectsModal = useCallback(() => {
    setIsMyProjectsModalOpen(false);
  }, []);

  const refreshPublishedProjects = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setPublishedProjects([]);
      setPublishedProjectsLoading(false);
      setPublishedProjectsError('Explore is unavailable until Supabase is configured.');
      return;
    }

    setPublishedProjectsLoading(true);
    setPublishedProjectsError(null);

    try {
      const projects = await loadPublishedProjects();
      setPublishedProjects(projects);
    } catch (error) {
      setPublishedProjects([]);
      setPublishedProjectsError(getFriendlyExploreErrorMessage(error));
    } finally {
      setPublishedProjectsLoading(false);
    }
  }, []);

  const handleOpenExplore = useCallback(() => {
    setIsExploreOpen(true);
    void refreshPublishedProjects();
  }, [refreshPublishedProjects]);

  const handleCloseExplore = useCallback(() => {
    setIsExploreOpen(false);
  }, []);

  const handleOpenExternalExperience = useCallback((experience: ExternalFeaturedExperience) => {
    setActiveExternalExperience(experience);
    setImportError(null);
    setNoticeMessage(null);

    // TODO: add a dedicated external experience analytics store if featured external opens
    // should be measured independently from native project analytics.
  }, []);

  const handleOpenFeaturedExperienceFromExplore = useCallback(
    (experience: ExternalFeaturedExperience) => {
      setIsExploreOpen(false);
      handleOpenExternalExperience(experience);
    },
    [handleOpenExternalExperience]
  );

  const handleOpenFeaturedExperienceFromCatalog = useCallback(
    (experience: ExternalFeaturedExperience) => {
      setIsScenePickerOpen(false);
      handleOpenExternalExperience(experience);
    },
    [handleOpenExternalExperience]
  );

  const handleCloseExternalExperience = useCallback(() => {
    setActiveExternalExperience(null);
  }, []);

  const handleCloseAnalyticsDashboard = useCallback(() => {
    setAnalyticsProject(null);
    setAnalyticsEvents([]);
    setAnalyticsLoading(false);
    setAnalyticsError(null);
  }, []);

  const loadAnalyticsForProject = useCallback(async (projectId: string) => {
    return loadProjectAnalyticsEvents({
      projectId
    });
  }, []);

  const handleViewProjectAnalytics = useCallback(
    async (cloudProject: CloudProject) => {
      if (!user?.id) {
        return;
      }

      setAnalyticsProject(cloudProject);
      setAnalyticsEvents([]);
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      try {
        const events = await loadAnalyticsForProject(cloudProject.id);
        setAnalyticsEvents(events);
      } catch (error) {
        setAnalyticsError(getFriendlyAnalyticsErrorMessage(error));
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [loadAnalyticsForProject, user?.id]
  );

  const handleRefreshProjectAnalytics = useCallback(async () => {
    if (!user?.id || !analyticsProject) {
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const events = await loadAnalyticsForProject(analyticsProject.id);
      setAnalyticsEvents(events);
    } catch (error) {
      setAnalyticsError(getFriendlyAnalyticsErrorMessage(error));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsProject, loadAnalyticsForProject, user?.id]);

  const handleCloseClassroomManager = useCallback(() => {
    setClassroomManagerProject(null);
    setProjectClassrooms([]);
    setProjectClassroomsLoading(false);
    setProjectClassroomsError(null);
  }, []);

  const refreshClassroomsForProject = useCallback(async (projectId: string) => {
    const classrooms = await loadProjectClassrooms(projectId);
    setProjectClassrooms(classrooms);
    setProjectClassroomsError(null);
  }, []);

  const handleManageProjectClassrooms = useCallback(
    async (cloudProject: CloudProject) => {
      if (!user?.id) {
        setImportError('Log in to manage classroom links.');
        setAuthModalMode('signIn');
        return;
      }

      if (!cloudProject.id.trim()) {
        setImportError('Save this project to your account before creating classroom links.');
        return;
      }

      if (cloudProject.user_id !== user.id) {
        setImportError('You can only create classroom links for projects you own.');
        return;
      }

      setClassroomManagerProject(cloudProject);
      setProjectClassrooms([]);
      setProjectClassroomsLoading(true);
      setProjectClassroomsError(null);

      try {
        await refreshClassroomsForProject(cloudProject.id);
      } catch (error) {
        setProjectClassroomsError(getFriendlyClassroomErrorMessage(error));
      } finally {
        setProjectClassroomsLoading(false);
      }
    },
    [refreshClassroomsForProject, user?.id]
  );

  const handleRefreshManagedClassrooms = useCallback(async () => {
    if (!classroomManagerProject) {
      return;
    }

    setProjectClassroomsLoading(true);
    setProjectClassroomsError(null);

    try {
      await refreshClassroomsForProject(classroomManagerProject.id);
    } catch (error) {
      setProjectClassroomsError(getFriendlyClassroomErrorMessage(error));
    } finally {
      setProjectClassroomsLoading(false);
    }
  }, [classroomManagerProject, refreshClassroomsForProject]);

  const handleCreateManagedClassroom = useCallback(
    async (name: string, description?: string) => {
      if (!user?.id || !classroomManagerProject) {
        throw new Error('Log in to manage classroom links.');
      }

      if (!classroomManagerProject.id.trim()) {
        throw new Error('Save this project to your account before creating classroom links.');
      }

      if (classroomManagerProject.user_id !== user.id) {
        throw new Error('You can only create classroom links for projects you own.');
      }

      const createdClassroom = await createProjectClassroom({
        projectId: classroomManagerProject.id,
        ownerUserId: user.id,
        name,
        description
      });

      setProjectClassrooms((currentClassrooms) => [createdClassroom, ...currentClassrooms]);
      setProjectClassroomsError(null);
    },
    [classroomManagerProject, user?.id]
  );

  const handleToggleManagedClassroom = useCallback(async (classroomId: string, isActive: boolean) => {
    const updatedClassroom = await updateProjectClassroom({
      classroomId,
      isActive
    });

    setProjectClassrooms((currentClassrooms) =>
      currentClassrooms.map((classroom) => (classroom.id === updatedClassroom.id ? updatedClassroom : classroom))
    );
    setProjectClassroomsError(null);
  }, []);

  const handleDeleteManagedClassroom = useCallback(
    async (classroomId: string) => {
      const targetClassroom = projectClassrooms.find((classroom) => classroom.id === classroomId);
      const classroomLabel = targetClassroom?.name || 'this classroom link';
      const shouldDelete = window.confirm(
        `Delete "${classroomLabel}"?\n\nLearners will no longer be able to open this classroom link.`
      );

      if (!shouldDelete) {
        return;
      }

      await deleteProjectClassroom(classroomId);
      setProjectClassrooms((currentClassrooms) =>
        currentClassrooms.filter((classroom) => classroom.id !== classroomId)
      );
      setProjectClassroomsError(null);
    },
    [projectClassrooms]
  );

  const upsertCloudProjectInState = useCallback((nextProject: CloudProject) => {
    setCloudProjects((currentProjects) => {
      const mergedProjects = [nextProject, ...currentProjects.filter((entry) => entry.id !== nextProject.id)];
      mergedProjects.sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
      return mergedProjects;
    });
    setCloudProjectsStatus('ready');
    setCloudProjectsError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewHotspotPulseTimeoutRef.current !== null) {
        window.clearTimeout(previewHotspotPulseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (skipNextLocalDraftSaveRef.current) {
      skipNextLocalDraftSaveRef.current = false;
      return;
    }

    const isViewingExternalPublishedProject =
      Boolean(viewingPublishedProjectId) && (!user?.id || viewingPublishedProjectOwnerId !== user.id);

    if (isViewingExternalPublishedProject || activeClassroom) {
      return;
    }

    setSaveState('unsaved');
    const timeoutId = window.setTimeout(() => {
      const saved = saveLocalDraft(project);
      setSaveState(saved ? 'saved' : 'unsaved');
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [activeClassroom, project, user?.id, viewingPublishedProjectId, viewingPublishedProjectOwnerId]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (cloudSaveStatus === 'saving') {
      return;
    }

    setCloudSaveStatus('idle');
  }, [project]);

  const activeScene = useMemo(
    () => project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0],
    [project]
  );
  const currentUserId = user?.id ?? null;
  const isAuthenticated = Boolean(user);
  const isOwnedCloudProject = Boolean(currentUserId && cloudProjectId && activeCloudProjectOwnerId === currentUserId);
  const isViewingPublishedProject = Boolean(viewingPublishedProjectId);
  const isViewingClassroomProject = Boolean(activeClassroom);
  const isViewingOtherUsersPublishedProject = Boolean(
    viewingPublishedProjectId &&
      viewingPublishedProjectOwnerId &&
      (!currentUserId || viewingPublishedProjectOwnerId !== currentUserId)
  );
  const isViewingPublicProject = isViewingPublishedProject && !isOwnedCloudProject;
  const isViewingOwnedPublishedProject = Boolean(
    isViewingPublishedProject && currentUserId && viewingPublishedProjectOwnerId === currentUserId
  );
  const canEditCurrentProject =
    Boolean(currentUserId) &&
    !isViewingClassroomProject &&
    (!isViewingPublishedProject || viewingPublishedProjectOwnerId === currentUserId || isOwnedCloudProject);
  const isCreationOnboardingActive = appMode === 'edit' && showCreationOnboarding;
  const publicProjectHelperMessage = !isViewingPublishedProject
    ? null
    : isAuthenticated
      ? isViewingOtherUsersPublishedProject
        ? 'Viewing a published experience. Save a copy to edit your own version.'
        : 'Viewing your published experience.'
      : 'Viewing a published experience. Sign in to save a copy and edit this experience.';
  const showSaveCopyAction = Boolean(user && isViewingOtherUsersPublishedProject);
  const isGuestPreviewingUnownedScene = Boolean(
    !isAuthenticated && !isViewingPublishedProject && !isViewingClassroomProject && projectHasValidActiveScene(project)
  );
  const activeWalkthroughStep = walkthroughStepIndex === null ? null : EDIT_WALKTHROUGH_STEPS[walkthroughStepIndex];

  useEffect(() => {
    if (appMode !== 'edit' || !activeWalkthroughStep) {
      return;
    }

    setActiveEditSection(activeWalkthroughStep.id);
    setIsContextPanelOpen(true);
    setSelectedHotspotId(null);
  }, [activeWalkthroughStep, appMode]);

  useEffect(() => {
    if (canEditCurrentProject) {
      return;
    }

    if (appMode === 'edit' && !isCreationOnboardingActive) {
      setAppMode('preview');
      setIsContextPanelOpen(false);
      setSelectedHotspotId(null);
      setPlacementMode({ type: 'idle' });
      setIsScenePickerOpen(false);
      setImagePreview(null);
      setInfoPreview(null);
      setQuestionPreviewHotspotId(null);
      setReflectionPreviewHotspotId(null);
      return;
    }

    if (appMode === 'arPreview') {
      setAppMode('preview');
      setCameraError(null);
      setArPreviewSelectedHotspotId(null);
    }
  }, [appMode, canEditCurrentProject, isCreationOnboardingActive]);

  useEffect(() => {
    if (
      !pendingWalkthroughAfterOnboarding ||
      showCreationOnboarding ||
      isScenePickerOpen ||
      appMode !== 'edit' ||
      !projectHasValidActiveScene(project)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveEditSection('project');
      setIsContextPanelOpen(true);
      setSelectedHotspotId(null);
      setWalkthroughStepIndex(0);
      setPendingWalkthroughAfterOnboarding(false);
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [appMode, isScenePickerOpen, pendingWalkthroughAfterOnboarding, project, showCreationOnboarding]);

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
  const activeReflectionHotspot = useMemo(
    () =>
      reflectionPreviewHotspotId
        ? activeScene.hotspots.find(
            (hotspot) => hotspot.id === reflectionPreviewHotspotId && hotspot.type === 'reflection'
          ) ?? null
        : null,
    [activeScene.hotspots, reflectionPreviewHotspotId]
  );
  const activeReflectionResponse = activeReflectionHotspot
    ? reflectionResponses[activeReflectionHotspot.id] ?? ''
    : '';
  const totalProgressPoints = useMemo(
    () => project.scenes.reduce((count, scene) => count + scene.hotspots.length, 0),
    [project.scenes]
  );
  const progressPercent = totalProgressPoints === 0 ? 0 : (discoveredHotspotIds.length / totalProgressPoints) * 100;
  const getProjectedProgressValue = useCallback(
    (hotspotId?: string) => {
      if (!hotspotId || totalProgressPoints === 0) {
        return Number(progressPercent.toFixed(2));
      }

      const nextCount = discoveredHotspotIds.includes(hotspotId)
        ? discoveredHotspotIds.length
        : discoveredHotspotIds.length + 1;

      return Number(((nextCount / totalProgressPoints) * 100).toFixed(2));
    },
    [discoveredHotspotIds, progressPercent, totalProgressPoints]
  );
  const buildHotspotAnalyticsMetadata = useCallback(
    (hotspot: Hotspot, sceneId: string, sceneName: string, extra?: Record<string, unknown>) => ({
      sceneId,
      sceneName,
      shape: getHotspotShape(hotspot),
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
      ...(hotspot.polygonPoints?.length
        ? {
            polygonPoints: hotspot.polygonPoints.map((point) => ({
              yaw: point.yaw,
              pitch: point.pitch
            }))
          }
        : {}),
      ...(hotspot.type === 'reflection' && hotspot.reflectionPrompt?.trim()
        ? { reflectionPrompt: hotspot.reflectionPrompt.trim() }
        : {}),
      ...(extra ?? {})
    }),
    []
  );
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
  const arPreviewHotspots = useMemo(() => activeScene.hotspots.slice(0, 8), [activeScene.hotspots]);
  const arPreviewSelectedHotspot = useMemo(
    () => arPreviewHotspots.find((hotspot) => hotspot.id === arPreviewSelectedHotspotId) ?? null,
    [arPreviewHotspots, arPreviewSelectedHotspotId]
  );
  const isExperienceComplete =
    totalProgressPoints > 0 &&
    discoveredHotspotIds.length === totalProgressPoints &&
    answeredQuestionCount === totalQuestionCount;
  const hasActivePreviewOverlay = Boolean(
    infoPreview || imagePreview || questionPreviewHotspotId || reflectionPreviewHotspotId
  );

  useEffect(() => {
    const enteringPreview = previousAppModeRef.current !== 'preview' && appMode === 'preview';
    previousAppModeRef.current = appMode;

    if (!PREVIEW_INTERACTION_DEBUG || !enteringPreview) {
      return;
    }

    console.info('[preview-interaction-debug] app preview entered', {
      appMode,
      selectedHotspotId,
      hasInfoPreview: Boolean(infoPreview),
      hasImagePreview: Boolean(imagePreview),
      hasQuestionPreview: Boolean(questionPreviewHotspotId),
      hasReflectionPreview: Boolean(reflectionPreviewHotspotId),
      hasActivePreviewOverlay,
      showCreationOnboarding,
      areViewerOverlaysHidden,
      isContextPanelOpen,
      isScenePickerOpen,
      placementMode: placementMode.type
    });
  }, [
    appMode,
    areViewerOverlaysHidden,
    hasActivePreviewOverlay,
    imagePreview,
    infoPreview,
    isContextPanelOpen,
    isScenePickerOpen,
    placementMode.type,
    questionPreviewHotspotId,
    reflectionPreviewHotspotId,
    selectedHotspotId,
    showCreationOnboarding
  ]);

  useEffect(() => {
    if (!isExperienceComplete) {
      setShowCompletionMessage(false);
      setCompletionDismissed(false);
      setCompletionPendingAfterOverlayClose(false);
      return;
    }

    if (completionDismissed) {
      return;
    }

    if (hasActivePreviewOverlay) {
      setShowCompletionMessage(false);
      setCompletionPendingAfterOverlayClose(true);
      return;
    }

    if (completionPendingAfterOverlayClose || !hasActivePreviewOverlay) {
      setShowCompletionMessage(true);
      setCompletionPendingAfterOverlayClose(false);
    }
  }, [
    completionDismissed,
    completionPendingAfterOverlayClose,
    hasActivePreviewOverlay,
    isExperienceComplete
  ]);

  useEffect(() => {
    const endAnalyticsSession = (reason: 'preview_exit' | 'project_switch' | 'tracking_unavailable') => {
      const previousProjectId = analyticsProjectIdRef.current;
      const previousSessionId = analyticsSessionIdRef.current;
      const previousUserId = analyticsUserIdRef.current;
      const previousOwnerId = analyticsProjectOwnerIdRef.current;
      const previousSource = analyticsProjectSourceRef.current;
      const previousClassroomId = analyticsClassroomIdRef.current;
      const previousClassroomName = analyticsClassroomNameRef.current;
      const previousShareSlug = analyticsShareSlugRef.current;
      const viewerIsOwner = Boolean(previousUserId && previousOwnerId && previousUserId === previousOwnerId);
      const normalizedSource =
        previousSource === 'classroom'
          ? 'classroom'
          : previousSource === 'explore'
            ? 'explore'
            : 'owner_preview';

      if (previousProjectId && previousSessionId) {
        if (isDevelopmentEnvironment()) {
          console.info('[analytics] tracking event', {
            projectId: previousProjectId,
            eventType: 'session_end',
            sessionId: previousSessionId,
            source: normalizedSource,
            classroomId: previousClassroomId,
            hasUser: Boolean(previousUserId)
          });
        }

        void trackProjectAnalyticsEvent({
          project_id: previousProjectId,
          user_id: previousUserId ?? null,
          classroom_id: previousClassroomId,
          classroom_name: previousClassroomName,
          share_slug: previousShareSlug,
          session_id: previousSessionId,
          event_type: 'session_end',
          progress_value: Number(progressPercent.toFixed(2)),
          device_type: getDeviceType(),
          browser_name: getBrowserName(),
          metadata: {
            reason,
            source: normalizedSource,
            isPublicView: !viewerIsOwner,
            ownerId: previousOwnerId,
            viewerIsOwner,
            classroomId: previousClassroomId,
            classroomName: previousClassroomName,
            shareSlug: previousShareSlug
          }
        });
      }

      if (previousProjectId) {
        resetAnalyticsSessionId(previousProjectId);
      }

      analyticsSessionIdRef.current = null;
      analyticsProjectIdRef.current = null;
      analyticsUserIdRef.current = null;
      analyticsProjectOwnerIdRef.current = null;
      analyticsProjectSourceRef.current = null;
      analyticsClassroomIdRef.current = null;
      analyticsClassroomNameRef.current = null;
      analyticsShareSlugRef.current = null;
      lastTrackedPreviewSceneKeyRef.current = null;
      completedProjectSessionKeyRef.current = null;
    };

    if (appMode !== 'preview' || !activeAnalyticsProjectId) {
      endAnalyticsSession(appMode === 'preview' ? 'tracking_unavailable' : 'preview_exit');
      return;
    }

    if (
      analyticsProjectIdRef.current &&
      analyticsSessionIdRef.current &&
      analyticsProjectIdRef.current !== activeAnalyticsProjectId
    ) {
      endAnalyticsSession('project_switch');
    }

    if (analyticsSessionIdRef.current && analyticsProjectIdRef.current === activeAnalyticsProjectId) {
      analyticsUserIdRef.current = user?.id ?? null;
      analyticsProjectOwnerIdRef.current = activeAnalyticsProjectOwnerId;
      analyticsProjectSourceRef.current = activeAnalyticsProjectSource;
      analyticsClassroomIdRef.current = activeClassroom?.id ?? null;
      analyticsClassroomNameRef.current = activeClassroom?.name ?? null;
      analyticsShareSlugRef.current = activeClassroom?.share_slug ?? null;
      return;
    }

    const sessionId = getOrCreateAnalyticsSessionId(activeAnalyticsProjectId);
    analyticsSessionIdRef.current = sessionId;
    analyticsProjectIdRef.current = activeAnalyticsProjectId;
    analyticsUserIdRef.current = user?.id ?? null;
    analyticsProjectOwnerIdRef.current = activeAnalyticsProjectOwnerId;
    analyticsProjectSourceRef.current = activeAnalyticsProjectSource;
    analyticsClassroomIdRef.current = activeClassroom?.id ?? null;
    analyticsClassroomNameRef.current = activeClassroom?.name ?? null;
    analyticsShareSlugRef.current = activeClassroom?.share_slug ?? null;
    lastTrackedPreviewSceneKeyRef.current = null;
    completedProjectSessionKeyRef.current = null;

    trackPreviewAnalyticsEvent({
      event_type: 'session_start',
      scene_id: activeScene.id,
      scene_name: activeScene.name || 'Untitled Scene',
      progress_value: Number(progressPercent.toFixed(2)),
      metadata: {
        source: activeAnalyticsProjectSource,
        classroomId: activeClassroom?.id ?? null,
        classroomName: activeClassroom?.name ?? null,
        shareSlug: activeClassroom?.share_slug ?? null,
        totalScenes: project.scenes.length,
        totalHotspots: totalProgressPoints
      }
    });
  }, [
    activeClassroom,
    activeAnalyticsProjectId,
    activeAnalyticsProjectOwnerId,
    activeAnalyticsProjectSource,
    activeScene.id,
    activeScene.name,
    appMode,
    progressPercent,
    project.scenes.length,
    totalProgressPoints,
    trackPreviewAnalyticsEvent,
    user?.id
  ]);

  useEffect(() => {
    if (appMode !== 'preview' || !activeAnalyticsProjectId || !analyticsSessionIdRef.current) {
      return;
    }

    const sceneKey = `${analyticsSessionIdRef.current}:${activeScene.id}`;
    if (lastTrackedPreviewSceneKeyRef.current === sceneKey) {
      return;
    }

    lastTrackedPreviewSceneKeyRef.current = sceneKey;
    trackPreviewAnalyticsEvent({
      event_type: 'scene_view',
      scene_id: activeScene.id,
      scene_name: activeScene.name || 'Untitled Scene',
      progress_value: Number(progressPercent.toFixed(2)),
      metadata: {
        hotspotCount: activeScene.hotspots.length
      }
    });
  }, [
    activeScene.hotspots.length,
    activeScene.id,
    activeScene.name,
    activeAnalyticsProjectId,
    appMode,
    progressPercent,
    trackPreviewAnalyticsEvent
  ]);

  useEffect(() => {
    if (
      appMode !== 'preview' ||
      !activeAnalyticsProjectId ||
      !analyticsSessionIdRef.current ||
      !isExperienceComplete
    ) {
      return;
    }

    const sessionKey = `${activeAnalyticsProjectId}:${analyticsSessionIdRef.current}`;
    if (completedProjectSessionKeyRef.current === sessionKey) {
      return;
    }

    completedProjectSessionKeyRef.current = sessionKey;
    trackPreviewAnalyticsEvent({
      event_type: 'project_complete',
      scene_id: activeScene.id,
      scene_name: activeScene.name || 'Untitled Scene',
      progress_value: 100,
      metadata: {
        answeredQuestionCount,
        totalQuestionCount,
        totalCorrectAnswers
      }
    });
  }, [
    activeScene.id,
    activeScene.name,
    activeAnalyticsProjectId,
    answeredQuestionCount,
    appMode,
    isExperienceComplete,
    totalCorrectAnswers,
    totalQuestionCount,
    trackPreviewAnalyticsEvent
  ]);

  const handleCloseInfoPreview = () => {
    setInfoPreview(null);
  };

  const handleCloseImagePreview = () => {
    setImagePreview(null);
  };

  const handleCloseQuestionPreview = () => {
    setQuestionPreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
  };

  const handleCloseReflectionPreview = () => {
    setReflectionPreviewHotspotId(null);
  };

  useEffect(() => {
    if (appMode !== 'preview') {
      setActivePreviewHotspotId(null);
      setReflectionPreviewHotspotId(null);
      setPreviewRevealOrigin(null);
    }
  }, [appMode]);

  useEffect(() => {
    setActivePreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
    setPreviewRevealOrigin(null);
  }, [activeScene.id]);

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
    patch: Partial<
      Pick<
        Project,
        'name' | 'description' | 'authorOrOrganization' | 'projectObjective' | 'targetAgeOrGradeBand' | 'subjectOrDomain'
      >
    >
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
    setReflectionPreviewHotspotId(null);
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
    setReflectionPreviewHotspotId(null);
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
          mediaType: 'image',
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

  const handleUpdateActiveSceneMedia = (panoramaUrl: string) => {
    setProject((currentProject) => ({
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === currentProject.activeSceneId
          ? {
              ...scene,
              mediaType: 'image',
              panoramaUrl,
              aiGenerated: undefined,
              generationPrompt: undefined,
              generationAttemptCount: undefined
            }
          : scene
      )
    }));
    setActiveEditSection('scenes');
    setIsContextPanelOpen(true);
  };

  const handleCreateSceneFromMedia = (panoramaUrl: string, sceneName?: string) => {
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
          mediaType: 'image',
          panoramaUrl,
          aiGenerated: undefined,
          generationPrompt: undefined,
          generationAttemptCount: undefined,
          hotspots: []
        }
      ]
    }));

    setActiveEditSection('scenes');
    setIsContextPanelOpen(true);
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
    setReflectionPreviewHotspotId(null);
    setPlacementMode({ type: 'idle' });
    setIsScenePickerOpen(false);
  };

  const handleStartPlacingHotspot = () => {
    if (!canEditCurrentProject) {
      return;
    }

    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
    setActiveEditSection('hotspots');
    setIsContextPanelOpen(true);
    setPlacementMode({ type: 'placingNewHotspot' });
  };

  const handleStartDrawingPolygonHotspot = () => {
    if (!canEditCurrentProject) {
      return;
    }

    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
    setActiveEditSection('hotspots');
    setIsContextPanelOpen(true);
    setPlacementMode({ type: 'drawingPolygon', points: [] });
  };

  const openHotspotDetails = useCallback((hotspotId: string) => {
    setSelectedHotspotId(hotspotId);
    setActiveEditSection('hotspots');
    setIsContextPanelOpen(true);
  }, []);

  const handleCreateHotspotAtPosition = useCallback(
    ({ yaw, pitch }: { yaw: number; pitch: number }) => {
      const hotspotId = `hotspot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const nextHotspot: Hotspot = {
        id: hotspotId,
        shape: 'point',
        type: 'info',
        ...getDefaultZoneMetadata('info'),
        title: 'New Insight Zone',
        body: 'Add description here',
        yaw: Number(yaw.toFixed(2)),
        pitch: Number(pitch.toFixed(2))
      };

      updateHotspots((current) => [...current, nextHotspot]);
      openHotspotDetails(hotspotId);
      setPlacementMode({ type: 'idle' });
      showTemporaryNotice('Insight Zone placed');
    },
    [openHotspotDetails, showTemporaryNotice, updateHotspots]
  );

  const handleUndoPolygonPoint = useCallback(() => {
    setPlacementMode((currentMode) => {
      if (currentMode.type !== 'drawingPolygon' || currentMode.points.length === 0) {
        return currentMode;
      }

      return {
        type: 'drawingPolygon',
        points: currentMode.points.slice(0, -1)
      };
    });
  }, []);

  const handleFinishPolygonHotspot = useCallback(() => {
    if (placementMode.type !== 'drawingPolygon') {
      return;
    }

    if (placementMode.points.length < 3) {
      showTemporaryNotice('Add at least 3 points to finish the polygon');
      return;
    }

    if (polygonCrossesPanoramaSeam(placementMode.points)) {
      setImportError('Polygon zones that cross the panorama seam are not supported yet.');
      return;
    }

    const hotspotId = `hotspot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const anchor = getPolygonAnchorPosition(placementMode.points);
    const nextHotspot: Hotspot = {
      id: hotspotId,
      shape: 'polygon',
      type: 'info',
      ...getDefaultZoneMetadata('info'),
      title: 'New Polygon Zone',
      body: 'Add description here',
      yaw: anchor.yaw,
      pitch: anchor.pitch,
      polygonPoints: placementMode.points.map((point) => ({
        yaw: Number(point.yaw.toFixed(2)),
        pitch: Number(point.pitch.toFixed(2))
      }))
    };

    updateHotspots((current) => [...current, nextHotspot]);
    openHotspotDetails(hotspotId);
    setPlacementMode({ type: 'idle' });
    showTemporaryNotice('Polygon zone created');
  }, [openHotspotDetails, placementMode, showTemporaryNotice, updateHotspots]);

  const handleStartMovingSelectedHotspot = () => {
    if (!canEditCurrentProject) {
      return;
    }

    if (!selectedHotspotId || !selectedHotspot || getHotspotShape(selectedHotspot) === 'polygon') {
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
    (hotspotId: string, anchor?: RevealOrigin) => {
      if (placementMode.type !== 'idle') {
        return;
      }

      const clickedHotspot = activeScene.hotspots.find((hotspot) => hotspot.id === hotspotId);
      if (!clickedHotspot) {
        return;
      }

      const sceneName = activeScene.name || 'Untitled Scene';
      const hotspotTitle = clickedHotspot.title || 'Untitled Insight Zone';

      if (appMode === 'preview') {
        trackPreviewAnalyticsEvent({
          event_type: 'hotspot_open',
          scene_id: activeScene.id,
          scene_name: sceneName,
          hotspot_id: clickedHotspot.id,
          hotspot_title: hotspotTitle,
          hotspot_type: clickedHotspot.type,
          progress_value: Number(progressPercent.toFixed(2)),
          metadata: buildHotspotAnalyticsMetadata(clickedHotspot, activeScene.id, sceneName)
        });

        setActivePreviewHotspotId(hotspotId);
        if (clickedHotspot.type !== 'reflection') {
          setDiscoveredHotspotIds((current) => (current.includes(hotspotId) ? current : [...current, hotspotId]));
        }
      }

      if (clickedHotspot.type === 'reflection') {
        if (appMode === 'preview') {
          setPreviewRevealOrigin(anchor ?? null);
          setImagePreview(null);
          setInfoPreview(null);
          setQuestionPreviewHotspotId(null);
          setReflectionPreviewHotspotId(hotspotId);
          setSelectedHotspotId(null);
          return;
        }

        setImagePreview(null);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setReflectionPreviewHotspotId(null);
        openHotspotDetails(hotspotId);
        return;
      }

      if (clickedHotspot.type === 'multipleChoice') {
        if (appMode === 'preview') {
          setPreviewRevealOrigin(anchor ?? null);
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
        setReflectionPreviewHotspotId(null);
        openHotspotDetails(hotspotId);
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
        setPreviewRevealOrigin(null);
        setImagePreview(null);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setReflectionPreviewHotspotId(null);
        setSelectedHotspotId(null);
        setPlacementMode({ type: 'idle' });
        trackPreviewAnalyticsEvent({
          event_type: 'hotspot_complete',
          scene_id: activeScene.id,
          scene_name: sceneName,
          hotspot_id: clickedHotspot.id,
          hotspot_title: hotspotTitle,
          hotspot_type: clickedHotspot.type,
          progress_value: getProjectedProgressValue(hotspotId),
          metadata: buildHotspotAnalyticsMetadata(clickedHotspot, activeScene.id, sceneName)
        });
        return;
      }

      if (clickedHotspot.type === 'externalLink') {
        const normalized = normalizeExternalLink(clickedHotspot.url ?? '');
        if (!normalized) {
          setImportError('External Link hotspot has an invalid or missing URL.');
          openHotspotDetails(hotspotId);
          return;
        }

        window.open(normalized, '_blank', 'noopener,noreferrer');
        setPreviewRevealOrigin(anchor ?? null);
        setImagePreview(null);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setReflectionPreviewHotspotId(null);
        if (appMode === 'edit') {
          openHotspotDetails(hotspotId);
        } else {
          setSelectedHotspotId(hotspotId);
          trackPreviewAnalyticsEvent({
            event_type: 'hotspot_complete',
            scene_id: activeScene.id,
            scene_name: sceneName,
            hotspot_id: clickedHotspot.id,
            hotspot_title: hotspotTitle,
            hotspot_type: clickedHotspot.type,
            progress_value: getProjectedProgressValue(hotspotId),
            metadata: buildHotspotAnalyticsMetadata(clickedHotspot, activeScene.id, sceneName)
          });
        }
        return;
      }

      if (clickedHotspot.type === 'image') {
        const src = (clickedHotspot.imageUrl ?? '').trim();
        if (!src) {
          setImportError('Image hotspot is missing an image URL.');
          openHotspotDetails(hotspotId);
          return;
        }

        setPreviewRevealOrigin(anchor ?? null);
        setImagePreview({
          src,
          title: clickedHotspot.title || 'Image Preview',
          caption: clickedHotspot.body || undefined
        });
        setImagePreviewBroken(false);
        setInfoPreview(null);
        setQuestionPreviewHotspotId(null);
        setReflectionPreviewHotspotId(null);
        if (appMode === 'edit') {
          openHotspotDetails(hotspotId);
        } else {
          setSelectedHotspotId(hotspotId);
          trackPreviewAnalyticsEvent({
            event_type: 'hotspot_complete',
            scene_id: activeScene.id,
            scene_name: sceneName,
            hotspot_id: clickedHotspot.id,
            hotspot_title: hotspotTitle,
            hotspot_type: clickedHotspot.type,
            progress_value: getProjectedProgressValue(hotspotId),
            metadata: buildHotspotAnalyticsMetadata(clickedHotspot, activeScene.id, sceneName)
          });
        }
        return;
      }

      if (appMode === 'preview') {
        setSelectedHotspotId(null);
        setImagePreview(null);
        setPreviewRevealOrigin(anchor ?? null);
        setInfoPreview({
          title: clickedHotspot.title || 'Info',
          body: clickedHotspot.body || 'No details provided.'
        });
        setQuestionPreviewHotspotId(null);
        setReflectionPreviewHotspotId(null);
        trackPreviewAnalyticsEvent({
          event_type: 'hotspot_complete',
          scene_id: activeScene.id,
          scene_name: sceneName,
          hotspot_id: clickedHotspot.id,
          hotspot_title: hotspotTitle,
          hotspot_type: clickedHotspot.type,
          progress_value: getProjectedProgressValue(hotspotId),
          metadata: buildHotspotAnalyticsMetadata(clickedHotspot, activeScene.id, sceneName)
        });
        return;
      }

      setInfoPreview(null);
      setQuestionPreviewHotspotId(null);
      setReflectionPreviewHotspotId(null);
      openHotspotDetails(hotspotId);
    },
    [
      activeScene.hotspots,
      activeScene.id,
      activeScene.name,
      appMode,
      buildHotspotAnalyticsMetadata,
      getProjectedProgressValue,
      openHotspotDetails,
      placementMode.type,
      progressPercent,
      project.scenes,
      trackPreviewAnalyticsEvent
    ]
  );

  useEffect(() => {
    if (appMode !== 'preview' || !activePreviewHotspotId) {
      return;
    }

    if (previewHotspotPulseTimeoutRef.current !== null) {
      window.clearTimeout(previewHotspotPulseTimeoutRef.current);
    }

    previewHotspotPulseTimeoutRef.current = window.setTimeout(() => {
      setActivePreviewHotspotId((current) => (current === activePreviewHotspotId ? null : current));
      previewHotspotPulseTimeoutRef.current = null;
    }, 920);

    return () => {
      if (previewHotspotPulseTimeoutRef.current !== null) {
        window.clearTimeout(previewHotspotPulseTimeoutRef.current);
        previewHotspotPulseTimeoutRef.current = null;
      }
    };
  }, [activePreviewHotspotId, appMode]);

  const handlePanoramaClick = useCallback(
    ({ yaw, pitch }: { yaw: number; pitch: number }) => {
      if (!canEditCurrentProject) {
        return;
      }

      if (placementMode.type === 'idle') {
        return;
      }

      if (placementMode.type === 'placingNewHotspot') {
        handleCreateHotspotAtPosition({ yaw, pitch });
        return;
      }

      if (placementMode.type === 'drawingPolygon') {
        setPlacementMode((currentMode) =>
          currentMode.type === 'drawingPolygon'
            ? {
                type: 'drawingPolygon',
                points: [
                  ...currentMode.points,
                  {
                    yaw: Number(yaw.toFixed(2)),
                    pitch: Number(pitch.toFixed(2))
                  }
                ]
              }
            : currentMode
        );
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
      openHotspotDetails(movingHotspotId);
      setPlacementMode({ type: 'idle' });
      showTemporaryNotice('Insight Zone moved');
    },
    [
      activeScene.hotspots,
      canEditCurrentProject,
      handleCreateHotspotAtPosition,
      handleUpdateHotspot,
      openHotspotDetails,
      placementMode,
      showTemporaryNotice
    ]
  );

  const handleCancelPlacement = () => {
    setPlacementMode({ type: 'idle' });
  };

  const handleAnswerMultipleChoice = useCallback(
    (hotspotId: string, selectedIndex: number) => {
      if (questionResponses[hotspotId]) {
        return;
      }

      const entry = questionEntryById.get(hotspotId);
      if (!entry) {
        return;
      }

      const questionConfig = getMultipleChoiceConfig(entry.hotspot);
      if (!questionConfig) {
        setImportError('This question is missing required quiz fields.');
        return;
      }

      const isCorrect = selectedIndex === questionConfig.correctAnswerIndex;
      const sceneName = sceneNameById[entry.sceneId] ?? 'Untitled Scene';
      const responseText = questionConfig.options[selectedIndex] ?? null;

      setQuestionResponses((current) => {
        if (current[hotspotId]) {
          return current;
        }

        return {
          ...current,
          [hotspotId]: {
            selectedIndex,
            isCorrect,
            sceneId: entry.sceneId
          }
        };
      });

      trackPreviewAnalyticsEvent({
        event_type: 'question_answer',
        scene_id: entry.sceneId,
        scene_name: sceneName,
        hotspot_id: entry.hotspot.id,
        hotspot_title: entry.hotspot.title || 'Untitled Insight Zone',
        hotspot_type: entry.hotspot.type,
        response_text: responseText,
        answer_correct: isCorrect,
        progress_value: Number(progressPercent.toFixed(2)),
        metadata: buildHotspotAnalyticsMetadata(entry.hotspot, entry.sceneId, sceneName, {
          selectedIndex,
          correctAnswerIndex: questionConfig.correctAnswerIndex
        })
      });

      trackPreviewAnalyticsEvent({
        event_type: 'hotspot_complete',
        scene_id: entry.sceneId,
        scene_name: sceneName,
        hotspot_id: entry.hotspot.id,
        hotspot_title: entry.hotspot.title || 'Untitled Insight Zone',
        hotspot_type: entry.hotspot.type,
        answer_correct: isCorrect,
        progress_value: Number(progressPercent.toFixed(2)),
        metadata: buildHotspotAnalyticsMetadata(entry.hotspot, entry.sceneId, sceneName, {
          selectedIndex,
          correctAnswerIndex: questionConfig.correctAnswerIndex
        })
      });
    },
    [buildHotspotAnalyticsMetadata, progressPercent, questionEntryById, questionResponses, sceneNameById, trackPreviewAnalyticsEvent]
  );

  const handleUpdateReflectionResponse = useCallback((hotspotId: string, responseText: string) => {
    setReflectionResponses((current) => ({
      ...current,
      [hotspotId]: responseText
    }));
  }, []);

  const handleSubmitReflection = useCallback(() => {
    if (!activeReflectionHotspot) {
      return;
    }

    const trimmedResponse = activeReflectionResponse.trim();
    if (!trimmedResponse) {
      return;
    }

    const projectedProgressValue = getProjectedProgressValue(activeReflectionHotspot.id);
    const sceneName = activeScene.name || 'Untitled Scene';

    setReflectionResponses((current) => ({
      ...current,
      [activeReflectionHotspot.id]: trimmedResponse
    }));
    setDiscoveredHotspotIds((current) =>
      current.includes(activeReflectionHotspot.id) ? current : [...current, activeReflectionHotspot.id]
    );
    setReflectionPreviewHotspotId(null);
    setPreviewRevealOrigin(null);
    trackPreviewAnalyticsEvent({
      event_type: 'reflection_submit',
      scene_id: activeScene.id,
      scene_name: sceneName,
      hotspot_id: activeReflectionHotspot.id,
      hotspot_title: activeReflectionHotspot.title || 'Reflection',
      hotspot_type: activeReflectionHotspot.type,
      response_text: trimmedResponse,
      progress_value: projectedProgressValue,
      metadata: buildHotspotAnalyticsMetadata(activeReflectionHotspot, activeScene.id, sceneName, {
        responseLength: trimmedResponse.length
      })
    });
    trackPreviewAnalyticsEvent({
      event_type: 'hotspot_complete',
      scene_id: activeScene.id,
      scene_name: sceneName,
      hotspot_id: activeReflectionHotspot.id,
      hotspot_title: activeReflectionHotspot.title || 'Reflection',
      hotspot_type: activeReflectionHotspot.type,
      response_text: trimmedResponse,
      progress_value: projectedProgressValue,
      metadata: buildHotspotAnalyticsMetadata(activeReflectionHotspot, activeScene.id, sceneName, {
        responseLength: trimmedResponse.length
      })
    });
  }, [
    activeReflectionHotspot,
    activeReflectionResponse,
    activeScene.id,
    activeScene.name,
    buildHotspotAnalyticsMetadata,
    getProjectedProgressValue,
    trackPreviewAnalyticsEvent
  ]);

  const handleExportProject = () => {
    setImportError(null);
    setNoticeMessage(null);
    exportProjectToJson(project);
  };

  const applyLoadedProject = useCallback(
    (
      nextProject: Project,
      options?: {
        cloudProjectId?: string | null;
        activeCloudProjectOwnerId?: string | null;
        analyticsProjectId?: string | null;
        analyticsProjectOwnerId?: string | null;
        analyticsProjectSource?: AnalyticsProjectSource;
        activeClassroom?: ProjectClassroom | null;
        notice?: string | null;
        viewingPublishedProjectId?: string | null;
        viewingPublishedProjectOwnerId?: string | null;
        appMode?: AppMode;
        isContextPanelOpen?: boolean;
        showCreationOnboarding?: boolean;
      }
    ) => {
      const nextAnalyticsProjectId =
        options?.analyticsProjectId ??
        options?.cloudProjectId ??
        options?.viewingPublishedProjectId ??
        null;
      const nextAnalyticsProjectOwnerId =
        options?.analyticsProjectOwnerId ??
        options?.activeCloudProjectOwnerId ??
        options?.viewingPublishedProjectOwnerId ??
        null;
      const nextAnalyticsProjectSource =
        options?.analyticsProjectSource ??
        (nextAnalyticsProjectId
          ? options?.activeClassroom
            ? 'classroom'
            : options?.viewingPublishedProjectId && !options?.cloudProjectId
              ? 'explore'
              : 'owned'
          : null);

      setProject(nextProject);
      setCloudProjectId(options?.cloudProjectId ?? null);
      setActiveCloudProjectOwnerId(options?.activeCloudProjectOwnerId ?? null);
      setActiveAnalyticsProjectId(nextAnalyticsProjectId);
      setActiveAnalyticsProjectOwnerId(nextAnalyticsProjectOwnerId);
      setActiveAnalyticsProjectSource(nextAnalyticsProjectSource);
      setActiveClassroom(options?.activeClassroom ?? null);
      setViewingPublishedProjectId(options?.viewingPublishedProjectId ?? null);
      setViewingPublishedProjectOwnerId(options?.viewingPublishedProjectOwnerId ?? null);
      setDiscoveredHotspotIds([]);
      setQuestionResponses({});
      setReflectionResponses({});
      setImagePreview(null);
      setInfoPreview(null);
      setQuestionPreviewHotspotId(null);
      setReflectionPreviewHotspotId(null);
      setImagePreviewBroken(false);
      setShowGuestEditPrompt(false);
      setIsScenePickerOpen(false);
      setSelectedHotspotId(null);
      setPlacementMode({ type: 'idle' });
      setImportError(null);
      setNoticeMessage(options?.notice ?? null);
      setSaveState('unsaved');
      setWalkthroughStepIndex(null);
      setPendingWalkthroughAfterOnboarding(false);
      setAppMode(options?.appMode ?? 'edit');
      setActiveEditSection('project');
      setIsContextPanelOpen(options?.isContextPanelOpen ?? true);
      setShowCreationOnboarding(options?.showCreationOnboarding ?? !projectHasValidActiveScene(nextProject));
      setCloudSaveStatus('idle');
    },
    []
  );

  const resetAppForLoggedOutStart = useCallback(() => {
    const blankProject = createDefaultProject();

    skipNextLocalDraftSaveRef.current = true;

    setProject(blankProject);
    setAuthModalMode(null);
    setCloudProjectId(null);
    setActiveCloudProjectOwnerId(null);
    setActiveAnalyticsProjectId(null);
    setActiveAnalyticsProjectOwnerId(null);
    setActiveAnalyticsProjectSource(null);
    setViewingPublishedProjectId(null);
    setViewingPublishedProjectOwnerId(null);
    setActiveClassroom(null);
    setCloudProjects([]);
    setCloudProjectsStatus('idle');
    setCloudProjectsError(null);
    setCloudSaveStatus('idle');
    setPublishedProjects([]);
    setPublishedProjectsLoading(false);
    setPublishedProjectsError(null);
    setAnalyticsProject(null);
    setAnalyticsEvents([]);
    setAnalyticsLoading(false);
    setAnalyticsError(null);
    setClassroomManagerProject(null);
    setProjectClassrooms([]);
    setProjectClassroomsLoading(false);
    setProjectClassroomsError(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
    setImagePreviewBroken(false);
    setShowGuestEditPrompt(false);
    setDiscoveredHotspotIds([]);
    setQuestionResponses({});
    setReflectionResponses({});
    setImportError(null);
    setNoticeMessage(null);
    setSaveState('saved');
    setSelectedHotspotId(null);
    setPlacementMode({ type: 'idle' });
    setWalkthroughStepIndex(null);
    setPendingWalkthroughAfterOnboarding(false);
    setIsScenePickerOpen(false);
    setActiveExternalExperience(null);
    setShowCreationOnboarding(true);
    setPreviewEntryId(0);
    setCompletionDismissed(false);
    setShowCompletionMessage(false);
    setCompletionPendingAfterOverlayClose(false);
    setActiveEditSection('project');
    setIsContextPanelOpen(false);
    setAreViewerOverlaysHidden(false);
    setCameraStatus('idle');
    setCameraError(null);
    setArPreviewSelectedHotspotId(null);
    setActivePreviewHotspotId(null);
    setPreviewRevealOrigin(null);
    setAppMode('edit');
    setIsProfileModalOpen(false);
    setIsMyProjectsModalOpen(false);
    setIsExploreOpen(false);

    if (analyticsProjectIdRef.current) {
      resetAnalyticsSessionId(analyticsProjectIdRef.current);
    }
    analyticsSessionIdRef.current = null;
    analyticsProjectIdRef.current = null;
    analyticsUserIdRef.current = null;
    analyticsProjectOwnerIdRef.current = null;
    analyticsProjectSourceRef.current = null;
    analyticsClassroomIdRef.current = null;
    analyticsClassroomNameRef.current = null;
    analyticsShareSlugRef.current = null;
    lastTrackedPreviewSceneKeyRef.current = null;
    completedProjectSessionKeyRef.current = null;
  }, []);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;
    const didLogout = Boolean(previousUserId && !currentUserId);
    const didLogin = Boolean(!previousUserId && currentUserId);

    previousUserIdRef.current = currentUserId;

    if (didLogout) {
      resetAppForLoggedOutStart();
      return;
    }

    if (
      didLogin &&
      !activeClassroom &&
      !viewingPublishedProjectId &&
      projectHasValidActiveScene(project) &&
      appMode === 'preview'
    ) {
      setShowGuestEditPrompt(false);
      setAppMode('edit');
      setActiveEditSection('project');
      setIsContextPanelOpen(true);
      setPendingWalkthroughAfterOnboarding(true);
      return;
    }

    if (!currentUserId) {
      setIsProfileModalOpen(false);
      setIsMyProjectsModalOpen(false);
      setActiveExternalExperience(null);
      setCloudProjectId(null);
      setActiveCloudProjectOwnerId(null);
      setCloudProjects([]);
      setCloudProjectsStatus('idle');
      setCloudProjectsError(null);
      setCloudSaveStatus('idle');
      setAnalyticsProject(null);
      setAnalyticsEvents([]);
      setAnalyticsLoading(false);
      setAnalyticsError(null);

      if (!viewingPublishedProjectId && !activeClassroom) {
        setActiveAnalyticsProjectId(null);
        setActiveAnalyticsProjectOwnerId(null);
        setActiveAnalyticsProjectSource(null);
      }
    }
  }, [activeClassroom, appMode, project, resetAppForLoggedOutStart, user?.id, viewingPublishedProjectId]);

  const handleSaveProjectToAccount = useCallback(async () => {
    if (!user?.id) {
      setImportError('Log in to save projects to your account.');
      setAuthModalMode('signIn');
      return;
    }

    setCloudSaveStatus('saving');
    setImportError(null);
    const isSavingCopyFromPublishedExplore = isViewingOtherUsersPublishedProject;
    const canUpdateExistingCloudProject = Boolean(
      cloudProjectId && activeCloudProjectOwnerId && activeCloudProjectOwnerId === user.id
    );

    try {
      const savedProject = await saveProjectToCloud({
        userId: user.id,
        project,
        existingProjectId: canUpdateExistingCloudProject ? cloudProjectId : undefined
      });

      upsertCloudProjectInState(savedProject);

      if (isSavingCopyFromPublishedExplore) {
        applyLoadedProject(savedProject.project_data, {
          cloudProjectId: savedProject.id,
          activeCloudProjectOwnerId: savedProject.user_id,
          analyticsProjectId: savedProject.id,
          analyticsProjectOwnerId: savedProject.user_id,
          analyticsProjectSource: 'owned',
          notice: null,
          appMode: 'edit',
          isContextPanelOpen: true,
          showCreationOnboarding: !projectHasValidActiveScene(savedProject.project_data)
        });
        showTemporaryNotice('Saved a copy to your account');
      } else {
        setCloudProjectId(savedProject.id);
        setActiveCloudProjectOwnerId(savedProject.user_id);
        setActiveAnalyticsProjectId(savedProject.id);
        setActiveAnalyticsProjectOwnerId(savedProject.user_id);
        setActiveAnalyticsProjectSource('owned');
        setViewingPublishedProjectId(null);
        setViewingPublishedProjectOwnerId(null);
        showTemporaryNotice(canUpdateExistingCloudProject ? 'Project saved to your account' : 'Project saved to your account');
      }

      setCloudSaveStatus('saved');
    } catch (error) {
      setCloudSaveStatus('error');
      setImportError(getFriendlyCloudProjectErrorMessage(error));
    }
  }, [
    activeCloudProjectOwnerId,
    applyLoadedProject,
    cloudProjectId,
    isViewingOtherUsersPublishedProject,
    project,
    showTemporaryNotice,
    upsertCloudProjectInState,
    user?.id,
    user
  ]);

  const handleOpenCloudProject = useCallback(
    async (projectId: string) => {
      if (!user?.id) {
        return;
      }

      setCloudProjectsError(null);
      setCloudProjectsStatus('loading');

      try {
        const cloudProject = await loadCloudProject({
          userId: user.id,
          projectId
        });
        upsertCloudProjectInState(cloudProject);
        applyLoadedProject(cloudProject.project_data, {
          cloudProjectId: cloudProject.id,
          activeCloudProjectOwnerId: cloudProject.user_id,
          analyticsProjectId: cloudProject.id,
          analyticsProjectOwnerId: cloudProject.user_id,
          analyticsProjectSource: 'owned',
          notice: `Loaded "${cloudProject.title || 'Untitled Project'}" from your account.`
        });
        setCloudProjectsStatus('ready');
        setIsMyProjectsModalOpen(false);
        setIsExploreOpen(false);
      } catch (error) {
        setCloudProjectsStatus('error');
        setCloudProjectsError(getFriendlyCloudProjectErrorMessage(error));
      }
    },
    [applyLoadedProject, upsertCloudProjectInState, user?.id]
  );

  const handleOpenPublishedProject = useCallback(
    (publishedProject: CloudProjectWithProfile) => {
      const isOwner = Boolean(user?.id && user.id === publishedProject.user_id);

      handleCloseAnalyticsDashboard();

      if (isOwner) {
        applyLoadedProject(publishedProject.project_data, {
          cloudProjectId: publishedProject.id,
          activeCloudProjectOwnerId: publishedProject.user_id,
          analyticsProjectId: publishedProject.id,
          analyticsProjectOwnerId: publishedProject.user_id,
          analyticsProjectSource: 'owned',
          notice: `Loaded your published experience "${publishedProject.title || 'Untitled Project'}".`,
          viewingPublishedProjectId: null,
          viewingPublishedProjectOwnerId: null,
          appMode: 'edit',
          isContextPanelOpen: true,
          showCreationOnboarding: !projectHasValidActiveScene(publishedProject.project_data)
        });
      } else {
        applyLoadedProject(publishedProject.project_data, {
          cloudProjectId: null,
          activeCloudProjectOwnerId: null,
          analyticsProjectId: publishedProject.id,
          analyticsProjectOwnerId: publishedProject.user_id,
          analyticsProjectSource: 'explore',
          notice:
            user?.id
              ? `Viewing "${publishedProject.title || 'Untitled Project'}" from Explore. Save a copy to edit your own version.`
              : `Viewing "${publishedProject.title || 'Untitled Project'}" from Explore. Sign in to save a copy and edit.`,
          viewingPublishedProjectId: publishedProject.id,
          viewingPublishedProjectOwnerId: publishedProject.user_id,
          appMode: 'preview',
          isContextPanelOpen: false,
          showCreationOnboarding: false
        });
      }

      setIsExploreOpen(false);
      setIsMyProjectsModalOpen(false);
    },
    [applyLoadedProject, handleCloseAnalyticsDashboard, user?.id]
  );

  useEffect(() => {
    const classroomSlug = initialClassroomSlugRef.current;
    if (!classroomSlug || hasResolvedInitialClassroomRouteRef.current) {
      return;
    }

    hasResolvedInitialClassroomRouteRef.current = true;
    let cancelled = false;

    const loadInitialClassroomRoute = async () => {
      try {
        console.info('[classrooms] loading classroom route', { shareSlug: classroomSlug });
        const classroomResult = await loadClassroomProjectBySlug(classroomSlug);

        if (cancelled) {
          return;
        }

        if (!classroomResult) {
          applyLoadedProject(createDefaultProject(), {
            cloudProjectId: null,
            activeCloudProjectOwnerId: null,
            analyticsProjectId: null,
            analyticsProjectOwnerId: null,
            analyticsProjectSource: null,
            activeClassroom: null,
            notice: null,
            appMode: 'preview',
            isContextPanelOpen: false,
            showCreationOnboarding: false
          });
          setImportError('This classroom link is unavailable.');
          return;
        }

        console.info('[classrooms] classroom project loaded', {
          classroomId: classroomResult.classroom.id,
          projectId: classroomResult.project.id,
          projectStatus: classroomResult.project.status ?? 'draft'
        });

        applyLoadedProject(classroomResult.project.project_data, {
          cloudProjectId: null,
          activeCloudProjectOwnerId: null,
          analyticsProjectId: classroomResult.project.id,
          analyticsProjectOwnerId: classroomResult.classroom.owner_user_id,
          analyticsProjectSource: 'classroom',
          activeClassroom: classroomResult.classroom,
          notice: `Viewing classroom "${classroomResult.classroom.name}".`,
          viewingPublishedProjectId: null,
          viewingPublishedProjectOwnerId: null,
          appMode: 'preview',
          isContextPanelOpen: false,
          showCreationOnboarding: false
        });
        setIsExploreOpen(false);
        setIsMyProjectsModalOpen(false);
        setClassroomManagerProject(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('[classrooms] classroom route failed', {
          shareSlug: classroomSlug,
          message: getErrorMessageLike(error) || 'Unknown classroom route failure.',
          code: getErrorCodeLike(error) || null,
          details: getErrorDetailsLike(error) || null,
          hint: getErrorHintLike(error) || null
        });

        applyLoadedProject(createDefaultProject(), {
          cloudProjectId: null,
          activeCloudProjectOwnerId: null,
          analyticsProjectId: null,
          analyticsProjectOwnerId: null,
          analyticsProjectSource: null,
          activeClassroom: null,
          notice: null,
          appMode: 'preview',
          isContextPanelOpen: false,
          showCreationOnboarding: false
        });
        setImportError(getFriendlyClassroomErrorMessage(error));
      }
    };

    void loadInitialClassroomRoute();

    return () => {
      cancelled = true;
    };
  }, [applyLoadedProject]);

  const handleDeleteCloudProject = useCallback(
    async (projectId: string) => {
      if (!user?.id) {
        return;
      }

      const targetProject = cloudProjects.find((entry) => entry.id === projectId);
      const projectLabel = targetProject?.title || 'this cloud project';
      const shouldDelete = window.confirm(
        `Delete "${projectLabel}" from your account?\n\nThis will not remove your current local draft.`
      );

      if (!shouldDelete) {
        return;
      }

      setCloudProjectsError(null);

      try {
        await deleteCloudProject({
          userId: user.id,
          projectId
        });
        setCloudProjects((currentProjects) => currentProjects.filter((entry) => entry.id !== projectId));

        if (analyticsProject?.id === projectId) {
          handleCloseAnalyticsDashboard();
        }

        if (classroomManagerProject?.id === projectId) {
          handleCloseClassroomManager();
        }

        if (cloudProjectId === projectId) {
          setCloudProjectId(null);
          setActiveCloudProjectOwnerId(null);
          setActiveAnalyticsProjectId(null);
          setActiveAnalyticsProjectOwnerId(null);
          setActiveAnalyticsProjectSource(null);
          setCloudSaveStatus('idle');
        }

        if (isExploreOpen) {
          void refreshPublishedProjects();
        }

        showTemporaryNotice('Cloud project deleted');
      } catch (error) {
        setCloudProjectsError(getFriendlyCloudProjectErrorMessage(error));
      }
    },
    [
      analyticsProject?.id,
      classroomManagerProject?.id,
      cloudProjectId,
      cloudProjects,
      handleCloseClassroomManager,
      handleCloseAnalyticsDashboard,
      isExploreOpen,
      refreshPublishedProjects,
      showTemporaryNotice,
      user?.id
    ]
  );

  const handleToggleCloudProjectStatus = useCallback(
    async (projectId: string, status: 'draft' | 'published') => {
      if (!user?.id) {
        return;
      }

      setCloudProjectsError(null);

      try {
        const updatedProject = await updateCloudProjectStatus({
          userId: user.id,
          projectId,
          status
        });

        upsertCloudProjectInState(updatedProject);

        setAnalyticsProject((currentProject) =>
          currentProject?.id === updatedProject.id ? updatedProject : currentProject
        );

        showTemporaryNotice(
          status === 'published' ? 'Experience marked as published' : 'Experience moved back to draft'
        );
        if (isExploreOpen) {
          void refreshPublishedProjects();
        }
      } catch (error) {
        setCloudProjectsError(getFriendlyCloudProjectErrorMessage(error));
      }
    },
    [isExploreOpen, refreshPublishedProjects, showTemporaryNotice, upsertCloudProjectInState, user?.id]
  );

  const handleCreateProjectFromUpload = useCallback(
    async (file: File) => {
      if (!user?.id) {
        throw new Error('Sign in to create a saved project.');
      }

      const imageResult = await imageFileToDataUrl(file);
      if (!imageResult.ok) {
        throw new Error(imageResult.error || 'Could not create the project from that image.');
      }

      const nextProject = buildFreshProjectFromPanorama({
        panoramaUrl: imageResult.dataUrl,
        projectName: deriveSceneNameFromFile(file, 'Untitled XR Project')
      });

      try {
        const savedProject = await saveProjectToCloud({
          userId: user.id,
          project: nextProject,
          status: 'draft'
        });

        upsertCloudProjectInState(savedProject);
        setIsMyProjectsModalOpen(false);
        applyLoadedProject(savedProject.project_data, {
          cloudProjectId: savedProject.id,
          activeCloudProjectOwnerId: savedProject.user_id,
          analyticsProjectId: savedProject.id,
          analyticsProjectOwnerId: savedProject.user_id,
          analyticsProjectSource: 'owned',
          notice: null
        });
        setCloudProjectId(savedProject.id);
        setActiveCloudProjectOwnerId(savedProject.user_id);
        showTemporaryNotice('New draft project created from upload');
      } catch (error) {
        console.error('[cloud-projects] could not create project from upload', error);
        throw new Error('Could not create the project from that image.');
      }
    },
    [applyLoadedProject, showTemporaryNotice, upsertCloudProjectInState, user?.id]
  );

  const handleCreateProjectFromPrompt = useCallback(
    async (prompt: string) => {
      const trimmedPrompt = prompt.trim();

      if (!user?.id) {
        throw new Error('Sign in to create a saved project.');
      }

      if (!trimmedPrompt) {
        throw new Error('Please enter a scene description first.');
      }

      try {
        const result = await requestGenerated360Scene(trimmedPrompt);
        const nextProject = buildFreshProjectFromPanorama({
          panoramaUrl: result.imageDataUrl,
          projectName: deriveProjectNameFromPrompt(trimmedPrompt),
          generationPrompt: trimmedPrompt
        });
        const savedProject = await saveProjectToCloud({
          userId: user.id,
          project: nextProject,
          status: 'draft'
        });

        upsertCloudProjectInState(savedProject);
        setIsMyProjectsModalOpen(false);
        applyLoadedProject(savedProject.project_data, {
          cloudProjectId: savedProject.id,
          activeCloudProjectOwnerId: savedProject.user_id,
          analyticsProjectId: savedProject.id,
          analyticsProjectOwnerId: savedProject.user_id,
          analyticsProjectSource: 'owned',
          notice: null
        });
        setCloudProjectId(savedProject.id);
        setActiveCloudProjectOwnerId(savedProject.user_id);
        showTemporaryNotice('New AI-generated draft project created');
      } catch (error) {
        console.error('[cloud-projects] could not create project from generation', error);
        throw new Error('Could not generate a new project right now. Try again shortly.');
      }
    },
    [applyLoadedProject, showTemporaryNotice, upsertCloudProjectInState, user?.id]
  );

  const handleImportFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const importedProject = await importProjectFromFile(file);
      applyLoadedProject(importedProject, { cloudProjectId: null, notice: null });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed due to an unknown error.');
    }
  };

  const handleResetLocalDraft = () => {
    const shouldReset = window.confirm(
      'Clear the local draft and reset to a blank project?\n\nThis will remove autosaved local changes.'
    );
    if (!shouldReset) {
      return;
    }

    clearLocalDraft();
    applyLoadedProject(createDefaultProject(), {
      cloudProjectId: null,
      activeCloudProjectOwnerId: null,
      notice: null
    });
    setEditWalkthroughDismissed(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(EDIT_WALKTHROUGH_DISMISSED_KEY);
    }
  };

  const handleToggleAppMode = () => {
    if (!canEditCurrentProject) {
      setAppMode('preview');
      return;
    }

    const nextMode: AppMode = appMode === 'edit' ? 'preview' : 'edit';
    setAppMode(nextMode);
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
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
    setReflectionPreviewHotspotId(null);
    setIsScenePickerOpen(false);
    setPlacementMode({ type: 'idle' });
    setSelectedHotspotId(null);
  };

  const handleEnterCameraPreview = useCallback(() => {
    if (!canEditCurrentProject) {
      return;
    }

    setAppMode('arPreview');
    setImportError(null);
    setNoticeMessage(null);
    setImagePreview(null);
    setInfoPreview(null);
    setQuestionPreviewHotspotId(null);
    setReflectionPreviewHotspotId(null);
    setIsScenePickerOpen(false);
    setPlacementMode({ type: 'idle' });
    setSelectedHotspotId(null);
    setCameraError(null);
    setArPreviewSelectedHotspotId(null);
    setCameraPreviewRequestId((current) => current + 1);
  }, [canEditCurrentProject]);

  const handleExitCameraPreview = useCallback(() => {
    setAppMode('edit');
    setCameraError(null);
    setArPreviewSelectedHotspotId(null);
  }, []);

  const handleUploadSceneMedia = async (file: File) => {
    if (!user) {
      setImportError('Sign in to upload a scene.');
      setAuthModalMode('signIn');
      return;
    }

    const result = await imageFileToDataUrl(file);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportError(null);
    setNoticeMessage(result.warning ?? null);
    handleUpdateActiveSceneMedia(result.dataUrl);
  };

  const handleGenerateSceneFromPrompt = async (
    prompt: string,
    options?: Generate360SceneRequestOptions
  ) => {
    const targetSceneId = project.activeSceneId;
    console.info('[generate-360-scene] applying generated scene to active scene', {
      targetSceneId,
      mode: options?.mode ?? 'default'
    });
    const trimmedPrompt = prompt.trim();
    const result = await requestGenerated360Scene(trimmedPrompt, options);

    setImportError(null);
    setImagePreviewBroken(false);
    setProject((currentProject) => {
      const targetScene = currentProject.scenes.find((scene) => scene.id === targetSceneId);
      if (!targetScene) {
        console.warn('[generate-360-scene] target scene no longer exists', {
          targetSceneId
        });
        return currentProject;
      }

      console.info('[generate-360-scene] active scene panorama updated', {
        targetSceneId,
        panoramaUrlPrefix: result.imageDataUrl.slice(0, 30)
      });

      return {
        ...currentProject,
        activeSceneId: targetSceneId,
        scenes: currentProject.scenes.map((scene) =>
          scene.id === targetSceneId
            ? {
                ...scene,
                mediaType: 'image',
                panoramaUrl: result.imageDataUrl,
                aiGenerated: true,
                generationPrompt: trimmedPrompt,
                generationAttemptCount:
                  options?.mode === 'improve'
                    ? Math.max(1, targetScene.generationAttemptCount ?? 1) + 1
                    : 1
              }
            : scene
        )
      };
    });
    setActiveEditSection('sceneDetails');
    setIsContextPanelOpen(true);
    showTemporaryNotice(options?.mode === 'improve' ? 'Panorama regenerated' : '360 scene generated');

    return {
      revisedPrompt: result.revisedPrompt
    };
  };

  const handleImproveActiveScenePanorama = async () => {
    const storedPrompt = activeScene.generationPrompt?.trim();
    if (!storedPrompt) {
      throw new Error('This scene does not have a saved generation prompt yet.');
    }

    await handleGenerateSceneFromPrompt(storedPrompt, {
      mode: 'improve',
      previousIssue: 'visible seam or weak panorama continuity'
    });
  };

  const handleCreateSceneFromImageFile = async (file: File) => {
    if (!user) {
      setImportError('Sign in to create a scene from an image.');
      setAuthModalMode('signIn');
      return;
    }

    const result = await imageFileToDataUrl(file);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportError(null);
    setNoticeMessage(result.warning ?? `Created a new scene from "${deriveSceneNameFromFile(file, 'Captured Scene')}".`);
    handleCreateSceneFromMedia(
      result.dataUrl,
      deriveSceneNameFromFile(file, `Scene ${project.scenes.length + 1}`)
    );
  };

  const completeCreationOnboarding = useCallback(() => {
    setShowCreationOnboarding(false);
    setIsScenePickerOpen(false);
    if (user) {
      setPendingWalkthroughAfterOnboarding(true);
      setShowGuestEditPrompt(false);
      setAppMode('edit');
      return;
    }

    setPendingWalkthroughAfterOnboarding(false);
    setShowGuestEditPrompt(true);
    setAppMode('preview');
    setPreviewEntryId((current) => current + 1);
    setIsContextPanelOpen(false);
    setSelectedHotspotId(null);
    setPlacementMode({ type: 'idle' });
  }, [user]);

  const handleOnboardingGenerateScene = async (prompt: string) => {
    await handleGenerateSceneFromPrompt(prompt);
    completeCreationOnboarding();
  };

  const handleOnboardingUploadScene = async (file: File) => {
    const result = await imageFileToDataUrl(file);
    if (!result.ok) {
      throw new Error(result.error || 'Could not load that 360 image right now.');
    }

    const sceneName = deriveSceneNameFromFile(file, 'Uploaded 360 Scene');

    setImportError(null);
    setImagePreviewBroken(false);
    setProject((currentProject) => ({
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === currentProject.activeSceneId
          ? {
              ...scene,
              name: sceneName,
              mediaType: 'image',
              panoramaUrl: result.dataUrl,
              aiGenerated: undefined,
              generationPrompt: undefined,
              generationAttemptCount: undefined
            }
          : scene
      )
    }));
    setActiveEditSection('sceneDetails');
    setIsContextPanelOpen(true);
    setSelectedHotspotId(null);
    setPlacementMode({ type: 'idle' });
    setNoticeMessage(result.warning ?? `Loaded "${sceneName}" as your starting scene.`);
    completeCreationOnboarding();
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
    setIsScenePickerOpen(false);
    setWalkthroughStepIndex(0);
  };

  const handleDismissEditWalkthrough = () => {
    setWalkthroughStepIndex(null);
    setEditWalkthroughDismissed(true);
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

  const handleDismissPreviewHint = () => {
    setPreviewHintDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREVIEW_HINT_DISMISSED_KEY, '1');
    }
  };

  const handleCloseContextPanel = useCallback(() => {
    setIsContextPanelOpen(false);
    setSelectedHotspotId(null);
    if (placementMode.type === 'movingExistingHotspot') {
      setPlacementMode({ type: 'idle' });
    }
  }, [placementMode.type]);

  const handleToggleViewerOverlays = useCallback(() => {
    setAreViewerOverlaysHidden((current) => !current);
  }, []);

  const handleSelectHotspot = (hotspotId: string) => {
    openHotspotDetails(hotspotId);
  };

  const handleOpenScenePicker = () => {
    setIsScenePickerOpen(true);
    setImportError(null);
    setNoticeMessage(null);
  };

  const handleCloseScenePicker = () => {
    setIsScenePickerOpen(false);
  };

  const handleApplySceneLibraryItem = (panoramaUrl: string, label: string) => {
    handleUpdateActiveSceneMedia(panoramaUrl);
    setIsScenePickerOpen(false);
    setImportError(null);
    setNoticeMessage(`Applied "${label}" to ${activeScene.name || 'the active scene'}.`);
    if (showCreationOnboarding) {
      completeCreationOnboarding();
    }
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
      : appMode === 'edit' && placementMode.type === 'drawingPolygon'
        ? 'Click points around the area. Use Finish Polygon when you have at least 3 points.'
      : appMode === 'edit' && placementMode.type === 'movingExistingHotspot'
        ? 'Click in the panorama to move the selected insight zone.'
        : null;

  const viewerInteractionMode = appMode === 'preview' || !canEditCurrentProject ? 'idle' : placementMode.type;
  const canShowModeToggle = canEditCurrentProject;
  const modeToggleLabel = appMode === 'edit' ? 'Present project' : 'Return to edit mode';
  const modeToggleAction =
    appMode === 'edit'
      ? handleEnterPresentationMode
      : appMode === 'arPreview'
        ? handleExitCameraPreview
        : handleToggleAppMode;
  const presentationRevealStyle = previewRevealOrigin
    ? ({
        '--reveal-origin-x': `${previewRevealOrigin.x}px`,
        '--reveal-origin-y': `${previewRevealOrigin.y}px`
      } as CSSProperties)
    : undefined;
  const activeReflectionPrompt =
    activeReflectionHotspot?.reflectionPrompt?.trim() || DEFAULT_REFLECTION_PROMPT;
  const activeReflectionPlaceholder =
    activeReflectionHotspot?.reflectionPlaceholder?.trim() || DEFAULT_REFLECTION_PLACEHOLDER;
  const isReflectionSubmitDisabled = activeReflectionResponse.trim().length === 0;
  useEffect(() => {
    if (appMode !== 'arPreview') {
      if (arStreamRef.current) {
        arStreamRef.current.getTracks().forEach((track) => track.stop());
        arStreamRef.current = null;
      }
      setCameraStatus('idle');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Camera preview is unavailable in this browser. You can return to Edit Mode and keep authoring normally.');
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setCameraStatus('requesting');
      setCameraError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }
          },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        arStreamRef.current = stream;
        if (arVideoRef.current) {
          arVideoRef.current.srcObject = stream;
          void arVideoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCameraStatus('error');
        setCameraError(
          error instanceof Error
            ? error.message
            : 'Camera access was unavailable. You can still return to the editor and keep building the scene.'
        );
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (arStreamRef.current) {
        arStreamRef.current.getTracks().forEach((track) => track.stop());
        arStreamRef.current = null;
      }
    };
  }, [appMode, cameraPreviewRequestId]);

  return (
    <>
      <Layout
        title="XR Editor"
        subtitle="Local XR experience editor"
        mode={appMode === 'edit' ? 'edit' : 'preview'}
        overlaysHidden={appMode !== 'arPreview' && areViewerOverlaysHidden}
        hideHeader={isCreationOnboardingActive}
        logoSrc="/branding/udeesa-logo.png"
        headerControls={
          <div className="header-controls-cluster">
            {showSaveCopyAction ? (
              <button
                type="button"
                className="ui-button ui-button-primary app-auth-button"
                onClick={handleSaveProjectToAccount}
                disabled={cloudSaveStatus === 'saving'}
              >
                {cloudSaveStatus === 'saving' ? 'Saving Copy...' : 'Save a Copy'}
              </button>
            ) : null}
            <AuthControls
              variant="header"
              onOpenExplore={handleOpenExplore}
              onOpenSignIn={handleOpenSignIn}
              onOpenSignUp={handleOpenSignUp}
              onOpenProfile={handleOpenProfile}
            />
            <div className="header-mode-group">
              <span className="mode-indicator-pill">
                {appMode === 'edit' ? 'Edit Mode' : appMode === 'arPreview' ? 'AR Preview' : 'Present Mode'}
              </span>
              {canShowModeToggle ? (
                <button
                  type="button"
                  className={`topbar-icon-button mode-toggle-icon-button ${
                    appMode === 'edit' ? 'topbar-icon-button-primary' : ''
                  }`}
                  aria-label={modeToggleLabel}
                  title={modeToggleLabel}
                  onClick={modeToggleAction}
                >
                  {appMode === 'edit' ? <PresentIcon aria-hidden="true" /> : <EditIcon aria-hidden="true" />}
                </button>
              ) : null}
            </div>
          </div>
        }
        sidebar={
          canEditCurrentProject && appMode === 'edit' && !isCreationOnboardingActive ? (
            <nav className="edit-nav-rail" aria-label="Editor sections">
              {[
                ['project', 'Project'],
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
          canEditCurrentProject && appMode === 'edit' && !isCreationOnboardingActive && isContextPanelOpen ? (
            <div className="context-panel-stack">
            <div className="context-panel-toolbar">
              <div className="context-panel-toolbar-actions">
                <button
                  type="button"
                  className="ui-button done-button context-panel-done"
                  onClick={handleCloseContextPanel}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="context-panel-close"
                  onClick={handleCloseContextPanel}
                  aria-label="Close selected details"
                  title="Close selected details"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>
            {selectedHotspot ? (
              <>
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
                  />
                </section>
              </>
            ) : null}
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
              placementModeType={placementMode.type}
              saveStateLabel={saveStateLabel}
              saveStateTone={saveState}
              isUserSignedIn={Boolean(user)}
              isCloudProjectLinked={Boolean(cloudProjectId)}
              isViewingPublicProject={isViewingPublicProject}
              isViewingOwnedPublishedProject={isViewingOwnedPublishedProject}
              cloudSaveStatus={cloudSaveStatus}
              walkthroughSectionId={activeWalkthroughStep?.id ?? null}
              onAddScene={handleAddScene}
              onPresentProject={handleEnterPresentationMode}
              onEnterCameraPreview={handleEnterCameraPreview}
              onStartWalkthrough={handleStartEditWalkthrough}
              onOpenScenePicker={handleOpenScenePicker}
              onUpdateProjectMetadata={handleUpdateProjectMetadata}
              onSelectScene={handleSelectScene}
              onRenameActiveScene={handleRenameActiveScene}
              onUploadScenePanorama={handleUploadSceneMedia}
              onGenerateSceneFromPrompt={handleGenerateSceneFromPrompt}
              onImproveScenePanorama={handleImproveActiveScenePanorama}
              onCreateSceneFromImageFile={handleCreateSceneFromImageFile}
              onDeleteScene={handleDeleteScene}
              onSaveProjectToCloud={handleSaveProjectToAccount}
              onOpenMyProjects={handleOpenMyProjects}
              onAddHotspot={handleStartPlacingHotspot}
              onStartDrawingPolygonHotspot={handleStartDrawingPolygonHotspot}
              onFinishPolygonHotspot={handleFinishPolygonHotspot}
              onUndoPolygonPoint={handleUndoPolygonPoint}
              onCancelPlacement={handleCancelPlacement}
              onExportProject={handleExportProject}
              onResetLocalDraft={handleResetLocalDraft}
              onSelectHotspot={handleSelectHotspot}
              onDeleteHotspot={handleDeleteHotspot}
              polygonPointCount={placementMode.type === 'drawingPolygon' ? placementMode.points.length : 0}
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
              <PanoramaViewer
                panoramaUrl={activeScene.panoramaUrl}
                hotspots={activeScene.hotspots}
                selectedHotspotId={selectedHotspotId}
                isPreviewMode={false}
                previewEntryId={0}
                overlayContent={null}
                editorPopoverContent={
                  canEditCurrentProject && selectedHotspot ? (
                    <div className="hotspot-popover-note">
                      <p className="hotspot-popover-kicker">Selected Zone</p>
                      <strong>{selectedHotspot.title || 'Untitled Insight Zone'}</strong>
                      <span>Continue editing in the details panel.</span>
                    </div>
                  ) : null
                }
                interactionMode={viewerInteractionMode}
                drawingPolygonPoints={placementMode.type === 'drawingPolygon' ? placementMode.points : []}
                onActivateHotspot={handleActivateHotspot}
                onPanoramaClick={handlePanoramaClick}
                onQuickPlaceHotspot={canEditCurrentProject ? handleCreateHotspotAtPosition : undefined}
                onToggleOverlays={handleToggleViewerOverlays}
                onViewChange={setCurrentView}
              />
              {canEditCurrentProject && !isCreationOnboardingActive ? (
                <button
                  type="button"
                  className="floating-ar-utility"
                  onClick={handleEnterCameraPreview}
                  aria-label="Open camera AR preview"
                >
                  AR
                </button>
              ) : null}
              {!isCreationOnboardingActive && importError ? <p className="panel error-banner edit-toast">{importError}</p> : null}
              {!isCreationOnboardingActive && noticeMessage ? <p className="panel info-banner edit-toast">{noticeMessage}</p> : null}
              {!isCreationOnboardingActive && activeWalkthroughStep ? (
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
	                          <img
	                            src={item.panoramaUrl}
	                            alt={item.label}
	                            className="scene-library-preview"
	                          />
	                          <span className="scene-library-title">{item.label}</span>
	                        </button>
	                      ))}
	                    </div>
	                    {featuredExternalExperiences.length > 0 ? (
	                      <section className="featured-experience-section scene-library-featured-section">
	                        <div className="explore-section-header scene-library-section-header">
	                          <div>
	                            <p className="auth-modal-kicker">Featured External Experiences</p>
	                            <h3>View External Immersive Experiences</h3>
	                            <p className="scene-picker-copy">
	                              These curated experiences open in a separate viewer and are not editable inside the
	                              Udēēsa editor.
	                            </p>
	                          </div>
	                        </div>
	                        <div className="profile-experience-grid featured-experience-grid scene-library-featured-grid" role="list">
	                          {featuredExternalExperiences.map((experience) => (
	                            <article
	                              key={experience.id}
	                              className="profile-experience-card external-experience-card"
	                              role="listitem"
	                            >
	                              <button
	                                type="button"
	                                className="profile-experience-card-button"
	                                onClick={() => handleOpenFeaturedExperienceFromCatalog(experience)}
	                              >
	                                <div className="profile-experience-media">
	                                  {experience.thumbnailUrl ? (
	                                    <img src={experience.thumbnailUrl} alt={experience.title} />
	                                  ) : (
	                                    <div className="external-experience-fallback" aria-hidden="true">
	                                      <span>Featured</span>
	                                      <strong>{experience.targetAudience || 'Featured Experience'}</strong>
	                                    </div>
	                                  )}
	                                  <div className="profile-experience-media-overlay" />
	                                  <div className="profile-experience-topline">
	                                    <span className="profile-experience-status profile-experience-status-published">
	                                      Featured
	                                    </span>
	                                    <span className="profile-experience-status profile-experience-status-draft">
	                                      {experience.targetAudience || 'Featured Experience'}
	                                    </span>
	                                  </div>
	                                  <div className="profile-experience-card-copy">
	                                    <strong>{experience.title}</strong>
	                                    <span>{experience.organization || 'Curated external experience'}</span>
	                                  </div>
	                                </div>
	                              </button>
	                              <div className="explore-project-creator-copy external-experience-copy">
	                                <strong>{experience.location || 'View-only experience'}</strong>
	                                <span>
	                                  {experience.description || 'Opens an external immersive experience for viewing.'}
	                                </span>
	                              </div>
	                              <button
	                                type="button"
	                                className="ui-button ui-button-secondary mini-button"
	                                onClick={() => handleOpenFeaturedExperienceFromCatalog(experience)}
	                              >
	                                Open Experience
	                              </button>
	                            </article>
	                          ))}
	                        </div>
	                      </section>
	                    ) : null}
	                  </div>
	                </div>
	              ) : null}
              {isCreationOnboardingActive ? (
                <CreationOnboarding
                  isAuthenticated={isAuthenticated}
                  onGenerate={handleOnboardingGenerateScene}
                  onOpenCatalog={handleOpenScenePicker}
                  onUploadImage={handleOnboardingUploadScene}
                  onOpenExplore={handleOpenExplore}
                  onOpenSignIn={handleOpenSignIn}
                  onOpenSignUp={handleOpenSignUp}
                  onOpenProfile={handleOpenProfile}
                />
              ) : null}
            </section>
          ) : null}
          {appMode === 'preview' && importError ? <p className="presentation-toast">{importError}</p> : null}
          {appMode === 'arPreview' ? (
            <section className="camera-preview-shell" aria-label="Camera AR preview">
              <div className="camera-preview-stage">
                <video ref={arVideoRef} className="camera-preview-video" autoPlay muted playsInline />
                <div className="camera-preview-backdrop" aria-hidden="true" />
                <div className="camera-preview-meta">
                  <div className="camera-preview-card">
                    <p className="presentation-kicker">Screen-Space AR Preview</p>
                    <h2 className="presentation-title">{activeScene.name || project.name || 'AR Preview'}</h2>
                    <p className="presentation-description">
                      Preview lightweight floating insight zones over the live camera feed. This mode is visual-only and does not use persistent AR anchoring.
                    </p>
                  </div>
                </div>
                <div className="camera-preview-overlay">
                  {cameraStatus === 'ready'
                    ? arPreviewHotspots.map((hotspot, index) => (
                        <button
                          key={`ar-preview-${hotspot.id}`}
                          type="button"
                          className={`ar-preview-marker ar-preview-marker-${hotspot.type}`}
                          style={getScreenSpaceMarkerPosition(hotspot, index)}
                          onClick={() => setArPreviewSelectedHotspotId(hotspot.id)}
                        >
                          <span className="ar-preview-marker-dot" aria-hidden="true" />
                          <span className="ar-preview-marker-label">{hotspot.title || 'Insight Zone'}</span>
                        </button>
                      ))
                    : null}
                </div>
                <div className="camera-preview-status">
                  {cameraStatus === 'requesting' ? (
                    <div className="camera-preview-card camera-preview-status-card">
                      <p className="presentation-kicker">Preparing Camera</p>
                      <p className="presentation-description">Requesting camera access for the live preview.</p>
                    </div>
                  ) : null}
                  {cameraStatus === 'error' ? (
                    <div className="camera-preview-card camera-preview-status-card">
                      <p className="presentation-kicker">Camera Unavailable</p>
                      <p className="presentation-description">
                        {cameraError ||
                          'Camera permission was denied or unavailable. Return to Edit Mode to keep building the experience.'}
                      </p>
                      <div className="editor-actions">
                        <button
                          type="button"
                          className="ui-button ui-button-secondary mini-button"
                          onClick={handleEnterCameraPreview}
                        >
                          Try Again
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button-primary mini-button"
                          onClick={handleExitCameraPreview}
                        >
                          Return to Edit
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {cameraStatus === 'ready' && arPreviewSelectedHotspot ? (
                    <div className="camera-preview-card camera-preview-status-card">
                      <p className="presentation-kicker">Selected Overlay</p>
                      <h3 className="camera-preview-selection-title">
                        {arPreviewSelectedHotspot.title || 'Insight Zone'}
                      </h3>
                      <p className="presentation-description">
                        {arPreviewSelectedHotspot.type === 'sceneLink'
                          ? 'Scene link preview marker'
                          : arPreviewSelectedHotspot.type === 'externalLink'
                            ? 'External resource preview marker'
                            : arPreviewSelectedHotspot.type === 'image'
                              ? 'Image preview marker'
                              : arPreviewSelectedHotspot.type === 'multipleChoice'
                                ? 'Question preview marker'
                                : arPreviewSelectedHotspot.type === 'reflection'
                                  ? 'Reflection prompt marker'
                                : 'Information preview marker'}
                      </p>
                    </div>
                  ) : null}
                  {cameraStatus === 'ready' && arPreviewHotspots.length === 0 ? (
                    <div className="camera-preview-card camera-preview-status-card">
                      <p className="presentation-kicker">No Insight Zones Yet</p>
                      <p className="presentation-description">
                        Add insight zones in Edit Mode, then come back here to preview floating screen-space markers.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          {appMode === 'preview' ? (
            <PanoramaViewer
              panoramaUrl={activeScene.panoramaUrl}
              hotspots={activeScene.hotspots}
              selectedHotspotId={selectedHotspotId}
              activePreviewHotspotId={activePreviewHotspotId}
              visitedPreviewHotspotIds={discoveredHotspotIds}
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
                          {project.projectObjective?.trim() ||
                            project.description?.trim() ||
                            'Use this scene to guide discussion, observation, and reflection.'}
                        </p>
                      </div>
                      {isGuestPreviewingUnownedScene && showGuestEditPrompt ? (
                        <div className="preview-hint-card public-view-helper-card">
                          <p>Sign in to edit and save this experience.</p>
                          <div className="public-view-helper-actions">
                            <button
                              type="button"
                              className="ui-button ui-button-primary mini-button"
                              onClick={handleOpenSignIn}
                            >
                              Login
                            </button>
                            <button
                              type="button"
                              className="ui-button ui-button-secondary mini-button"
                              onClick={handleOpenSignUp}
                            >
                              Sign Up
                            </button>
                            <button
                              type="button"
                              className="ui-button ui-button-secondary mini-button"
                              onClick={() => setShowGuestEditPrompt(false)}
                            >
                              Continue Viewing
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {publicProjectHelperMessage ? (
                        <div className="preview-hint-card public-view-helper-card">
                          <p>{publicProjectHelperMessage}</p>
                          <div className="public-view-helper-actions">
                            {showSaveCopyAction ? (
                              <button
                                type="button"
                                className="ui-button ui-button-primary mini-button"
                                onClick={handleSaveProjectToAccount}
                                disabled={cloudSaveStatus === 'saving'}
                              >
                                {cloudSaveStatus === 'saving' ? 'Saving Copy...' : 'Save a Copy'}
                              </button>
                            ) : null}
                            {!isAuthenticated ? (
                              <button
                                type="button"
                                className="ui-button ui-button-secondary mini-button"
                                onClick={handleOpenSignIn}
                              >
                                Sign In to Edit
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
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
              drawingPolygonPoints={[]}
              onActivateHotspot={handleActivateHotspot}
              onPanoramaClick={handlePanoramaClick}
              onQuickPlaceHotspot={undefined}
              onToggleOverlays={handleToggleViewerOverlays}
              onViewChange={setCurrentView}
            />
          ) : null}
          {infoPreview ? (
            <div
              className="presentation-overlay presentation-overlay-reveal"
              style={presentationRevealStyle}
              role="dialog"
              aria-modal="true"
              aria-label="Info hotspot details"
              onClick={handleCloseInfoPreview}
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
                    onClick={handleCloseInfoPreview}
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
              className="presentation-overlay presentation-overlay-reveal"
              style={presentationRevealStyle}
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={handleCloseImagePreview}
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
                    onClick={handleCloseImagePreview}
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
              className="presentation-overlay presentation-overlay-reveal"
              style={presentationRevealStyle}
              role="dialog"
              aria-modal="true"
              aria-label="Multiple choice question"
              onClick={handleCloseQuestionPreview}
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
                    onClick={handleCloseQuestionPreview}
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
          {activeReflectionHotspot ? (
            <div
              className="presentation-overlay presentation-overlay-reveal"
              style={presentationRevealStyle}
              role="dialog"
              aria-modal="true"
              aria-label="Reflection prompt"
              onClick={handleCloseReflectionPreview}
            >
              <div
                className="presentation-modal reflection-preview-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="presentation-modal-header">
                  <div className="presentation-modal-heading">
                    <p className="presentation-modal-kicker">Reflection</p>
                    <h3>{activeReflectionHotspot.title || DEFAULT_REFLECTION_TITLE}</h3>
                  </div>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={handleCloseReflectionPreview}
                  >
                    Close
                  </button>
                </div>
                <p className="reflection-question-prompt">{activeReflectionPrompt}</p>
                <label className="field-group reflection-response-group">
                  <span>Response</span>
                  <textarea
                    className="reflection-response-textarea"
                    rows={6}
                    placeholder={activeReflectionPlaceholder}
                    value={activeReflectionResponse}
                    onChange={(event) =>
                      handleUpdateReflectionResponse(activeReflectionHotspot.id, event.target.value)
                    }
                  />
                </label>
                <p className="reflection-helper-note">
                  Submit to count this reflection toward Activity Progress. Responses stay local to this preview
                  session.
                </p>
                <div className="editor-actions">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={handleCloseReflectionPreview}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-primary mini-button"
                    onClick={handleSubmitReflection}
                    disabled={isReflectionSubmitDisabled}
                  >
                    Submit Reflection
                  </button>
                </div>
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
      <AuthModal
        mode={authModalMode ?? 'signIn'}
        isOpen={authModalMode !== null}
        onClose={handleCloseAuthModal}
        onSwitchMode={setAuthModalMode}
      />
      <ProfileModal isOpen={isProfileModalOpen} onClose={handleCloseProfileModal} />
      <ExploreProjectsPanel
        isOpen={isExploreOpen}
        projects={publishedProjects}
        featuredExperiences={featuredExternalExperiences}
        loading={publishedProjectsLoading}
        error={publishedProjectsError}
        onClose={handleCloseExplore}
        onRefresh={() => {
          void refreshPublishedProjects();
        }}
        onOpenProject={handleOpenPublishedProject}
        onOpenExternalExperience={handleOpenFeaturedExperienceFromExplore}
      />
      {activeExternalExperience ? (
        <ExternalExperienceViewer
          experience={activeExternalExperience}
          onClose={handleCloseExternalExperience}
        />
      ) : null}
      <UserProfilePanel
        isOpen={isMyProjectsModalOpen}
        projects={cloudProjects}
        loading={cloudProjectsStatus === 'loading'}
        error={cloudProjectsError}
        currentProjectId={cloudProjectId}
        onClose={handleCloseMyProjectsModal}
        onRefresh={() => {
          void refreshCloudProjects();
        }}
        onEditProfile={handleOpenProfileEditor}
        onOpenProject={(projectId) => {
          void handleOpenCloudProject(projectId);
        }}
        onViewAnalytics={(cloudProject) => {
          void handleViewProjectAnalytics(cloudProject);
        }}
        onManageClassrooms={(cloudProject) => {
          void handleManageProjectClassrooms(cloudProject);
        }}
        onDeleteProject={(projectId) => {
          void handleDeleteCloudProject(projectId);
        }}
        onToggleProjectStatus={(projectId, status) => {
          void handleToggleCloudProjectStatus(projectId, status);
        }}
        onCreateProjectFromUpload={handleCreateProjectFromUpload}
        onCreateProjectFromPrompt={handleCreateProjectFromPrompt}
      />
      <ClassroomManagerPanel
        project={classroomManagerProject}
        classrooms={projectClassrooms}
        loading={projectClassroomsLoading}
        error={projectClassroomsError}
        onClose={handleCloseClassroomManager}
        onCreateClassroom={handleCreateManagedClassroom}
        onRefresh={handleRefreshManagedClassrooms}
        onToggleActive={handleToggleManagedClassroom}
        onDeleteClassroom={handleDeleteManagedClassroom}
      />
      {analyticsProject ? (
        <ProjectAnalyticsDashboard
          project={analyticsProject}
          events={analyticsEvents}
          loading={analyticsLoading}
          error={analyticsError}
          onClose={handleCloseAnalyticsDashboard}
          onRefresh={() => {
            void handleRefreshProjectAnalytics();
          }}
          onOpenProject={(projectId) => {
            handleCloseAnalyticsDashboard();
            void handleOpenCloudProject(projectId);
          }}
        />
      ) : null}
    </>
  );
}

export default App;
