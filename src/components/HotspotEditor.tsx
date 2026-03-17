import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Hotspot, HotspotType, Scene } from '../types/project';

type HotspotEditorProps = {
  hotspot?: Hotspot;
  destinationScenes: Scene[];
  isPlacementModeActive: boolean;
  onStartMovingHotspot: () => void;
  onUploadHotspotImage: (hotspotId: string, file: File) => void | Promise<void>;
  onUpdateHotspot: (hotspotId: string, patch: Partial<Hotspot>) => void;
  onDeleteHotspot: (hotspotId: string) => void;
  onCloseEditor?: () => void;
};

function parseNumberField(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function HotspotEditor({
  hotspot,
  destinationScenes,
  isPlacementModeActive,
  onStartMovingHotspot,
  onUploadHotspotImage,
  onUpdateHotspot,
  onDeleteHotspot,
  onCloseEditor
}: HotspotEditorProps) {
  const hotspotImageInputRef = useRef<HTMLInputElement | null>(null);

  if (!hotspot) {
    return (
      <section className="panel editor-panel">
        <h2 className="panel-title">Selected Hotspot Editor</h2>
        <p className="placeholder-note">Select an insight zone to edit it, or add a new one.</p>
      </section>
    );
  }

  const handleTextChange =
    (field: 'title' | 'body' | 'url' | 'imageUrl') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onUpdateHotspot(hotspot.id, { [field]: event.target.value });
    };

  const handleNumberChange =
    (field: 'yaw' | 'pitch') => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = parseNumberField(event.target.value, hotspot[field]);
      onUpdateHotspot(hotspot.id, { [field]: nextValue });
    };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as HotspotType;
    onUpdateHotspot(hotspot.id, {
      type: nextType,
      targetSceneId: nextType === 'sceneLink' ? hotspot.targetSceneId : undefined,
      url: nextType === 'externalLink' ? hotspot.url : undefined,
      imageUrl: nextType === 'image' ? hotspot.imageUrl : undefined
    });
  };

  const handleDestinationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTarget = event.target.value || undefined;
    onUpdateHotspot(hotspot.id, { targetSceneId: nextTarget });
  };

  const openHotspotImageUpload = () => {
    hotspotImageInputRef.current?.click();
  };

  const onHotspotImageUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void onUploadHotspotImage(hotspot.id, file);
  };

  return (
    <section className="panel editor-panel">
      <div className="editor-panel-header">
        <h2 className="panel-title">Selected Hotspot Editor</h2>
        {onCloseEditor ? (
          <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onCloseEditor}>
            Close
          </button>
        ) : null}
      </div>
      <p className="editor-selection-note">
        Editing: <strong>{hotspot.title || 'Untitled Insight Zone'}</strong>
      </p>
      <div className="editor-grid">
        <label className="editor-field">
          <span>Type</span>
          <select value={hotspot.type} onChange={handleTypeChange}>
            <option value="info">Info</option>
            <option value="sceneLink">Scene Link</option>
            <option value="externalLink">External Link</option>
            <option value="image">Image</option>
          </select>
        </label>

        <label className="editor-field">
          <span>Title</span>
          <input value={hotspot.title} onChange={handleTextChange('title')} />
        </label>

        <label className="editor-field">
          <span>Body</span>
          <textarea value={hotspot.body} onChange={handleTextChange('body')} rows={4} />
        </label>

        {hotspot.type === 'sceneLink' ? (
          <label className="editor-field">
            <span>Destination Scene</span>
            <select value={hotspot.targetSceneId ?? ''} onChange={handleDestinationChange}>
              <option value="">Select destination scene</option>
              {destinationScenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name || 'Untitled Scene'}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {hotspot.type === 'externalLink' ? (
          <label className="editor-field">
            <span>External URL</span>
            <input
              value={hotspot.url ?? ''}
              onChange={handleTextChange('url')}
              placeholder="https://example.com"
            />
          </label>
        ) : null}

        {hotspot.type === 'image' ? (
          <>
            <input
              ref={hotspotImageInputRef}
              type="file"
              accept="image/*"
              className="hidden-file-input"
              onChange={onHotspotImageUploadChange}
            />
            <label className="editor-field">
              <span>Image URL</span>
              <input
                value={hotspot.imageUrl ?? ''}
                onChange={handleTextChange('imageUrl')}
                placeholder="https://example.com/image.jpg"
              />
            </label>
            {!hotspot.imageUrl?.trim() ? (
              <p className="helper-note">Add an image URL or upload an image file to enable preview.</p>
            ) : null}
            <button
              type="button"
              className="ui-button ui-button-secondary secondary-button upload-button"
              onClick={openHotspotImageUpload}
            >
              Upload Image
            </button>
            <p className="helper-note">Uploaded images are embedded in your local project JSON.</p>
          </>
        ) : null}

        <div className="editor-row">
          <label className="editor-field">
            <span>Yaw</span>
            <input
              type="number"
              step="0.5"
              min={-180}
              max={180}
              value={hotspot.yaw}
              onChange={handleNumberChange('yaw')}
            />
            <small className="field-help">Left / right (-180 to 180)</small>
          </label>

          <label className="editor-field">
            <span>Pitch</span>
            <input
              type="number"
              step="0.5"
              min={-90}
              max={90}
              value={hotspot.pitch}
              onChange={handleNumberChange('pitch')}
            />
            <small className="field-help">Up / down (-90 to 90)</small>
          </label>
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="ui-button ui-button-secondary secondary-button"
            onClick={onStartMovingHotspot}
            disabled={isPlacementModeActive}
          >
            Move Selected Hotspot
          </button>
          <button type="button" className="ui-button danger-button" onClick={() => onDeleteHotspot(hotspot.id)}>
            Delete Hotspot
          </button>
        </div>
      </div>
    </section>
  );
}

export default HotspotEditor;
