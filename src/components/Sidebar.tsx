import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Hotspot, Project, Scene } from '../types/project';
import type { ProjectTemplateId, ProjectTemplateOption } from '../utils/templates';

type ProjectStats = {
  totalScenes: number;
  totalHotspots: number;
  totalLinkedHotspots: number;
  activeSceneName: string;
};

export type EditSection = 'controls' | 'inspector' | 'scenes' | 'sceneDetails' | 'hotspots';

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
  templateOptions: ProjectTemplateOption[];
  walkthroughSectionId: EditSection | null;
  onAddScene: () => void;
  onPresentProject: () => void;
  onCreateProjectFromTemplate: (templateId: ProjectTemplateId) => void;
  onStartWalkthrough: () => void;
  onOpenScenePicker: () => void;
  onUpdateProjectMetadata: (
    patch: Partial<Pick<Project, 'name' | 'description' | 'authorOrOrganization'>>
  ) => void;
  onSelectScene: (sceneId: string) => void;
  onRenameActiveScene: (name: string) => void;
  onUpdateActiveScenePanorama: (panoramaUrl: string) => void;
  onUploadScenePanorama: (file: File) => void | Promise<void>;
  onDeleteScene: (sceneId: string) => void;
  onAddHotspot: () => void;
  onCancelPlacement: () => void;
  onExportProject: () => void;
  onExportPresentationPackage: () => void;
  onImportProject: () => void;
  onResetLocalDraft: () => void;
  onSelectHotspot: (hotspotId: string) => void;
  onDeleteHotspot: (hotspotId: string) => void;
};

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
  templateOptions,
  walkthroughSectionId,
  onAddScene,
  onPresentProject,
  onCreateProjectFromTemplate,
  onStartWalkthrough,
  onOpenScenePicker,
  onUpdateProjectMetadata,
  onSelectScene,
  onRenameActiveScene,
  onUpdateActiveScenePanorama,
  onUploadScenePanorama,
  onDeleteScene,
  onAddHotspot,
  onCancelPlacement,
  onExportProject,
  onExportPresentationPackage,
  onImportProject,
  onResetLocalDraft,
  onSelectHotspot,
  onDeleteHotspot
}: SidebarProps) {
  const sceneUploadInputRef = useRef<HTMLInputElement | null>(null);

  const onProjectNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateProjectMetadata({ name: event.target.value });
  };

  const onProjectDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateProjectMetadata({ description: event.target.value });
  };

  const onProjectAuthorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateProjectMetadata({ authorOrOrganization: event.target.value });
  };

  const onSceneNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onRenameActiveScene(event.target.value);
  };

  const onScenePanoramaChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateActiveScenePanorama(event.target.value);
  };

  const openPanoramaUpload = () => {
    sceneUploadInputRef.current?.click();
  };

  const onSceneUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void onUploadScenePanorama(file);
  };

  const sectionCardClass = (sectionId: EditSection) =>
    `sidebar-card context-card ${walkthroughSectionId === sectionId ? 'walkthrough-focus' : ''}`;

  const renderControls = () => (
    <section className={sectionCardClass('controls')} data-walkthrough-id="controls">
      <p className="sidebar-section-title">Controls</p>
      <div className="context-panel-heading">
        <h2>Project Controls</h2>
        <p>Guide the class, swap scenes, and prepare the experience for presentation.</p>
      </div>
      <p className={`save-state-indicator save-state-${saveStateTone}`}>{saveStateLabel}</p>
      <div className="stacked-actions">
        <button type="button" className="ui-button ui-button-primary control-button" onClick={onPresentProject}>
          Present Project
        </button>
        <button type="button" className="ui-button ui-button-secondary control-button" onClick={onExportProject}>
          Export Project
        </button>
        <button type="button" className="ui-button ui-button-secondary control-button" onClick={onStartWalkthrough}>
          Start Guided Tour
        </button>
        <button type="button" className="ui-button ui-button-secondary control-button" onClick={onOpenScenePicker}>
          Select a Scene
        </button>
      </div>
    </section>
  );

  const renderInspector = () => (
    <section className={sectionCardClass('inspector')} data-walkthrough-id="inspector">
      <p className="sidebar-section-title">Project</p>
      <div className="context-panel-heading">
        <h2>Project Overview</h2>
        <p>Set the framing, learning context, and project-level actions for this experience.</p>
      </div>
      <label className="editor-field compact-field">
        <span>Project Name</span>
        <input value={project.name} onChange={onProjectNameChange} placeholder="My XR Project" />
      </label>
      <label className="editor-field compact-field">
        <span>Learning Goal</span>
        <textarea
          value={project.description ?? ''}
          onChange={onProjectDescriptionChange}
          rows={3}
          placeholder="What should learners notice, discuss, or understand?"
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
          <button
            type="button"
            className="ui-button ui-button-secondary control-button"
            onClick={onExportPresentationPackage}
          >
            Export Presentation Package
          </button>
          <button type="button" className="ui-button ui-button-secondary control-button" onClick={onImportProject}>
            Import Project
          </button>
          <button type="button" className="ui-button ui-button-secondary control-button" onClick={onResetLocalDraft}>
            Reset Local Draft
          </button>
        </div>
      </div>
      <div className="sidebar-subsection">
        <p className="sidebar-subsection-title">New Project from Template</p>
        <div className="template-list template-list-inline">
          {templateOptions.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-button"
              onClick={() => onCreateProjectFromTemplate(template.id)}
            >
              <span className="template-name">{template.name}</span>
              <span className="template-description">{template.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  const renderScenes = () => (
    <section className={sectionCardClass('scenes')} data-walkthrough-id="scenes">
      <div className="context-panel-heading">
        <p className="sidebar-section-title">Scenes</p>
        <h2>Scene Navigation</h2>
        <p>Move between locations and manage the sequence of local learning spaces.</p>
      </div>
      <div className="section-header-row">
        <div />
        <button type="button" className="ui-button ui-button-primary mini-button" onClick={onAddScene}>
          Add Scene
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
                    <img
                      src={scene.panoramaUrl}
                      alt={scene.name || 'Scene preview'}
                      className="scene-thumb"
                    />
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
                  <span className="hotspot-meta">{scene.hotspots.length} zone(s)</span>
                </span>
              </button>
              <button
                type="button"
                className="scene-delete"
                onClick={() => onDeleteScene(scene.id)}
                disabled={!canDelete}
                aria-label={`Delete ${scene.name || 'scene'}`}
              >
                Delete
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
        <h2>Active Scene Details</h2>
        <p>Update the current panorama and prepare the scene for localized learning.</p>
      </div>
      <input
        ref={sceneUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden-file-input"
        onChange={onSceneUploadChange}
      />
      <label className="editor-field compact-field">
        <span>Scene Name</span>
        <input value={activeScene.name} onChange={onSceneNameChange} placeholder="Scene name" />
      </label>
      <label className="editor-field compact-field">
        <span>Panorama URL / Path</span>
        <input
          value={activeScene.panoramaUrl}
          onChange={onScenePanoramaChange}
          placeholder="/scene-library/starry-night-moon.jpg"
        />
      </label>
      <button
        type="button"
        className="ui-button ui-button-secondary mini-button upload-button"
        onClick={openPanoramaUpload}
      >
        Upload Panorama
      </button>
      <p className="helper-note">Uploads are embedded in your local project JSON for this MVP.</p>
    </section>
  );

  const renderHotspots = () => (
    <section className={sectionCardClass('hotspots')} data-walkthrough-id="hotspots">
      <div className="context-panel-heading">
        <p className="sidebar-section-title">Insight Zones</p>
        <h2>Insight Zones</h2>
        <p>Review prompts, questions, and links for the active scene.</p>
      </div>
      <div className="section-header-row">
        <div />
        <button type="button" className="ui-button ui-button-primary mini-button" onClick={onAddHotspot}>
          Add Insight Zone
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
                  <span className="hotspot-meta">
                    yaw {hotspot.yaw.toFixed(1)} | pitch {hotspot.pitch.toFixed(1)}
                  </span>
                  <span className={`hotspot-link-chip ${hotspotTypeChipClass}`}>{hotspotTypeLabel}</span>
                </button>
                <button
                  type="button"
                  className="hotspot-delete"
                  onClick={() => onDeleteHotspot(hotspot.id)}
                  aria-label={`Delete ${hotspot.title}`}
                >
                  Delete
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
