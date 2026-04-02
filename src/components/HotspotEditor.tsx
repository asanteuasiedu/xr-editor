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
};

function HotspotEditor({
  hotspot,
  destinationScenes,
  isPlacementModeActive,
  onStartMovingHotspot,
  onUploadHotspotImage,
  onUpdateHotspot,
  onDeleteHotspot
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
    (field: 'title' | 'body' | 'url' | 'imageUrl' | 'questionPrompt' | 'feedbackText') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onUpdateHotspot(hotspot.id, { [field]: event.target.value });
    };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as HotspotType;
    const existingOptions =
      hotspot.answerOptions && hotspot.answerOptions.length >= 2
        ? hotspot.answerOptions
        : ['Option 1', 'Option 2'];
    onUpdateHotspot(hotspot.id, {
      type: nextType,
      targetSceneId: nextType === 'sceneLink' ? hotspot.targetSceneId : undefined,
      url: nextType === 'externalLink' ? hotspot.url : undefined,
      imageUrl: nextType === 'image' ? hotspot.imageUrl : undefined,
      questionPrompt: nextType === 'multipleChoice' ? hotspot.questionPrompt ?? 'New question prompt' : undefined,
      answerOptions: nextType === 'multipleChoice' ? existingOptions.slice(0, 4) : undefined,
      correctAnswerIndex: nextType === 'multipleChoice' ? hotspot.correctAnswerIndex ?? 0 : undefined,
      feedbackText: nextType === 'multipleChoice' ? hotspot.feedbackText ?? '' : undefined
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

  const answerOptions =
    hotspot.type === 'multipleChoice'
      ? hotspot.answerOptions && hotspot.answerOptions.length >= 2
        ? hotspot.answerOptions
        : ['Option 1', 'Option 2']
      : [];
  const hotspotImageSrc = hotspot.type === 'image' ? hotspot.imageUrl?.trim() ?? '' : '';

  const handleAnswerOptionChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextOptions = [...answerOptions];
    nextOptions[index] = event.target.value;
    onUpdateHotspot(hotspot.id, { answerOptions: nextOptions });
  };

  const handleAddAnswerOption = () => {
    if (answerOptions.length >= 4) {
      return;
    }

    onUpdateHotspot(hotspot.id, {
      answerOptions: [...answerOptions, `Option ${answerOptions.length + 1}`]
    });
  };

  const handleRemoveAnswerOption = (index: number) => {
    if (answerOptions.length <= 2) {
      return;
    }

    const nextOptions = answerOptions.filter((_, optionIndex) => optionIndex !== index);
    const nextCorrectIndex = Math.min(hotspot.correctAnswerIndex ?? 0, nextOptions.length - 1);

    onUpdateHotspot(hotspot.id, {
      answerOptions: nextOptions,
      correctAnswerIndex: nextCorrectIndex
    });
  };

  const handleCorrectAnswerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onUpdateHotspot(hotspot.id, { correctAnswerIndex: Number(event.target.value) });
  };

  return (
    <section className="panel editor-panel">
      <div className="editor-panel-header">
        <h2 className="panel-title">Selected Hotspot Editor</h2>
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
            <option value="multipleChoice">Multiple Choice</option>
          </select>
        </label>

        <label className="editor-field">
          <span>Title</span>
          <input value={hotspot.title} onChange={handleTextChange('title')} />
        </label>

        {hotspot.type !== 'multipleChoice' ? (
          <label className="editor-field">
            <span>Body</span>
            <textarea value={hotspot.body} onChange={handleTextChange('body')} rows={4} />
          </label>
        ) : null}

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
            <div className="editor-field">
              <span>Image Preview</span>
              {hotspotImageSrc ? (
                <div className="hotspot-image-preview-card">
                  <img src={hotspotImageSrc} alt={hotspot.title || 'Insight zone preview'} className="hotspot-image-preview-img" />
                </div>
              ) : (
                <div className="hotspot-image-preview-card hotspot-image-preview-empty">
                  <p className="placeholder-note">No image uploaded yet.</p>
                </div>
              )}
            </div>
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

        {hotspot.type === 'multipleChoice' ? (
          <>
            <label className="editor-field">
              <span>Question Prompt</span>
              <textarea
                value={hotspot.questionPrompt ?? ''}
                onChange={handleTextChange('questionPrompt')}
                rows={3}
                placeholder="What should the learner answer here?"
              />
            </label>

            <div className="editor-field">
              <span>Answer Options</span>
              <div className="quiz-option-list">
                {answerOptions.map((option, index) => (
                  <div key={`option-${index}`} className="quiz-option-row">
                    <input
                      value={option}
                      onChange={handleAnswerOptionChange(index)}
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="ui-button ui-button-secondary mini-button"
                      onClick={() => handleRemoveAnswerOption(index)}
                      disabled={answerOptions.length <= 2}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="quiz-option-actions">
                <button
                  type="button"
                  className="ui-button ui-button-secondary mini-button"
                  onClick={handleAddAnswerOption}
                  disabled={answerOptions.length >= 4}
                >
                  Add Option
                </button>
                <p className="helper-note">Use 2 to 4 answer choices for this question.</p>
              </div>
            </div>

            <label className="editor-field">
              <span>Correct Answer</span>
              <select value={hotspot.correctAnswerIndex ?? 0} onChange={handleCorrectAnswerChange}>
                {answerOptions.map((option, index) => (
                  <option key={`correct-${index}`} value={index}>
                    {option || `Option ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="editor-field">
              <span>Feedback / Explanation (Optional)</span>
              <textarea
                value={hotspot.feedbackText ?? ''}
                onChange={handleTextChange('feedbackText')}
                rows={3}
                placeholder="Explain the answer or give the learner a short takeaway."
              />
            </label>
          </>
        ) : null}
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
