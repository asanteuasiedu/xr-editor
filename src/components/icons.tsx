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
