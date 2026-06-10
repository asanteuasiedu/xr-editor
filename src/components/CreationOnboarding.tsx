import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';
import AuthControls from './AuthControls';
import { CatalogIcon, CompassIcon, SparklesIcon, UploadIcon } from './icons';

type CreationOnboardingProps = {
  isAuthenticated: boolean;
  onGenerate: (prompt: string) => Promise<void>;
  onOpenCatalog: () => void;
  onUploadImage: (file: File) => Promise<void>;
  onOpenExplore: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenProfile: () => void;
};

type CreationOnboardingStatus = 'idle' | 'loading' | 'error';

function CreationOnboarding({
  isAuthenticated,
  onGenerate,
  onOpenCatalog,
  onUploadImage,
  onOpenExplore,
  onOpenSignIn,
  onOpenSignUp,
  onOpenProfile
}: CreationOnboardingProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<CreationOnboardingStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const trimmedPrompt = prompt.trim();
  const isBusy = status === 'loading';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedPrompt || isBusy) {
      return;
    }

    setStatus('loading');
    setMessage('Generating your 360 scene...');

    try {
      await onGenerate(trimmedPrompt);
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not generate the scene right now. Try another prompt or try again shortly.'
      );
    }
  };

  const handleUploadSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || isBusy) {
      return;
    }

    setStatus('loading');
    setMessage('Uploading your 360 image...');

    try {
      await onUploadImage(file);
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not load that 360 image right now. Try another file.'
      );
    }
  };

  return (
    <div className="creation-onboarding" role="dialog" aria-modal="true" aria-label="Start creating with Udēēsa">
      <div className="creation-onboarding-ripple viewer-empty-ripple" aria-hidden="true">
        <div className="viewer-empty-ripple-core" />
        <div className="viewer-empty-ripple-rings" />
        <div className="viewer-empty-ripple-sheen" />
      </div>

      <header className="creation-onboarding-header">
        <div className="creation-onboarding-brand">
          <img src="/branding/udeesa-logo.png" alt="Udēēsa logo" className="creation-onboarding-logo" />
          <div>
            <p className="creation-onboarding-brand-kicker">UDĒĒSA</p>
            <p className="creation-onboarding-brand-subtitle">XR For You.</p>
          </div>
        </div>

        <button
          type="button"
          className="topbar-icon-button creation-onboarding-explore-button"
          aria-label="Explore"
          title="Explore"
          onClick={onOpenExplore}
        >
          <CompassIcon aria-hidden="true" />
        </button>
        <AuthControls
          variant="onboarding"
          onOpenSignIn={onOpenSignIn}
          onOpenSignUp={onOpenSignUp}
          onOpenProfile={onOpenProfile}
        />
      </header>

      <div className="creation-onboarding-center">
        <section className="creation-onboarding-card">
          <p className="creation-onboarding-card-kicker">Set the scene</p>
          <h2>Start Creating with Udēēsa</h2>
          <p className="creation-onboarding-card-copy">
            Generate a 360 learning environment from a prompt, upload your own 360 image, or choose a starting location from the catalog.
          </p>

          <form className="creation-onboarding-form" onSubmit={handleSubmit}>
            <label className="creation-onboarding-field" htmlFor="creation-onboarding-prompt">
              <span className="sr-only">Describe your learning environment</span>
              <input
                id="creation-onboarding-prompt"
                type="text"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (status !== 'loading') {
                    setStatus('idle');
                    setMessage(null);
                  }
                }}
                placeholder="Describe your learning environment"
                disabled={isBusy}
              />
            </label>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleUploadSelection}
            />

            <div className="scene-start-actions">
              <button
                type="button"
                className="scene-start-icon-action"
                aria-label="Select a location from our catalog"
                title="Select a location from our catalog"
                onClick={() => {
                  if (status !== 'loading') {
                    setStatus('idle');
                    setMessage(null);
                  }
                  onOpenCatalog();
                }}
                disabled={isBusy}
              >
                <CatalogIcon aria-hidden="true" />
                <span>Catalog</span>
              </button>

              <button
                type="button"
                className="scene-start-icon-action"
                aria-label="Upload a 360 image"
                title="Upload a 360 image"
                onClick={() => {
                  if (isBusy) {
                    return;
                  }
                  setStatus('idle');
                  setMessage(null);
                  uploadInputRef.current?.click();
                }}
                disabled={isBusy}
              >
                <UploadIcon aria-hidden="true" />
                <span>Upload</span>
              </button>

              <button
                type="submit"
                className="scene-start-icon-action scene-start-icon-action-primary"
                aria-label="Generate"
                title="Generate"
                disabled={!trimmedPrompt || isBusy}
              >
                <SparklesIcon aria-hidden="true" />
                <span>{isBusy ? 'Working...' : 'Generate'}</span>
              </button>
            </div>
          </form>

          {!isAuthenticated ? (
            <p className="creation-onboarding-card-copy">
              Generate or select a scene to preview your experience. Sign in to edit and save.
            </p>
          ) : null}

          {message ? (
            <p
              className={`creation-onboarding-status ${
                status === 'error' ? 'creation-onboarding-status-error' : 'creation-onboarding-status-info'
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default CreationOnboarding;
