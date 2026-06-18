import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { CompassIcon, UserCircleIcon, UserPlusIcon } from './icons';

type AuthControlsProps = {
  variant: 'onboarding' | 'header';
  onOpenExplore: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenProfile: () => void;
};

function getUserLabel(email?: string | null) {
  if (!email) {
    return 'Signed in';
  }

  if (email.length <= 28) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return email;
  }

  return `${localPart.slice(0, 14)}…@${domain}`;
}

function AuthControls({ variant, onOpenExplore, onOpenSignUp, onOpenProfile }: AuthControlsProps) {
  const { user, profile, profileLoading, loading } = useAuth();

  const userLabel = useMemo(() => {
    const displayName =
      profile?.display_name ??
      (typeof user?.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name
        : typeof user?.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : null);

    return displayName?.trim() || getUserLabel(profile?.email ?? user?.email);
  }, [profile?.display_name, profile?.email, user?.email, user?.user_metadata]);

  const isOnboarding = variant === 'onboarding';

  if (loading) {
    return (
      <div className={isOnboarding ? 'creation-onboarding-header-actions' : 'app-auth-controls'}>
        <button
          type="button"
          className="topbar-icon-button"
          aria-label="Explore"
          title="Explore"
          onClick={onOpenExplore}
        >
          <CompassIcon aria-hidden="true" />
        </button>
        <div
          className={isOnboarding ? 'creation-onboarding-auth-status' : 'app-auth-status'}
          role="status"
          aria-live="polite"
        >
          Checking session...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={isOnboarding ? 'creation-onboarding-header-actions' : 'app-auth-controls'}>
        <button
          type="button"
          className="topbar-icon-button"
          aria-label="Explore"
          title="Explore"
          onClick={onOpenExplore}
        >
          <CompassIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="topbar-icon-button topbar-icon-button-primary"
          aria-label="Sign Up"
          title="Sign Up"
          onClick={onOpenSignUp}
        >
          <UserPlusIcon aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={isOnboarding ? 'creation-onboarding-auth-user' : 'app-auth-user'}>
      <div className={isOnboarding ? 'creation-onboarding-auth-user-card' : 'app-auth-user-card'}>
        <span className="auth-user-kicker">Signed in</span>
        <strong title={user.email ?? userLabel}>{userLabel}</strong>
        {profileLoading ? <span className="auth-user-subtle">Loading profile...</span> : null}
      </div>
      <button
        type="button"
        className="topbar-icon-button"
        aria-label="Explore"
        title="Explore"
        onClick={onOpenExplore}
      >
        <CompassIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        className="topbar-icon-button"
        aria-label="Profile"
        title="Profile"
        onClick={onOpenProfile}
      >
        <UserCircleIcon aria-hidden="true" />
      </button>
    </div>
  );
}

export default AuthControls;
