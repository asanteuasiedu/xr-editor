import { useEffect, useState } from 'react';
import type { ExternalFeaturedExperience } from '../types/externalExperience';

type ExternalExperienceCardMediaProps = {
  experience: ExternalFeaturedExperience;
  audienceLabel: string;
};

function ExternalExperienceCardMedia({
  experience,
  audienceLabel
}: ExternalExperienceCardMediaProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [experience.id, experience.thumbnailUrl]);

  const showThumbnail = Boolean(experience.thumbnailUrl && !thumbnailFailed);

  if (showThumbnail) {
    return (
      <img
        src={experience.thumbnailUrl}
        alt={`${experience.title} thumbnail`}
        className="external-experience-card-thumbnail"
        loading="lazy"
        onError={() => setThumbnailFailed(true)}
      />
    );
  }

  return (
    <div className="external-experience-fallback" aria-hidden="true">
      <span>Featured</span>
      <strong>{audienceLabel}</strong>
    </div>
  );
}

export default ExternalExperienceCardMedia;
