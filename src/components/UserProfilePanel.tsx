import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AnalyticsIcon, CloseIcon, DraftIcon, PublishIcon, RefreshIcon, SparklesIcon, TrashIcon, UploadIcon } from './icons';
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
  onViewAnalytics: (project: CloudProject) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleProjectStatus: (projectId: string, status: 'draft' | 'published') => void;
  onCreateProjectFromUpload: (file: File) => Promise<void>;
  onCreateProjectFromPrompt: (prompt: string) => Promise<void>;
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
  onViewAnalytics,
  onDeleteProject,
  onToggleProjectStatus,
  onCreateProjectFromUpload,
  onCreateProjectFromPrompt
}: UserProfilePanelProps) {
  const { user, profile, signOut } = useAuth();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isUploadCreating, setIsUploadCreating] = useState(false);
  const [isGeneratePromptOpen, setIsGeneratePromptOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerateCreating, setIsGenerateCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const displayName = useMemo(
    () => getProfileDisplayName(profile?.display_name, profile?.email ?? user?.email),
    [profile?.display_name, profile?.email, user?.email]
  );
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const bio = profile?.bio?.trim() || null;
  const organization = profile?.organization?.trim() || null;
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const trimmedGeneratePrompt = generatePrompt.trim();

  useEffect(() => {
    if (!isOpen) {
      setIsUploadCreating(false);
      setIsGeneratePromptOpen(false);
      setGeneratePrompt('');
      setIsGenerateCreating(false);
      setCreationError(null);
      setSignOutError(null);
    }
  }, [isOpen]);

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
          <div className="auth-modal-actions-inline panel-header-actions">
            <button
              type="button"
              className="profile-icon-action"
              aria-label="Refresh projects"
              title="Refresh projects"
              onClick={onRefresh}
            >
              <RefreshIcon aria-hidden="true" />
            </button>
            <button
              type="button"
              className="profile-icon-action"
              aria-label="Close profile panel"
              title="Close profile panel"
              onClick={onClose}
            >
              <CloseIcon aria-hidden="true" />
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

          {creationError ? (
            <p className="auth-modal-status auth-modal-status-error" role="status" aria-live="polite">
              {creationError}
            </p>
          ) : null}

          {!loading ? (
            <div className="profile-experience-grid" role="list">
              <article className="profile-experience-card profile-new-project-shell" role="listitem">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden-file-input"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';

                    if (!file) {
                      return;
                    }

                    setCreationError(null);
                    setIsUploadCreating(true);

                    try {
                      await onCreateProjectFromUpload(file);
                    } catch (creationIssue) {
                      setCreationError(
                        creationIssue instanceof Error
                          ? creationIssue.message
                          : 'Could not create the project from that image.'
                      );
                    } finally {
                      setIsUploadCreating(false);
                    }
                  }}
                />
                <div className="profile-new-project-card">
                  <div className="profile-new-project-plus" aria-hidden="true">
                    +
                  </div>
                </div>
                <div className="profile-new-project-actions profile-project-card-actions">
                  <button
                    type="button"
                    className="profile-icon-action"
                    aria-label={isUploadCreating ? 'Uploading 360 image' : 'Upload 360 image'}
                    title={isUploadCreating ? 'Uploading 360 image' : 'Upload 360 image'}
                    aria-busy={isUploadCreating}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isUploadCreating || isGenerateCreating) {
                        return;
                      }
                      setCreationError(null);
                      uploadInputRef.current?.click();
                    }}
                    disabled={isUploadCreating || isGenerateCreating}
                  >
                    <UploadIcon aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="profile-icon-action profile-icon-action-primary"
                    aria-label={isGenerateCreating ? 'Generating 360 image' : 'Generate 360 image'}
                    title={isGenerateCreating ? 'Generating 360 image' : 'Generate 360 image'}
                    aria-busy={isGenerateCreating}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCreationError(null);
                      setIsGeneratePromptOpen((current) => !current);
                    }}
                    disabled={isUploadCreating || isGenerateCreating}
                  >
                    <SparklesIcon aria-hidden="true" />
                  </button>
                </div>
                {isGeneratePromptOpen ? (
                  <form
                    className="profile-new-project-generate"
                    onSubmit={async (event) => {
                      event.preventDefault();

                      if (!trimmedGeneratePrompt || isGenerateCreating || isUploadCreating) {
                        if (!trimmedGeneratePrompt) {
                          setCreationError('Please enter a scene description first.');
                        }
                        return;
                      }

                      setCreationError(null);
                      setIsGenerateCreating(true);

                      try {
                        await onCreateProjectFromPrompt(trimmedGeneratePrompt);
                        setGeneratePrompt('');
                        setIsGeneratePromptOpen(false);
                      } catch (creationIssue) {
                        setCreationError(
                          creationIssue instanceof Error
                            ? creationIssue.message
                            : 'Could not generate a new project right now. Try again shortly.'
                        );
                      } finally {
                        setIsGenerateCreating(false);
                      }
                    }}
                  >
                    <input
                      type="text"
                      value={generatePrompt}
                      onChange={(event) => setGeneratePrompt(event.target.value)}
                      placeholder="Describe a 360 learning environment"
                      disabled={isGenerateCreating || isUploadCreating}
                    />
                    <div className="profile-new-project-generate-actions">
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={() => {
                          setGeneratePrompt('');
                          setCreationError(null);
                          setIsGeneratePromptOpen(false);
                        }}
                        disabled={isGenerateCreating}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="ui-button ui-button-primary mini-button"
                        disabled={!trimmedGeneratePrompt || isGenerateCreating || isUploadCreating}
                      >
                        {isGenerateCreating ? 'Generating...' : 'Create Draft'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>

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
                    <div className="profile-experience-card-actions profile-project-card-actions">
                      <button
                        type="button"
                        className="profile-icon-action analytics"
                        aria-label="View analytics"
                        title="View analytics"
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewAnalytics(project);
                        }}
                      >
                        <AnalyticsIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`profile-icon-action ${projectStatus === 'draft' ? 'publish' : ''}`}
                        aria-label={projectStatus === 'draft' ? 'Publish' : 'Move to draft'}
                        title={projectStatus === 'draft' ? 'Publish' : 'Move to draft'}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onToggleProjectStatus(project.id, nextStatus);
                        }}
                      >
                        {projectStatus === 'draft' ? (
                          <PublishIcon aria-hidden="true" />
                        ) : (
                          <DraftIcon aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="profile-icon-action danger"
                        aria-label="Delete project"
                        title="Delete project"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onDeleteProject(project.id);
                        }}
                      >
                        <TrashIcon aria-hidden="true" />
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
