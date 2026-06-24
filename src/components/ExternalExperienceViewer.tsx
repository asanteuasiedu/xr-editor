import type { ExternalFeaturedExperience } from '../types/externalExperience';
import { CloseIcon } from './icons';

type ExternalExperienceViewerProps = {
  experience: ExternalFeaturedExperience;
  onClose: () => void;
};

function getAudienceLabel(experience: ExternalFeaturedExperience) {
  return experience.targetAudience?.trim() || experience.organization?.trim() || 'Featured Experience';
}

function ExternalExperienceViewer({ experience, onClose }: ExternalExperienceViewerProps) {
  return (
    <div
      className="external-experience-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={experience.title}
      onClick={onClose}
    >
      <div className="external-experience-shell" onClick={(event) => event.stopPropagation()}>
        <header className="external-experience-header">
          <div className="external-experience-heading">
            <div className="external-experience-badges">
              <span className="profile-experience-status profile-experience-status-published">Featured</span>
              <span className="profile-experience-status profile-experience-status-draft">
                {getAudienceLabel(experience)}
              </span>
            </div>
            <h2>{experience.title}</h2>
            <p>
              {experience.organization || 'Curated external experience'}
              {experience.location ? ` · ${experience.location}` : ''}
            </p>
          </div>
          <div className="panel-header-actions">
            <a
              className="ui-button ui-button-secondary mini-button"
              href={experience.experienceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open in New Tab
            </a>
            <button
              type="button"
              className="panel-icon-action"
              aria-label="Close external experience"
              title="Close external experience"
              onClick={onClose}
            >
              <CloseIcon aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="external-experience-body">
          <iframe
            key={experience.id}
            src={experience.experienceUrl}
            title={experience.title}
            className="external-experience-frame"
            allow="fullscreen; gyroscope; accelerometer; xr-spatial-tracking"
            allowFullScreen
          />
          <p className="external-experience-note">
            If the experience does not appear here, the host may block iframe embedding. Use Open in New Tab to view it
            directly.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ExternalExperienceViewer;
