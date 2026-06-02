import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { CloudProject } from '../types/cloudProject';

type UserProfilePanelProps = {
  isOpen: boolean;
  projects: CloudProject[];
  loading: boolean;
  error: string | null;
  currentProjectId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onEditProfile: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleProjectStatus: (projectId: string, status: 'draft' | 'published') => void;
};

function formatUpdatedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Updated recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getProfileDisplayName(displayName: string | null | undefined, email: string | null | undefined) {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const trimmedEmail = email?.trim();
  if (!trimmedEmail) {
    return 'Individual Creator';
  }

  return trimmedEmail.split('@')[0] || trimmedEmail;
}

function getInitials(label: string) {
  const words = label
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return 'U';
  }

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

function UserProfilePanel({
  isOpen,
  projects,
  loading,
  error,
  currentProjectId,
  onClose,
  onRefresh,
  onEditProfile,
  onOpenProject,
  onDeleteProject,
  onToggleProjectStatus
}: UserProfilePanelProps) {
  const { user, profile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = useMemo(
    () => getProfileDisplayName(profile?.display_name, profile?.email ?? user?.email),
    [profile?.display_name, profile?.email, user?.email]
  );
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const bio = profile?.bio?.trim() || null;
  const organization = profile?.organization?.trim() || null;
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  if (!isOpen || !user) {
    return null;
  }

  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-label="Your profile" onClick={onClose}>
      <div className="auth-modal-card user-profile-panel" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header user-profile-panel-header">
          <div className="auth-modal-heading">
            <p className="auth-modal-kicker">Profile</p>
            <h2>Your Experiences</h2>
            <p className="auth-modal-copy">
              Reopen saved XR experiences, switch between draft and published status, and keep your creator profile up to date.
            </p>
          </div>
          <div className="auth-modal-actions-inline">
            <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onRefresh}>
              Refresh
            </button>
            <button type="button" className="ui-button ui-button-secondary mini-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <section className="profile-hero-card">
          <div className="profile-hero-avatar-wrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${displayName} avatar`} className="profile-hero-avatar" />
            ) : (
              <div className="profile-hero-avatar-fallback" aria-hidden="true">
                {initials}
              </div>
            )}
          </div>
          <div className="profile-hero-copy">
            <div className="profile-hero-title-row">
              <div>
                <h3>{displayName}</h3>
                <p className="profile-hero-email">{profile?.email ?? user.email ?? 'Signed in'}</p>
              </div>
              <div className="profile-hero-badges">
                <span className="profile-pill">Individual</span>
                <span className="profile-pill profile-pill-muted">{profile?.role ?? 'creator'}</span>
              </div>
            </div>
            <p className="profile-hero-bio">{bio || 'Add a short bio to introduce your XR teaching or creation focus.'}</p>
            <div className="profile-hero-meta">
              {organization ? <span>{organization}</span> : <span>No organization added yet</span>}
              <span>{projects.length} saved experience{projects.length === 1 ? '' : 's'}</span>
            </div>
            <div className="profile-hero-actions">
              <button type="button" className="ui-button ui-button-primary mini-button" onClick={onEditProfile}>
                Edit Profile
              </button>
              <button
                type="button"
                className="ui-button ui-button-secondary mini-button"
                onClick={async () => {
                  if (isSigningOut) {
                    return;
                  }

                  setSignOutError(null);
                  setIsSigningOut(true);

                  try {
                    await signOut();
                    onClose();
                  } catch (logoutError) {
                    setSignOutError(
                      logoutError instanceof Error ? logoutError.message : 'Could not log out right now. Try again.'
                    );
                  } finally {
                    setIsSigningOut(false);
                  }
                }}
              >
                {isSigningOut ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
            {signOutError ? <p className="auth-inline-error">{signOutError}</p> : null}
          </div>
        </section>

        <section className="profile-experiences-section">
          <div className="profile-experiences-header">
            <div>
              <p className="auth-modal-kicker">Experiences</p>
              <h3>Saved XR Projects</h3>
            </div>
            <span className="profile-experience-count">{projects.length}</span>
          </div>

          {loading ? (
            <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
              Loading your saved experiences...
            </p>
          ) : null}

          {error ? (
            <p className="auth-modal-status auth-modal-status-error" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}

          {!loading && !error && projects.length === 0 ? (
            <div className="my-projects-empty-state">
              <strong>No saved experiences yet.</strong>
              <p>Use Save to Account from the Project panel to add your first experience to this profile grid.</p>
            </div>
          ) : null}

          {!loading && projects.length > 0 ? (
            <div className="profile-experience-grid" role="list">
              {projects.map((project) => {
                const projectStatus = project.status === 'published' ? 'published' : 'draft';
                const nextStatus = projectStatus === 'draft' ? 'published' : 'draft';
                const isCurrentProject = currentProjectId === project.id;

                return (
                  <article
                    key={project.id}
                    className={`profile-experience-card ${isCurrentProject ? 'profile-experience-card-active' : ''}`}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="profile-experience-card-button"
                      onClick={() => onOpenProject(project.id)}
                    >
                      <div className="profile-experience-media">
                        {project.thumbnail_url ? (
                          <img src={project.thumbnail_url} alt={project.title || 'Saved experience preview'} />
                        ) : (
                          <div className="profile-experience-placeholder" aria-hidden="true">
                            <span>360</span>
                          </div>
                        )}
                        <div className="profile-experience-media-overlay" />
                        <div className="profile-experience-topline">
                          <span className={`profile-experience-status profile-experience-status-${projectStatus}`}>
                            {projectStatus === 'published' ? 'Published' : 'Draft'}
                          </span>
                          {isCurrentProject ? <span className="my-project-current-badge">Current</span> : null}
                        </div>
                        <div className="profile-experience-card-copy">
                          <strong>{project.title || 'Untitled Project'}</strong>
                          <span>{formatUpdatedDate(project.updated_at)}</span>
                        </div>
                      </div>
                    </button>
                    <div className="profile-experience-card-actions">
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={() => onToggleProjectStatus(project.id, nextStatus)}
                      >
                        {projectStatus === 'draft' ? 'Publish' : 'Move to Draft'}
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={() => onDeleteProject(project.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default UserProfilePanel;
