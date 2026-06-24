import type { ExternalFeaturedExperience } from '../types/externalExperience';

// Featured external experiences are curated/admin-defined only.
// Do not accept arbitrary user-submitted URLs without validation.
export const featuredExternalExperiences: ExternalFeaturedExperience[] = [
  {
    id: 'xltv-lake-volta',
    title: 'XLTV1.2 — Lake Volta',
    description:
      'A featured immersive learning experience connected to Lake Volta and Udēēsa’s XLTV1.2 storyworld.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/XLTV1.2%20-%20Lake%20Volta/index.htm',
    organization: 'Udēēsa',
    location: 'Lake Volta, Ghana',
    tags: ['XLTV1.2', 'Storyworld', 'Immersive Learning'],
    targetAudience: 'XLTV1.2',
    featured: true,
  },
  {
    id: 'the-diaspora',
    title: 'The Diaspora',
    description:
      'A featured immersive experience exploring diaspora identity, movement, and cultural connection.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/The%20Diaspora/index.htm',
    organization: 'Udēēsa',
    tags: ['Diaspora', 'Culture', 'Heritage'],
    targetAudience: 'XLTV1.2',
    featured: true,
  },
  {
    id: 'ilrn-xr-treasure-hunt',
    title: 'iLRN — XR Treasure Hunt',
    description:
      'An XR treasure hunt experience designed for immersive learning, discovery, and global studies engagement.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/iLRN%20-%20XR%20Treasure%20Hunt/index.htm',
    organization: 'Udēēsa',
    tags: ['iLRN', 'XR', 'Global Studies'],
    targetAudience: 'Global Studies',
    featured: true,
  },
  {
    id: 'africa-center-global-africa-gateway',
    title: 'The Africa Center — Global Africa Gateway',
    description:
      'A featured web-based experience connected to Global Africa and cultural learning.',
    provider: 'external',
    experienceUrl:
      'https://www.udeesa.com/the-africa-center-global-africa-gateway',
    organization: 'Udēēsa',
    location: 'New York, New York',
    tags: ['Events', 'Global Africa', 'Culture'],
    targetAudience: 'Events',
    featured: true,
  },
  {
    id: 'ada-shea-demo',
    title: 'ADA — Shea Demo',
    description:
      'A featured immersive experience exploring shea production, global value chains, and cultural learning.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/ADA%20-%20Shea%20Demo/index.htm',
    organization: 'Udēēsa',
    tags: ['Global Studies', 'Agriculture', 'Diaspora'],
    targetAudience: 'Global Studies',
    featured: true,
  },
  {
    id: 'honnoji-yasuke',
    title: 'Honnoji — Yasuke',
    description:
      'A featured immersive experience exploring Yasuke, history, identity, and global cultural exchange.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/Honnoji%20-%20Yauske/index.htm',
    organization: 'Udēēsa',
    tags: ['Global Studies', 'History', 'Yasuke'],
    targetAudience: 'Global Studies',
    featured: true,
  },
  {
    id: '4h-university-of-nebraska-build-a-hut',
    title: '4-H / University of Nebraska — Build a Hut',
    description:
      'A featured skill-building experience connected to hands-on construction, design, and applied learning.',
    provider: 'external',
    experienceUrl:
      'https://www.udeesa.com/4h-university-of-nebraska-build-a-hut',
    organization: 'Udēēsa',
    tags: ['STEM', 'Skill Building', 'Workforce Readiness'],
    targetAudience: 'STEM + Skill Building',
    featured: true,
  },
  {
    id: 'foresight-cloud-watching',
    title: 'Foresight — Cloud Watching',
    description:
      'A featured immersive experience supporting observation, systems thinking, and applied STEM learning.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/Foresight%20-%20Cloud%20Watching/index.htm',
    organization: 'Udēēsa',
    tags: ['STEM', 'Foresight', 'Observation'],
    targetAudience: 'STEM + Skill Building',
    featured: true,
  },
  {
    id: 'roadbuilder-port-recon',
    title: 'RoadBuilder — Port Recon',
    description:
      'A featured immersive experience focused on infrastructure, navigation, and applied skill-building.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/RoadBuilder%20-%20Port%20Recon/index.htm',
    organization: 'Udēēsa',
    tags: ['STEM', 'Infrastructure', 'Skill Building'],
    targetAudience: 'STEM + Skill Building',
    featured: true,
  },
  {
    id: 'reginald-f-lewis-blacks-in-white-vr',
    title: 'Reginald F. Lewis Museum — Blacks in White VR',
    description:
      'A featured museum experience connected to the Blacks in White exhibition at the Reginald F. Lewis Museum.',
    provider: 'external',
    experienceUrl:
      'https://storage.googleapis.com/udeesa_experiences/Reginald%20F%20Lewis%20-%20Blacks%20in%20White%20-%20VR/index.htm',
    organization: 'Reginald F. Lewis Museum',
    location: 'Baltimore, Maryland',
    tags: ['Museums', 'Exhibition', 'African American History'],
    targetAudience: 'Museums',
    featured: true,
  }
];
