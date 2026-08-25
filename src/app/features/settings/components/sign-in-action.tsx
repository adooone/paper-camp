import { Button, CodeBlock } from '@dendelion/paper-ui';
import { useSignInAction } from '../hooks';

// Same two commands the relay drives interactively — shown as copy-paste fallback
// when the relay itself can't run (no PTY, offline, unsupported CLI version).
const AUTH_FIX_COMMANDS = ['claude auth login', 'claude setup-token'] as const;

const RelayFallbackGuide = () => (
  <div className="mt-2 flex flex-col gap-2">
    <p className="opacity-[0.65] text-sm m-0">
      The in-app relay couldn't complete. Run one of these in a terminal instead:
    </p>
    {AUTH_FIX_COMMANDS.map((cmd) => (
      <CodeBlock key={cmd} code={cmd} />
    ))}
    <p className="opacity-50 text-sm m-0">
      {/* paper-ui has no inline-code component, only the block-level CodeBlock */}
      Alternatively, set <code>ANTHROPIC_API_KEY</code> in the server's environment — that bills as
      API usage rather than your Max subscription, so treat it as a fallback, not the default.
    </p>
  </div>
);

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
