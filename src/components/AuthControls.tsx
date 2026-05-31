import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthControlsProps = {
  variant: 'onboarding' | 'header';
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

function AuthControls({ variant, onOpenSignIn, onOpenSignUp, onOpenProfile }: AuthControlsProps) {
  const { user, profile, profileLoading, loading, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div
        className={isOnboarding ? 'creation-onboarding-auth-status' : 'app-auth-status'}
        role="status"
        aria-live="polite"
      >
        Checking session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className={isOnboarding ? 'creation-onboarding-header-actions' : 'app-auth-controls'}>
        <button
          type="button"
          className={isOnboarding ? 'ui-button ui-button-secondary creation-onboarding-auth-button' : 'ui-button ui-button-secondary app-auth-button'}
          onClick={onOpenSignIn}
        >
          Login
        </button>
        <button
          type="button"
          className={isOnboarding ? 'ui-button ui-button-primary creation-onboarding-auth-button' : 'ui-button ui-button-primary app-auth-button'}
          onClick={onOpenSignUp}
        >
          Sign Up
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
        className={isOnboarding ? 'ui-button ui-button-secondary creation-onboarding-auth-button' : 'ui-button ui-button-secondary app-auth-button'}
        onClick={onOpenProfile}
      >
        Profile
      </button>
      <button
        type="button"
        className={isOnboarding ? 'ui-button ui-button-secondary creation-onboarding-auth-button' : 'ui-button ui-button-secondary app-auth-button'}
        onClick={async () => {
          if (isSigningOut) {
            return;
          }

          setError(null);
          setIsSigningOut(true);

          try {
            await signOut();
          } catch (signOutError) {
            setError(signOutError instanceof Error ? signOutError.message : 'Could not log out right now. Try again.');
          } finally {
            setIsSigningOut(false);
          }
        }}
      >
        {isSigningOut ? 'Logging out...' : 'Log Out'}
      </button>
      {error ? <p className="auth-inline-error">{error}</p> : null}
    </div>
  );
}

export default AuthControls;
