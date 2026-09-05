import { CommandLine } from '@/app/components/command-line';
import { inlineCodeClassName } from '@/app/components/inline-code-style';

// Same two commands the relay drives interactively — shown as copy-paste fallback
// when the relay itself can't run (no PTY, offline, unsupported CLI version).
const AUTH_FIX_COMMANDS = ['claude auth login', 'claude setup-token'] as const;

export const RelayFallbackGuide = () => (
  <div className="mt-2 flex flex-col gap-2">
    <p className="opacity-[0.65] text-sm m-0">
      The in-app relay couldn't complete. Run one of these in a terminal instead:
    </p>
    {AUTH_FIX_COMMANDS.map((cmd) => (
      <CommandLine key={cmd} command={cmd} />
    ))}
    <p className="opacity-50 text-sm m-0">
      Alternatively, set <code className={inlineCodeClassName}>ANTHROPIC_API_KEY</code> in the
      server's environment — that bills as API usage rather than your Max subscription, so treat it
      as a fallback, not the default.
    </p>
  </div>
);
