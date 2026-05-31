import type { FormEvent } from 'react';
import { useState } from 'react';
import AuthControls from './AuthControls';

type CreationOnboardingProps = {
  onGenerate: (prompt: string) => Promise<void>;
  onOpenCatalog: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenProfile: () => void;
};

type CreationOnboardingStatus = 'idle' | 'loading' | 'error';

function CreationOnboarding({
  onGenerate,
  onOpenCatalog,
  onOpenSignIn,
  onOpenSignUp,
  onOpenProfile
}: CreationOnboardingProps) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<CreationOnboardingStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const trimmedPrompt = prompt.trim();
  const isGenerating = status === 'loading';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedPrompt || isGenerating) {
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
            Generate a 360 learning environment from a prompt or choose a starting location from the catalog.
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
                disabled={isGenerating}
              />
            </label>

            <button
              type="button"
              className="ui-button ui-button-secondary creation-onboarding-catalog"
              onClick={onOpenCatalog}
              disabled={isGenerating}
            >
              Select a location from our catalog
            </button>

            <button type="submit" className="ui-button ui-button-primary creation-onboarding-generate" disabled={!trimmedPrompt || isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </form>

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
