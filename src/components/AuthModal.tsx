import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthModalMode = 'signIn' | 'signUp';

type AuthModalProps = {
  mode: AuthModalMode;
  isOpen: boolean;
  onClose: () => void;
  onSwitchMode: (mode: AuthModalMode) => void;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function AuthModal({ mode, isOpen, onClose, onSwitchMode }: AuthModalProps) {
  const { signIn, signUp, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setMessage(null);
      setPassword('');
    }
  }, [isOpen]);

  const normalizedEmail = normalizeEmail(email);
  const passwordValue = password;
  const canSubmit = Boolean(normalizedEmail && passwordValue) && status !== 'loading';
  const modalTitle = mode === 'signIn' ? 'Log in to Udēēsa' : 'Create your Udēēsa account';
  const submitLabel = status === 'loading' ? (mode === 'signIn' ? 'Logging in...' : 'Creating account...') : mode === 'signIn' ? 'Log In' : 'Create Account';
  const switchLabel = mode === 'signIn' ? 'Need an account? Sign Up' : 'Already have an account? Log In';
  const helperCopy = useMemo(() => {
    if (isConfigured) {
      return mode === 'signIn'
        ? 'Log in to sync your future projects and profile features when they arrive.'
        : 'Create an account now so your work can be tied to a profile in future phases.';
    }

    return 'Authentication needs Supabase environment variables before sign in and sign up can work.';
  }, [isConfigured, mode]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      if (mode === 'signIn') {
        await signIn(normalizedEmail, passwordValue);
        setStatus('idle');
        onClose();
        return;
      }

      const result = await signUp(normalizedEmail, passwordValue);

      if (result.needsEmailConfirmation) {
        setStatus('success');
        setMessage('Account created. Check your email to confirm the account before logging in.');
        return;
      }

      setStatus('idle');
      onClose();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Authentication could not be completed right now.');
    }
  };

  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-label={modalTitle} onClick={onClose}>
      <div className="auth-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-heading">
            <p className="auth-modal-kicker">Account</p>
            <h2>{modalTitle}</h2>
            <p className="auth-modal-copy">{helperCopy}</p>
          </div>
          <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label className="auth-modal-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status !== 'loading') {
                  setStatus('idle');
                  setMessage(null);
                }
              }}
              placeholder="you@example.com"
              disabled={status === 'loading'}
            />
          </label>

          <label className="auth-modal-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (status !== 'loading') {
                  setStatus('idle');
                  setMessage(null);
                }
              }}
              placeholder="Enter your password"
              disabled={status === 'loading'}
            />
          </label>

          {message ? (
            <p
              className={`auth-modal-status ${
                status === 'error' ? 'auth-modal-status-error' : 'auth-modal-status-success'
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}

          <div className="auth-modal-actions">
            <button type="submit" className="ui-button ui-button-primary auth-modal-submit" disabled={!canSubmit}>
              {submitLabel}
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary auth-modal-switch"
              onClick={() => {
                onSwitchMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setStatus('idle');
                setMessage(null);
              }}
              disabled={status === 'loading'}
            >
              {switchLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
export type { AuthModalMode };
