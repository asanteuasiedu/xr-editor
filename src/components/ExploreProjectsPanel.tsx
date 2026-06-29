import { useEffect, useMemo, useState } from 'react';
import type { CloudProjectWithProfile } from '../types/cloudProject';
import type { ExternalFeaturedExperience } from '../types/externalExperience';
import { CloseIcon, RefreshIcon } from './icons';
import ExternalExperienceCardMedia from './ExternalExperienceCardMedia';

type ExploreProjectsPanelProps = {
  isOpen: boolean;
  projects: CloudProjectWithProfile[];
  featuredExperiences: ExternalFeaturedExperience[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenProject: (project: CloudProjectWithProfile) => void;
  onOpenExternalExperience: (experience: ExternalFeaturedExperience) => void;
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

function getCreatorLabel(project: CloudProjectWithProfile) {
  const displayName = project.creator_profile?.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const organization = project.creator_profile?.organization?.trim();
  if (organization) {
    return organization;
  }

  return 'Udēēsa Creator';
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

function getExternalAudienceLabel(experience: ExternalFeaturedExperience) {
  return experience.targetAudience?.trim() || experience.organization?.trim() || 'Featured Experience';
}

function ExploreProjectsPanel({
  isOpen,
  projects,
  featuredExperiences,
  loading,
  error,
  onClose,
  onRefresh,
  onOpenProject,
  onOpenExternalExperience
}: ExploreProjectsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredProjects = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) {
      return projects;
    }

    return projects.filter((project) => {
      const creatorLabel = getCreatorLabel(project).toLowerCase();
      const organization = project.creator_profile?.organization?.toLowerCase() ?? '';
      const title = project.title.toLowerCase();
      const description = project.description?.toLowerCase() ?? '';

      return (
        title.includes(trimmedQuery) ||
        description.includes(trimmedQuery) ||
        creatorLabel.includes(trimmedQuery) ||
        organization.includes(trimmedQuery)
      );
    });
  }, [projects, searchQuery]);

  const filteredFeaturedExperiences = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) {
      return featuredExperiences;
    }

    return featuredExperiences.filter((experience) => {
      const searchFields = [
        experience.title,
        experience.description ?? '',
        experience.organization ?? '',
        experience.location ?? '',
        getExternalAudienceLabel(experience),
        ...(experience.tags ?? [])
      ];

      return searchFields.some((field) => field.toLowerCase().includes(trimmedQuery));
    });
  }, [featuredExperiences, searchQuery]);

  const totalVisibleExperiences = filteredFeaturedExperiences.length + filteredProjects.length;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="auth-modal-backdrop explore-panel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Explore published XR experiences"
      onClick={onClose}
    >
      <div className="auth-modal-card explore-panel explore-panel-scroll" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header explore-panel-header">
          <div className="auth-modal-heading">
            <p className="auth-modal-kicker">Explore</p>
            <h2>Explore XR Experiences</h2>
            <p className="auth-modal-copy">
              Discover published immersive learning experiences from the Udēēsa community.
            </p>
          </div>
          <div className="auth-modal-actions-inline panel-header-actions">
            <button
              type="button"
              className="profile-icon-action"
              aria-label="Refresh published experiences"
              title="Refresh published experiences"
              onClick={onRefresh}
            >
              <RefreshIcon aria-hidden="true" />
            </button>
            <button
              type="button"
              className="profile-icon-action"
              aria-label="Close Explore"
              title="Close Explore"
              onClick={onClose}
            >
              <CloseIcon aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="explore-panel-toolbar">
          <label className="explore-search-field">
            <span className="sr-only">Search published XR experiences</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, creator, or organization"
            />
          </label>
          <span className="profile-experience-count">{totalVisibleExperiences}</span>
        </div>

        {loading ? (
          <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
            Loading published experiences...
          </p>
        ) : null}

        {!loading && !error && totalVisibleExperiences === 0 ? (
          <div className="explore-empty-state">
            <h3>
              {projects.length === 0 && featuredExperiences.length === 0
                ? 'No featured or published experiences yet.'
                : 'No experiences match that search.'}
            </h3>
            <p>
              {projects.length === 0 && featuredExperiences.length === 0
                ? 'Featured experiences and published community projects will appear here as they become available.'
                : 'Try a different title, creator name, or organization.'}
            </p>
          </div>
        ) : null}

        {filteredFeaturedExperiences.length > 0 ? (
          <section className="featured-experience-section">
            <div className="explore-section-header">
              <div>
                <p className="auth-modal-kicker">Featured</p>
                <h3>Featured Experiences</h3>
              </div>
            </div>
            <div className="profile-experience-grid featured-experience-grid" role="list">
              {filteredFeaturedExperiences.map((experience) => (
                <article key={experience.id} className="profile-experience-card external-experience-card" role="listitem">
                  <button
                    type="button"
                    className="profile-experience-card-button"
                    onClick={() => onOpenExternalExperience(experience)}
                  >
                    <div className="profile-experience-media external-experience-card-media">
                      <ExternalExperienceCardMedia
                        experience={experience}
                        audienceLabel={getExternalAudienceLabel(experience)}
                      />
                      <div className="profile-experience-media-overlay" />
                      <div className="profile-experience-topline">
                        <span className="profile-experience-status profile-experience-status-published">Featured</span>
                        <span className="profile-experience-status profile-experience-status-draft">
                          {getExternalAudienceLabel(experience)}
                        </span>
                      </div>
                      <div className="profile-experience-card-copy">
                        <strong>{experience.title}</strong>
                        <span>{experience.organization || experience.location || 'Curated external experience'}</span>
                      </div>
                    </div>
                  </button>
                  <div className="explore-project-creator-copy external-experience-copy">
                    <strong>{experience.organization || 'Featured external experience'}</strong>
                    <span>{experience.description || 'View-only immersive experience hosted outside the Udēēsa editor.'}</span>
                  </div>
                  <div className="explore-project-meta">
                    {experience.location ? <span>{experience.location}</span> : null}
                    {experience.tags?.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary mini-button"
                    onClick={() => onOpenExternalExperience(experience)}
                  >
                    Open Experience
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!loading || filteredProjects.length > 0 || error ? (
          <section className="featured-experience-section">
            <div className="explore-section-header">
              <div>
                <p className="auth-modal-kicker">Community</p>
                <h3>Published Community Experiences</h3>
              </div>
            </div>
            {error ? (
              <div className="explore-empty-state">
                <h3>Published community experiences could not be loaded right now.</h3>
                <p>
                  Featured experiences are still available while the native published-project feed is unavailable.
                </p>
              </div>
            ) : null}
            {!loading && !error && filteredProjects.length === 0 ? (
              <div className="explore-empty-state">
                <h3>No published community experiences yet.</h3>
                <p>Published Udēēsa projects will appear here once creators share them.</p>
              </div>
            ) : null}
            {!loading && filteredProjects.length > 0 ? (
              <div className="profile-experience-grid explore-project-grid" role="list">
                {filteredProjects.map((project) => {
                  const creatorLabel = getCreatorLabel(project);
                  const creatorAvatarUrl = project.creator_profile?.avatar_url?.trim() || null;

                  return (
                    <article key={project.id} className="profile-experience-card explore-project-card" role="listitem">
                      <button
                        type="button"
                        className="profile-experience-card-button"
                        onClick={() => onOpenProject(project)}
                      >
                        <div className="profile-experience-media">
                          {project.thumbnail_url ? (
                            <img src={project.thumbnail_url} alt={project.title || 'Published experience preview'} />
                          ) : (
                            <div className="profile-experience-placeholder" aria-hidden="true">
                              <span>360</span>
                            </div>
                          )}
                          <div className="profile-experience-media-overlay" />
                          <div className="profile-experience-topline">
                            <span className="profile-experience-status profile-experience-status-published">Published</span>
                          </div>
                          <div className="profile-experience-card-copy">
                            <strong>{project.title || 'Untitled Project'}</strong>
                            <span>{formatUpdatedDate(project.updated_at)}</span>
                          </div>
                        </div>
                      </button>
                      <div className="explore-project-creator">
                        {creatorAvatarUrl ? (
                          <img src={creatorAvatarUrl} alt={`${creatorLabel} avatar`} className="explore-project-avatar" />
                        ) : (
                          <div className="explore-project-avatar explore-project-avatar-fallback" aria-hidden="true">
                            {getInitials(creatorLabel)}
                          </div>
                        )}
                        <div className="explore-project-creator-copy">
                          <strong>{creatorLabel}</strong>
                          <span>{project.creator_profile?.organization?.trim() || 'Published community experience'}</span>
                        </div>
                      </div>
                      <div className="explore-project-meta">
                        <span>Native Udēēsa project</span>
                        <span>{formatUpdatedDate(project.updated_at)}</span>
                      </div>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary mini-button"
                        onClick={() => onOpenProject(project)}
                      >
                        Open Experience
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default ExploreProjectsPanel;
