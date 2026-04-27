import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Hotspot, Project, Scene } from '../types/project';

type ProjectStats = {
  totalScenes: number;
  totalHotspots: number;
  totalLinkedHotspots: number;
  activeSceneName: string;
};
type GeneratedSceneStatus = 'idle' | 'loading' | 'success' | 'error';
type GeneratedSceneResult = {
  revisedPrompt?: string;
};

export type EditSection = 'controls' | 'inspector' | 'scenes' | 'sceneDetails' | 'hotspots';

type ControlActionIconName = 'present' | 'export' | 'tour' | 'scene' | 'uploadPanorama' | 'captureScene';
type SectionHeadingIconName = 'controls' | 'project' | 'scenes' | 'sceneDetails' | 'hotspots';

type SidebarProps = {
  activeSection: EditSection;
  project: Project;
  projectStats: ProjectStats;
  scenes: Scene[];
  activeSceneId: string;
  activeScene: Scene;
  hotspots: Hotspot[];
  sceneNameById: Record<string, string>;
  selectedHotspotId: string | null;
  modeMessage: string | null;
  isPlacementModeActive: boolean;
  saveStateLabel: string;
  saveStateTone: 'saved' | 'unsaved' | 'restored';
  walkthroughSectionId: EditSection | null;
  onAddScene: () => void;
  onPresentProject: () => void;
  onEnterCameraPreview: () => void;
  onStartWalkthrough: () => void;
  onOpenScenePicker: () => void;
  onUpdateProjectMetadata: (
    patch: Partial<
      Pick<
        Project,
        'name' | 'description' | 'authorOrOrganization' | 'projectObjective' | 'targetAgeOrGradeBand' | 'subjectOrDomain'
      >
    >
  ) => void;
  onSelectScene: (sceneId: string) => void;
  onRenameActiveScene: (name: string) => void;
  onUploadScenePanorama: (file: File) => void | Promise<void>;
  onGenerateSceneFromPrompt: (prompt: string) => Promise<GeneratedSceneResult>;
  onCreateSceneFromImageFile: (file: File) => void | Promise<void>;
  onDeleteScene: (sceneId: string) => void;
  onAddHotspot: () => void;
  onCancelPlacement: () => void;
  onExportProject: () => void;
  onResetLocalDraft: () => void;
  onSelectHotspot: (hotspotId: string) => void;
  onDeleteHotspot: (hotspotId: string) => void;
};

function DeleteTrashIcon({ className = 'delete-action-icon-svg' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 6.5h8" />
      <path d="M10 4.5h4" />
      <path d="M6.5 6.5h11l-.9 11a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z" />
      <path d="M10 10v5.5" />
      <path d="M14 10v5.5" />
    </svg>
  );
}

function ControlActionIcon({ name }: { name: ControlActionIconName }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'control-action-icon-svg'
  };

  if (name === 'present') {
    return (
      <svg {...commonProps}>
        <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16.5H5A1.5 1.5 0 0 1 3.5 15v-8A1.5 1.5 0 0 1 5 5.5z" />
        <path d="M10 10l4 2.5-4 2.5z" />
        <path d="M8.5 19.5h7" />
      </svg>
    );
  }

  if (name === 'export') {
    return (
      <svg {...commonProps}>
        <path d="M12 4.5v10" />
        <path d="M8.5 11 12 14.5 15.5 11" />
        <path d="M5.5 16.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
      </svg>
    );
  }

  if (name === 'tour') {
    return (
      <svg {...commonProps}>
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="M8.5 8.5c1.5 1 2.3 1.6 3.5 3.5s2.5 2.6 3.5 3.5" />
        <path d="M10.5 6.5h4" />
        <path d="M9.5 17.5h-4" />
      </svg>
    );
  }

  if (name === 'uploadPanorama') {
    return (
      <svg {...commonProps}>
        <rect x="4.5" y="6" width="15" height="12" rx="2" />
        <path d="M7.5 14l3-3 2.2 2.2 2.8-3.2 1.5 1.8" />
        <circle cx="9" cy="9.5" r="1" />
        <path d="M12 4.5v4" />
        <path d="M10.5 6h3" />
      </svg>
    );
  }

  if (name === 'captureScene') {
    return (
      <svg {...commonProps}>
        <path d="M7 8.5h2l1.2-1.8h3.6L15 8.5h2A1.5 1.5 0 0 1 18.5 10v6A1.5 1.5 0 0 1 17 17.5H7A1.5 1.5 0 0 1 5.5 16v-6A1.5 1.5 0 0 1 7 8.5z" />
        <circle cx="12" cy="13" r="2.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect x="4.5" y="5.5" width="15" height="12" rx="2" />
      <path d="M7.5 14l3-3 2.2 2.2 2.8-3.2 1.5 1.8" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  );
}

function ProjectActionIcon() {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'control-action-icon-svg'
  };

  return (
    <svg {...commonProps}>
      <path d="M19 6.5v4" />
      <path d="M19 10.5l-2-2" />
      <path d="M19 10.5l2-2" />
      <path d="M17.5 17.5a6 6 0 1 1-1.8-10.7" />
    </svg>
  );
}

function SectionHeadingIcon({ name }: { name: SectionHeadingIconName }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'section-heading-icon-svg'
  };

  if (name === 'controls') {
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

  if (name === 'project') {
    return (
      <svg {...commonProps}>
        <path d="M4.5 7.5a2 2 0 0 1 2-2h4.7l2 2H17.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (name === 'scenes') {
    return (
      <svg {...commonProps}>
        <rect x="4.5" y="5" width="12" height="10" rx="2" />
        <path d="M7.5 12l2.5-2.5 2 2 2.5-3 2 2.5" />
        <circle cx="9" cy="8.5" r="1" />
        <path d="M17 9h2.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10" />
      </svg>
    );
  }

  if (name === 'sceneDetails') {
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

function Sidebar({
  activeSection,
  project,
  projectStats,
  scenes,
  activeSceneId,
  activeScene,
  hotspots,
  sceneNameById,
  selectedHotspotId,
  modeMessage,
  isPlacementModeActive,
  saveStateLabel,
  saveStateTone,
  walkthroughSectionId,
  onAddScene,
  onPresentProject,
  onEnterCameraPreview,
  onStartWalkthrough,
  onOpenScenePicker,
  onUpdateProjectMetadata,
  onSelectScene,
  onRenameActiveScene,
  onUploadScenePanorama,
  onGenerateSceneFromPrompt,
  onCreateSceneFromImageFile,
  onDeleteScene,
  onAddHotspot,
  onCancelPlacement,
  onExportProject,
  onResetLocalDraft,
  onSelectHotspot,
  onDeleteHotspot
}: SidebarProps) {
  const sceneUploadInputRef = useRef<HTMLInputElement | null>(null);
  const sceneCaptureCreateInputRef = useRef<HTMLInputElement | null>(null);
  const [generateScenePrompt, setGenerateScenePrompt] = useState('');
  const [generateSceneStatus, setGenerateSceneStatus] = useState<GeneratedSceneStatus>('idle');
  const [generateSceneMessage, setGenerateSceneMessage] = useState<string | null>(null);
  const isGeneratingScene = generateSceneStatus === 'loading';
  const canGenerateScene = generateScenePrompt.trim().length > 0 && !isGeneratingScene;

  const onProjectNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateProjectMetadata({ name: event.target.value });
  };

  const onProjectObjectiveChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateProjectMetadata({ projectObjective: event.target.value });
  };

  const onProjectSubjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateProjectMetadata({ subjectOrDomain: event.target.value });
  };

  const onProjectAgeBandChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateProjectMetadata({ targetAgeOrGradeBand: event.target.value });
  };

  const onProjectAuthorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateProjectMetadata({ authorOrOrganization: event.target.value });
  };

  const onSceneNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onRenameActiveScene(event.target.value);
  };

  const onGenerateScenePromptChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGenerateScenePrompt(event.target.value);

    if (generateSceneStatus !== 'loading') {
      setGenerateSceneStatus('idle');
      setGenerateSceneMessage(null);
    }
  };

  const onGenerateSceneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPrompt = generateScenePrompt.trim();
    if (!trimmedPrompt || isGeneratingScene) {
      return;
    }

    setGenerateScenePrompt(trimmedPrompt);
    setGenerateSceneStatus('loading');
    setGenerateSceneMessage('Generating a panoramic learning scene...');

    try {
      const result = await onGenerateSceneFromPrompt(trimmedPrompt);
      setGenerateSceneStatus('success');
      setGenerateSceneMessage(
        result.revisedPrompt?.trim()
          ? '360 scene generated with a refined prompt.'
          : '360 scene generated.'
      );
    } catch (error) {
      setGenerateSceneStatus('error');
      setGenerateSceneMessage(
        error instanceof Error
          ? error.message
          : 'Scene generation could not finish. Try again.'
      );
    }
  };

  const openPanoramaUpload = () => {
    sceneUploadInputRef.current?.click();
  };

  const openCameraCreate = () => {
    sceneCaptureCreateInputRef.current?.click();
  };

  const onSceneUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void onUploadScenePanorama(file);
  };

  const onCreateSceneUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void onCreateSceneFromImageFile(file);
  };

  const sectionCardClass = (sectionId: EditSection) =>
    `sidebar-card context-card ${walkthroughSectionId === sectionId ? 'walkthrough-focus' : ''}`;

  const renderHeadingTitle = (iconName: SectionHeadingIconName, title: string) => (
    <div className="section-heading-title">
      <span className="section-heading-icon" aria-hidden="true">
        <SectionHeadingIcon name={iconName} />
      </span>
      <h2>{title}</h2>
    </div>
  );

  const renderControls = () => (
    <section className={sectionCardClass('controls')} data-walkthrough-id="controls">
      <div className="context-panel-heading">
        {renderHeadingTitle('controls', 'Project Controls')}
        <p>Guide the class, swap scenes, and prepare the experience for presentation.</p>
      </div>
      <p className={`save-state-indicator save-state-${saveStateTone}`}>{saveStateLabel}</p>
      <div className="stacked-actions">
        <button type="button" className="ui-button ui-button-secondary control-button" onClick={onStartWalkthrough}>
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="tour" />
          </span>
          <span className="control-action-label">Start Guided Tour</span>
        </button>
        <button type="button" className="ui-button ui-button-secondary control-button" onClick={onOpenScenePicker}>
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="scene" />
          </span>
          <span className="control-action-label">Select a Scene</span>
        </button>
        <button type="button" className="ui-button ui-button-secondary control-button" onClick={onExportProject}>
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="export" />
          </span>
          <span className="control-action-label">Export Project</span>
        </button>
        <button type="button" className="ui-button ui-button-primary control-button" onClick={onPresentProject}>
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="present" />
          </span>
          <span className="control-action-label">Present Project</span>
        </button>
        <button
          type="button"
          className="ui-button ui-button-secondary control-button mobile-ar-preview-button"
          onClick={onEnterCameraPreview}
        >
          Camera AR Preview
        </button>
      </div>
    </section>
  );

  const renderInspector = () => (
    <section className={sectionCardClass('inspector')} data-walkthrough-id="inspector">
      <div className="context-panel-heading">
        {renderHeadingTitle('project', 'Project Overview')}
        <p>Set the framing, learning context, and project-level actions for this experience.</p>
      </div>
      <label className="editor-field compact-field">
        <span>Project Name</span>
        <input value={project.name} onChange={onProjectNameChange} placeholder="My XR Project" />
      </label>
      <label className="editor-field compact-field">
        <span>Project Objective</span>
        <textarea
          value={project.projectObjective ?? project.description ?? ''}
          onChange={onProjectObjectiveChange}
          rows={3}
          placeholder="What should learners notice, discuss, or understand?"
        />
      </label>
      <label className="editor-field compact-field">
        <span>Subject / Domain</span>
        <input
          value={project.subjectOrDomain ?? ''}
          onChange={onProjectSubjectChange}
          placeholder="Science, history, career exploration..."
        />
      </label>
      <label className="editor-field compact-field">
        <span>Target Age / Grade Band</span>
        <input
          value={project.targetAgeOrGradeBand ?? ''}
          onChange={onProjectAgeBandChange}
          placeholder="Grade 6-8, adult learners..."
        />
      </label>
      <label className="editor-field compact-field">
        <span>Facilitator / Organization</span>
        <input
          value={project.authorOrOrganization ?? ''}
          onChange={onProjectAuthorChange}
          placeholder="Teacher, team, or organization"
        />
      </label>
      <div className="project-stats-grid">
        <p className="project-stat">
          <strong>{projectStats.totalScenes}</strong> scenes
        </p>
        <p className="project-stat">
          <strong>{projectStats.totalHotspots}</strong> zones
        </p>
        <p className="project-stat">
          <strong>{projectStats.totalLinkedHotspots}</strong> linked
        </p>
        <p className="project-stat">
          Active: <strong>{projectStats.activeSceneName}</strong>
        </p>
      </div>
      <div className="sidebar-subsection">
        <p className="sidebar-subsection-title">Project Actions</p>
        <div className="stacked-actions compact-actions">
          <button type="button" className="ui-button ui-button-secondary control-button" onClick={onResetLocalDraft}>
            <span className="control-action-icon" aria-hidden="true">
              <ProjectActionIcon />
            </span>
            <span className="control-action-label">Reset Local Draft</span>
          </button>
        </div>
      </div>
    </section>
  );

  const renderScenes = () => (
    <section className={sectionCardClass('scenes')} data-walkthrough-id="scenes">
      <div className="context-panel-heading">
        <p className="sidebar-section-title">Scenes</p>
        {renderHeadingTitle('scenes', 'Scene Navigation')}
        <p>Move between locations and manage the sequence of local learning spaces.</p>
      </div>
      <div className="section-header-row">
        <div />
        <button
          type="button"
          className="ui-button ui-button-primary mini-button add-text-button"
          onClick={onAddScene}
        >
          <span className="add-text-button-plus" aria-hidden="true">+</span>
          <span>Add Scene</span>
        </button>
      </div>
      <ul className="scene-list">
        {scenes.map((scene) => {
          const isSelected = scene.id === activeSceneId;
          const canDelete = scenes.length > 1;
          const hasPreview = scene.panoramaUrl.trim() !== '';

          return (
            <li key={scene.id} className={`scene-row ${isSelected ? 'scene-row-selected' : ''}`}>
              <button type="button" className="scene-select" onClick={() => onSelectScene(scene.id)}>
                <span className="scene-thumb-wrap">
                  {hasPreview ? (
                    <span className="scene-thumb-media-wrap">
                      <img
                        src={scene.panoramaUrl}
                        alt={scene.name || 'Scene preview'}
                        className="scene-thumb"
                      />
                      <span className="scene-thumb-media-badge">360 Image</span>
                    </span>
                  ) : (
                    <span className="scene-thumb scene-thumb-fallback" aria-hidden="true">
                      <span className="scene-thumb-glyph">360</span>
                    </span>
                  )}
                </span>
                <span className="scene-copy">
                  <span className="scene-name-wrap">
                    <span className="scene-name">{scene.name || 'Untitled Scene'}</span>
                    {isSelected ? <span className="active-badge">Active</span> : null}
                  </span>
                  <span className="hotspot-meta">360 image · {scene.hotspots.length} zone(s)</span>
                </span>
              </button>
              <button
                type="button"
                className="scene-delete"
                onClick={() => onDeleteScene(scene.id)}
                disabled={!canDelete}
                aria-label={`Delete ${scene.name || 'scene'}`}
                title={`Delete ${scene.name || 'scene'}`}
              >
                <DeleteTrashIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const renderSceneDetails = () => (
    <section className={sectionCardClass('sceneDetails')} data-walkthrough-id="sceneDetails">
      <div className="context-panel-heading">
        <p className="sidebar-section-title">Scene Details</p>
        {renderHeadingTitle('sceneDetails', 'Active Scene Details')}
        <p>Update the current panorama and prepare the scene for localized learning.</p>
      </div>
      <input
        ref={sceneUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden-file-input"
        onChange={onSceneUploadChange}
      />
      <input
        ref={sceneCaptureCreateInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden-file-input"
        onChange={onCreateSceneUploadChange}
      />
      <label className="editor-field compact-field">
        <span>Scene Name</span>
        <input value={activeScene.name} onChange={onSceneNameChange} placeholder="Scene name" />
      </label>
      <div className="scene-media-status-card" role="status" aria-live="polite">
        <div className="scene-media-status-header">
          <span className="scene-media-badge scene-media-badge-image">360 Image</span>
          <strong>Current Scene Media</strong>
        </div>
        <p className="scene-media-status-copy">
          This scene is currently using a 360 image panorama.
        </p>
        <p className="helper-note">Upload Panorama accepts standard equirectangular 360 images.</p>
      </div>
      <div className="generate-scene-card">
        <div className="generate-scene-heading">
          <strong>Generate 360 Scene</strong>
          <p className="helper-note">AI-generated scene will replace the current active scene image.</p>
        </div>
        <form className="generate-scene-form" onSubmit={onGenerateSceneSubmit}>
          <input
            className="generate-scene-input"
            type="text"
            value={generateScenePrompt}
            onChange={onGenerateScenePromptChange}
            placeholder="Describe a 360 learning environment..."
            disabled={isGeneratingScene}
            aria-label="Describe a 360 learning environment"
          />
          <button
            type="submit"
            className="ui-button ui-button-primary mini-button generate-scene-button"
            disabled={!canGenerateScene}
          >
            {isGeneratingScene ? 'Generating...' : 'Generate'}
          </button>
        </form>
        {generateSceneStatus !== 'idle' && generateSceneMessage ? (
          <p
            className={`generate-scene-status generate-scene-status-${generateSceneStatus}`}
            role="status"
            aria-live="polite"
          >
            {generateSceneMessage}
          </p>
        ) : null}
      </div>
      <div className="scene-source-actions">
        <button
          type="button"
          className="ui-button ui-button-secondary mini-button upload-button scene-media-button"
          onClick={onOpenScenePicker}
        >
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="scene" />
          </span>
          <span className="control-action-label">Select a Scene</span>
        </button>
        <button
          type="button"
          className="ui-button ui-button-secondary mini-button upload-button scene-media-button"
          onClick={openPanoramaUpload}
        >
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="uploadPanorama" />
          </span>
          <span className="control-action-label">Upload Panorama</span>
        </button>
        <button
          type="button"
          className="ui-button ui-button-secondary mini-button upload-button scene-media-button"
          onClick={openCameraCreate}
        >
          <span className="control-action-icon" aria-hidden="true">
            <ControlActionIcon name="captureScene" />
          </span>
          <span className="control-action-label">Capture New Scene</span>
        </button>
      </div>
      <p className="helper-note">
        Upload replaces the active scene panorama with a 360 image. Capture New Scene opens the device camera when supported and falls back to image selection elsewhere, creating a new local scene in the current workflow.
      </p>
    </section>
  );

  const renderHotspots = () => (
    <section className={sectionCardClass('hotspots')} data-walkthrough-id="hotspots">
      <div className="context-panel-heading">
        <p className="sidebar-section-title">Insight Zones</p>
        {renderHeadingTitle('hotspots', 'Insight Zones')}
        <p>Review prompts, questions, and links for the active scene.</p>
      </div>
      <div className="section-header-row">
        <div />
        <button
          type="button"
          className="ui-button ui-button-primary mini-button add-text-button"
          onClick={onAddHotspot}
        >
          <span className="add-text-button-plus" aria-hidden="true">+</span>
          <span>Add Insight Zone</span>
        </button>
      </div>

      {hotspots.length === 0 ? (
        <p className="placeholder-note">No insight zones yet. Add one to begin.</p>
      ) : (
        <ul className="hotspot-list">
          {hotspots.map((hotspot) => {
            const isSelected = hotspot.id === selectedHotspotId;
            const destinationSceneName = hotspot.targetSceneId
              ? sceneNameById[hotspot.targetSceneId] || 'Missing Scene'
              : null;
            const hotspotTypeLabel =
              hotspot.type === 'sceneLink'
                ? destinationSceneName
                  ? `Scene Link → ${destinationSceneName}`
                  : 'Scene Link'
                : hotspot.type === 'externalLink'
                  ? 'External Link'
                  : hotspot.type === 'image'
                    ? 'Image'
                    : hotspot.type === 'multipleChoice'
                      ? 'Multiple Choice'
                      : 'Info';
            const hotspotTypeChipClass =
              hotspot.type === 'sceneLink'
                ? 'hotspot-link-chip-scenelink'
                : hotspot.type === 'externalLink'
                  ? 'hotspot-link-chip-externallink'
                  : hotspot.type === 'image'
                    ? 'hotspot-link-chip-image'
                    : hotspot.type === 'multipleChoice'
                      ? 'hotspot-link-chip-multiplechoice'
                      : 'hotspot-link-chip-info';

            return (
              <li key={hotspot.id} className={`hotspot-row ${isSelected ? 'hotspot-row-selected' : ''}`}>
                <button type="button" className="hotspot-select" onClick={() => onSelectHotspot(hotspot.id)}>
                  <span className="hotspot-name">{hotspot.title}</span>
                  <span className={`hotspot-link-chip ${hotspotTypeChipClass}`}>{hotspotTypeLabel}</span>
                </button>
                <button
                  type="button"
                  className="hotspot-delete"
                  onClick={() => onDeleteHotspot(hotspot.id)}
                  aria-label={`Delete ${hotspot.title}`}
                  title={`Delete ${hotspot.title}`}
                >
                  <DeleteTrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {isPlacementModeActive && modeMessage ? (
        <div className="mode-banner-inline">
          <p className="mode-banner-text">{modeMessage}</p>
          <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onCancelPlacement}>
            Cancel Placement
          </button>
        </div>
      ) : null}
    </section>
  );

  if (activeSection === 'controls') {
    return renderControls();
  }

  if (activeSection === 'inspector') {
    return renderInspector();
  }

  if (activeSection === 'scenes') {
    return renderScenes();
  }

  if (activeSection === 'sceneDetails') {
    return renderSceneDetails();
  }

  return renderHotspots();
}

export default Sidebar;
