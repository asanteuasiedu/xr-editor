import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.9 9.1 13 13l-3.9 1.9L11 11l3.9-1.9Z" />
    </BaseIcon>
  );
}

export function CatalogIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5 8.5 4l7 2.5L20 4v13.5L15.5 20l-7-2.5L4 20V6.5Z" />
      <path d="M8.5 4v13.5" />
      <path d="M15.5 6.5V20" />
      <path d="m12 9.2.9 2.1 2.3.2-1.7 1.5.5 2.2L12 14l-2 1.2.5-2.2-1.7-1.5 2.3-.2.9-2.1Z" />
    </BaseIcon>
  );
}

export function UserCircleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9" r="2.6" />
      <path d="M7.8 17.2c1.1-1.8 2.7-2.7 4.2-2.7s3.1.9 4.2 2.7" />
    </BaseIcon>
  );
}

export function LoginIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H4.5" />
      <path d="M13.5 4H18a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-4.5" />
    </BaseIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M14 17 9 12l5-5" />
      <path d="M9 12h10.5" />
      <path d="M10.5 4H6A1.5 1.5 0 0 0 4.5 5.5v13A1.5 1.5 0 0 0 6 20h4.5" />
    </BaseIcon>
  );
}

export function UserPlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="10" cy="8.5" r="3" />
      <path d="M4.8 18.3c1.3-2.1 3.2-3.1 5.2-3.1 1.1 0 2.2.3 3.1.9" />
      <path d="M17 10.5v6" />
      <path d="M14 13.5h6" />
    </BaseIcon>
  );
}

export function ClassroomsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="8.5" cy="9" r="2.4" />
      <circle cx="15.5" cy="10" r="2.1" />
      <path d="M4.8 18.2c.9-2 2.4-3 4.2-3 1.6 0 3 .8 4 2.4" />
      <path d="M12.8 17.8c.7-1.4 1.7-2 3-2 1.1 0 2.1.5 2.8 1.5" />
    </BaseIcon>
  );
}

export function CopyLinkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M7.8 16.2a3 3 0 0 1 0-4.2l2.2-2.2a3 3 0 0 1 4.2 0" />
      <path d="M16.2 7.8a3 3 0 0 1 0 4.2L14 14.2a3 3 0 0 1-4.2 0" />
      <path d="M6 6v4" />
      <path d="M4 8h4" />
    </BaseIcon>
  );
}

export function LinkOnIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 14 14 10" />
      <path d="M7.8 16.2a3 3 0 0 1 0-4.2l2.2-2.2a3 3 0 0 1 4.2 0" />
      <path d="M16.2 7.8a3 3 0 0 1 0 4.2L14 14.2a3 3 0 0 1-4.2 0" />
    </BaseIcon>
  );
}

export function LinkOffIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M7.8 16.2a3 3 0 0 1 0-4.2l2.2-2.2a3 3 0 0 1 4.2 0" />
      <path d="M16.2 7.8a3 3 0 0 1 0 4.2L14 14.2a3 3 0 0 1-4.2 0" />
      <path d="M5 5 19 19" />
    </BaseIcon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 15V5" />
      <path d="m8.5 8.5 3.5-3.5 3.5 3.5" />
      <path d="M5 15.5v1A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5v-1" />
    </BaseIcon>
  );
}

export function CloudSaveIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 18.5h10a3.5 3.5 0 0 0 .8-6.9 5.5 5.5 0 0 0-10.5-1.8A3.8 3.8 0 0 0 7 18.5Z" />
      <path d="M12 10v6" />
      <path d="m9.5 13.5 2.5 2.5 2.5-2.5" />
    </BaseIcon>
  );
}

export function ProjectsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 7.5A2 2 0 0 1 6.5 5.5h4.7l1.8 2h4.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15h4.5" />
    </BaseIcon>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
      <path d="m18.5 13.5.7 1.9 1.8.6-1.8.7-.7 1.8-.6-1.8-1.9-.7 1.9-.6.6-1.9Z" />
      <path d="m5.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </BaseIcon>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 19.5h15" />
      <path d="M7.5 16v-4" />
      <path d="M12 16V8" />
      <path d="M16.5 16v-6" />
      <path d="m6 10.5 3.3-2.7 2.8 1.4 4.4-3.7" />
    </BaseIcon>
  );
}

export function DraftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 3.5h6l4 4v13H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5v4h4" />
      <path d="m9.5 16.5 4.6-4.6 1.4 1.4-4.6 4.6-2 .6.6-2Z" />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 7.5h15" />
      <path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7" />
      <path d="M7.5 7.5 8.4 19a2 2 0 0 0 2 1.8h3.2a2 2 0 0 0 2-1.8l.9-11.5" />
      <path d="M10 11v5.5" />
      <path d="M14 11v5.5" />
    </BaseIcon>
  );
}

export function PublishIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.5c2 2.2 3.1 5.2 3.1 8.5S14 18.3 12 20.5c-2-2.2-3.1-5.2-3.1-8.5S10 5.7 12 3.5Z" />
    </BaseIcon>
  );
}

export function PresentIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16.5H5A1.5 1.5 0 0 1 3.5 15v-8A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="m10 10 4 2.5-4 2.5Z" />
      <path d="M8.5 19.5h7" />
    </BaseIcon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9 18.5-3 .9.9-3L15.4 7.9a1.8 1.8 0 0 1 2.5 0l.2.2a1.8 1.8 0 0 1 0 2.5Z" />
      <path d="m14.5 8.8 2.7 2.7" />
      <path d="M6.5 19.5h11" />
    </BaseIcon>
  );
}

export function EditProfileIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="10" cy="8.5" r="2.8" />
      <path d="M5.2 18.2c1.1-1.9 2.8-2.9 4.8-2.9.8 0 1.6.1 2.3.4" />
      <path d="m14.6 18.2-2.6.8.8-2.6 5-5a1.5 1.5 0 0 1 2.1 0l.1.1a1.5 1.5 0 0 1 0 2.1Z" />
    </BaseIcon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 12a9 9 0 0 1-15.2 6.5" />
      <path d="M3 12A9 9 0 0 1 18.2 5.5" />
      <path d="M18 2v4h-4" />
      <path d="M6 22v-4h4" />
    </BaseIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </BaseIcon>
  );
}

export function ExportCsvIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 3.5h6l4 4v13H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5v4h4" />
      <path d="M12 10v6" />
      <path d="m9.5 13.5 2.5 2.5 2.5-2.5" />
      <path d="M9 18.5h6" />
    </BaseIcon>
  );
}
