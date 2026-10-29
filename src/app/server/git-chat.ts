import type { AgentManager } from './agent';
import type { GitManager } from './git';

// Catches the plan's own example ("pull and push") plus git-flavored phrasing,
// without needing an LLM call for every message — tied to git nouns (main, origin,
// branch, repo) so an unrelated "push the deadline" or "let's sync tomorrow" misses.
const GIT_SYNC_RE =
  /\b(?:pull\s*(?:and|&)\s*push|push\s*(?:and|&)\s*pull|git\s*sync|(?:sync|pull|push)\s*(?:to|with|from)?\s*(?:main|origin|branch|repo|git)|(?:main|origin|branch|repo|git)\s*sync|fix\s*[- ]?diverg\w*|(?:merge|rebase)\s*conflict|resolve\s+(?:the\s+)?conflict)\b/i;

const CONFIRM_RE = /^(?:yes|yep|yeah|sure|confirm(?:ed)?|go ahead|do it|resolve it|please)\.?!?$/i;

const PENDING_TTL_MS = 10 * 60 * 1000;

interface PendingConflict {
  prompt: string;
  expiresAt: number;
}

// Keyed per chat context (the project chat, or one idea's feedback thread) so a
// conflict surfaced in one thread can't be confirmed from an unrelated one.
const pendingConflicts = new Map<string, PendingConflict>();

function takePendingConflict(key: string): string | undefined {
  const pending = pendingConflicts.get(key);
  pendingConflicts.delete(key);
  return pending && pending.expiresAt >= Date.now() ? pending.prompt : undefined;
}

// Same safety the git card's resolve-conflict button gets: a backup ref before any
// rewrite, so a dropped duplicate commit is always undoable (IDEA-319).
export async function launchResolveConflict(
  prompt: string,
  git: GitManager,
  agent: AgentManager,
): Promise<ReturnType<AgentManager['launch']>> {
  const backupRef = await git.createBackupRef();
  return agent.launch(
    'resolve-conflict',
    { planTitle: 'Resolve rebase conflict' },
    `${prompt}\n\nBefore you started, \`${backupRef}\` was created pointing at this branch's pre-rebase tip — if dropping a commit's code changes turns out wrong, that ref has what came before.`,
  );
}

export interface GitChatOutcome {
  handled: boolean;
  reply?: string;
}

// Routes a chat message to the same sync/fix-divergence/resolve-conflict actions the
// git card has, with the same confirmation: a plain sync runs immediately, but a
// content conflict only reaches the agent once the user explicitly confirms (IDEA-319).
export async function tryHandleGitChatRequest(
  key: string,
  text: string,
  git: GitManager,
  agent: AgentManager,
): Promise<GitChatOutcome> {
  const pendingPrompt = takePendingConflict(key);
  if (pendingPrompt) {
    if (!CONFIRM_RE.test(text)) {
      pendingConflicts.set(key, { prompt: pendingPrompt, expiresAt: Date.now() + PENDING_TTL_MS });
    } else {
      const result = await launchResolveConflict(pendingPrompt, git, agent);
      return {
        handled: true,
        reply: result.ok
          ? "Launched the agent to resolve the conflict — I'll report back once the repo settles."
          : `Couldn't start: ${result.error}`,
      };
    }
  }
  if (!GIT_SYNC_RE.test(text)) return { handled: false };

  const result = await git.runGitSync();
  if (result.ok) {
    return { handled: true, reply: 'Synced — this branch is level with origin/main.' };
  }
  if (result.stage === 'conflicted') {
    pendingConflicts.set(key, {
      prompt: result.conflictPrompt ?? result.recoveryPrompt,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });
    return {
      handled: true,
      reply: `${result.message} Reply "yes" and I'll have the agent resolve it — it keeps a backup ref first.`,
    };
  }
  const recovery = agent.launch(
    'sync',
    { planTitle: 'Recover sync to main' },
    result.recoveryPrompt,
  );
  return {
    handled: true,
    reply: recovery.ok
      ? `${result.message} Launched the agent to recover — I'll report back.`
      : `${result.message} Couldn't start recovery: ${recovery.error}`,
  };
}
