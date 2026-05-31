import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile, profileLoading, updateProfile, refreshProfile, isConfigured } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setMessage(null);
      return;
    }

    setDisplayName(profile?.display_name ?? '');
    setOrganization(profile?.organization ?? '');
    setStatus('idle');
    setMessage(null);
  }, [isOpen, profile?.display_name, profile?.organization]);

  if (!isOpen || !user) {
    return null;
  }

  const isSaving = status === 'loading';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      await updateProfile({
        displayName,
        organization
      });
      setStatus('success');
      setMessage('Profile saved.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Profile changes could not be saved right now.');
    }
  };

  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-label="Your profile" onClick={onClose}>
      <div className="auth-modal-card profile-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-heading">
            <p className="auth-modal-kicker">Profile</p>
            <h2>Your Individual Profile</h2>
            <p className="auth-modal-copy">
              Update the basics we’ll use for future creator and project ownership features.
            </p>
          </div>
          <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onClose}>
            Close
          </button>
        </div>

        {!isConfigured ? (
          <p className="auth-modal-status auth-modal-status-error">
            Authentication is not configured yet. Add the Supabase Vite environment variables to enable profiles.
          </p>
        ) : null}

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label className="auth-modal-field">
            <span>Email</span>
            <input type="email" value={profile?.email ?? user.email ?? ''} readOnly className="auth-modal-readonly" />
          </label>

          <label className="auth-modal-field">
            <span>Display Name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (status !== 'loading') {
                  setStatus('idle');
                  setMessage(null);
                }
              }}
              placeholder="How should your name appear?"
              disabled={isSaving || profileLoading || !isConfigured || !profile}
            />
          </label>

          <label className="auth-modal-field">
            <span>Organization</span>
            <input
              type="text"
              value={organization}
              onChange={(event) => {
                setOrganization(event.target.value);
                if (status !== 'loading') {
                  setStatus('idle');
                  setMessage(null);
                }
              }}
              placeholder="School, studio, or team"
              disabled={isSaving || profileLoading || !isConfigured || !profile}
            />
          </label>

          <div className="profile-modal-grid">
            <label className="auth-modal-field">
              <span>Profile Type</span>
              <input type="text" value={profile?.profile_type ?? 'individual'} readOnly className="auth-modal-readonly" />
            </label>

            <label className="auth-modal-field">
              <span>Role</span>
              <input type="text" value={profile?.role ?? 'creator'} readOnly className="auth-modal-readonly" />
            </label>
          </div>

          {profileLoading ? (
            <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
              Loading your profile...
            </p>
          ) : null}

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

          {!profile && !profileLoading ? (
            <p className="auth-modal-status auth-modal-status-error">
              We couldn’t load your profile yet. Apply the profiles SQL in Supabase, then try again.
            </p>
          ) : null}

          <div className="auth-modal-actions">
            <button
              type="submit"
              className="ui-button ui-button-primary auth-modal-submit"
              disabled={isSaving || profileLoading || !profile || !isConfigured}
            >
              {isSaving ? 'Saving Profile...' : 'Save Profile'}
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary auth-modal-switch"
              onClick={() => {
                setStatus('idle');
                setMessage(null);
                void refreshProfile();
              }}
              disabled={isSaving || !isConfigured}
            >
              Refresh Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileModal;
