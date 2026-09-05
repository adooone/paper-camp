import { useSignInAction } from '@/app/features/settings/hooks';
import { Button, Input } from '@dendelion/paper-ui';
import { useState } from 'react';
import { RelayFallbackGuide } from './relay-fallback-guide';

interface SignInActionProps {
  onSignedIn: () => void;
}

export const SignInAction = ({ onSignedIn }: SignInActionProps) => {
  const { phase, authorizeUrl, needsCode, startLoginRelay, cancelLoginRelay, submitCode } =
    useSignInAction(onSignedIn);
  const [code, setCode] = useState('');

  if (phase === 'starting') {
    return (
      <Button size="small" disabled>
        Starting…
      </Button>
    );
  }
  if (phase === 'awaiting-authorization') {
    const handleSubmit = () => {
      const trimmed = code.trim();
      if (!trimmed) return;
      submitCode(trimmed);
      setCode('');
    };
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="small"
          onClick={() => authorizeUrl && window.open(authorizeUrl, '_blank', 'noopener,noreferrer')}
        >
          Reopen sign-in tab
        </Button>
        <Button size="small" onClick={() => cancelLoginRelay()}>
          Cancel
        </Button>
        {needsCode && (
          <>
            <Input
              size="small"
              placeholder="Paste the code the sign-in page shows"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button size="small" onClick={handleSubmit} disabled={!code.trim()}>
              Submit
            </Button>
          </>
        )}
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
