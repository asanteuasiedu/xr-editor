import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Hotspot, Project, Scene } from '../types/project';
import type { ProjectTemplateId, ProjectTemplateOption } from '../utils/templates';

type ProjectStats = {
  totalScenes: number;
  totalHotspots: number;
  totalLinkedHotspots: number;
  activeSceneName: string;
};

type SidebarProps = {
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
  walkthroughSectionId: 'inspector' | 'scenes' | 'sceneDetails' | 'hotspots' | 'controls' | null;
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
  const [expandedSections, setExpandedSections] = useState({
    onboarding: false,
    inspector: false,
    controls: false,
    templates: false,
    scenes: false,
    sceneDetails: false,
    hotspots: false
  });

  const isSectionOpen = (section: keyof typeof expandedSections) =>
    expandedSections[section] || walkthroughSectionId === section;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  };

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

  return (
    <div className="sidebar-stack">
      <section
        className={`sidebar-card overlay-card ${walkthroughSectionId === 'controls' ? 'walkthrough-focus' : ''}`}
        data-walkthrough-id="controls"
      >
        <button type="button" className="overlay-card-header" onClick={() => toggleSection('controls')}>
          <span className="sidebar-section-title">Project Controls</span>
          <span className="overlay-card-toggle">{isSectionOpen('controls') ? 'Hide' : 'Show'}</span>
        </button>
        {isSectionOpen('controls') ? (
          <div className="overlay-card-content">
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
          </div>
        ) : null}
      </section>

      <section
        className={`sidebar-card overlay-card project-inspector-wrap ${
          walkthroughSectionId === 'inspector' ? 'walkthrough-focus' : ''
        }`}
        data-walkthrough-id="inspector"
      >
        <button type="button" className="overlay-card-header" onClick={() => toggleSection('inspector')}>
          <span className="sidebar-section-title">Project Inspector</span>
          <span className="overlay-card-toggle">{isSectionOpen('inspector') ? 'Hide' : 'Show'}</span>
        </button>
        {isSectionOpen('inspector') ? (
          <div className="overlay-card-content">
            <label className="editor-field compact-field">
              <span>Project Name</span>
              <input value={project.name} onChange={onProjectNameChange} placeholder="My XR Project" />
            </label>
            <label className="editor-field compact-field">
              <span>Description (Optional)</span>
              <textarea
                value={project.description ?? ''}
                onChange={onProjectDescriptionChange}
                rows={2}
                placeholder="What experience are you building?"
              />
            </label>
            <label className="editor-field compact-field">
              <span>Author / Organization (Optional)</span>
              <input
                value={project.authorOrOrganization ?? ''}
                onChange={onProjectAuthorChange}
                placeholder="Team or company name"
              />
            </label>
            <div className="project-stats-grid">
              <p className="project-stat">
                <strong>{projectStats.totalScenes}</strong> scene(s)
              </p>
              <p className="project-stat">
                <strong>{projectStats.totalHotspots}</strong> hotspot(s)
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
          </div>
        ) : null}
      </section>

      <section
        className={`sidebar-card overlay-card scene-list-wrap ${
          walkthroughSectionId === 'scenes' ? 'walkthrough-focus' : ''
        }`}
        data-walkthrough-id="scenes"
      >
        <button type="button" className="overlay-card-header" onClick={() => toggleSection('scenes')}>
          <span className="sidebar-section-title">Scenes</span>
          <span className="overlay-card-toggle">{isSectionOpen('scenes') ? 'Hide' : 'Show'}</span>
        </button>
        {isSectionOpen('scenes') ? (
          <div className="overlay-card-content">
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

                return (
                  <li key={scene.id} className={`scene-row ${isSelected ? 'scene-row-selected' : ''}`}>
                    <button type="button" className="scene-select" onClick={() => onSelectScene(scene.id)}>
                      <span className="scene-name-wrap">
                        <span className="scene-name">{scene.name || 'Untitled Scene'}</span>
                        {isSelected ? <span className="active-badge">Active</span> : null}
                      </span>
                      <span className="hotspot-meta">{scene.hotspots.length} hotspot(s)</span>
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
          </div>
        ) : null}
      </section>

      <section
        className={`sidebar-card overlay-card scene-editor-wrap ${
          walkthroughSectionId === 'sceneDetails' ? 'walkthrough-focus' : ''
        }`}
        data-walkthrough-id="sceneDetails"
      >
        <button type="button" className="overlay-card-header" onClick={() => toggleSection('sceneDetails')}>
          <span className="sidebar-section-title">Active Scene Details</span>
          <span className="overlay-card-toggle">{isSectionOpen('sceneDetails') ? 'Hide' : 'Show'}</span>
        </button>
        {isSectionOpen('sceneDetails') ? (
          <div className="overlay-card-content">
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
          </div>
        ) : null}
      </section>

      <section
        className={`sidebar-card overlay-card hotspot-list-wrap ${
          walkthroughSectionId === 'hotspots' ? 'walkthrough-focus' : ''
        }`}
        data-walkthrough-id="hotspots"
      >
        <button type="button" className="overlay-card-header" onClick={() => toggleSection('hotspots')}>
          <span className="sidebar-section-title">Insight Zones (Active Scene)</span>
          <span className="overlay-card-toggle">{isSectionOpen('hotspots') ? 'Hide' : 'Show'}</span>
        </button>
        {isSectionOpen('hotspots') ? (
          <div className="overlay-card-content">
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
                          : 'Info';
                  const hotspotTypeChipClass =
                    hotspot.type === 'sceneLink'
                      ? 'hotspot-link-chip-scenelink'
                      : hotspot.type === 'externalLink'
                        ? 'hotspot-link-chip-externallink'
                        : hotspot.type === 'image'
                          ? 'hotspot-link-chip-image'
                          : 'hotspot-link-chip-info';

                  return (
                    <li key={hotspot.id} className={`hotspot-row ${isSelected ? 'hotspot-row-selected' : ''}`}>
                      <button
                        type="button"
                        className="hotspot-select"
                        onClick={() => onSelectHotspot(hotspot.id)}
                      >
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
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default Sidebar;
