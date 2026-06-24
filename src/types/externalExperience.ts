export type ExternalExperienceProvider = '3dvista' | 'google-cloud' | 'external';

export type ExternalFeaturedExperience = {
  id: string;
  title: string;
  description?: string;
  provider: ExternalExperienceProvider;
  experienceUrl: string;
  thumbnailUrl?: string;
  organization?: string;
  location?: string;
  tags?: string[];
  targetAudience?: string;
  featured?: boolean;
  createdAt?: string;
};
