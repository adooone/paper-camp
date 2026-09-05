import { useSignInAction } from '@/app/features/settings/hooks';
import { Button } from '@dendelion/paper-ui';
import { RelayFallbackGuide } from './relay-fallback-guide';

interface SignInActionProps {
  onSignedIn: () => void;
}

export const SignInAction = ({ onSignedIn }: SignInActionProps) => {
  const { phase, authorizeUrl, startLoginRelay, cancelLoginRelay } = useSignInAction(onSignedIn);

  if (phase === 'starting') {
    return (
      <Button size="small" disabled>
        Starting…
      </Button>
    );
  }
  if (phase === 'awaiting-authorization') {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="small"
          onClick={() => authorizeUrl && window.open(authorizeUrl, '_blank', 'noopener,noreferrer')}
        >
          Reopen sign-in tab
        </Button>
        <Button size="small" onClick={() => cancelLoginRelay()}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <div>
      <Button size="small" onClick={() => startLoginRelay()}>
        Sign in
      </Button>
      {phase === 'error' && <RelayFallbackGuide />}
    </div>
  );
};
