import { findFocusPlan } from '@/app/features/plans/helpers';
import {
  commitChanges,
  pullFromOrigin,
  pushChanges,
  suggestCommitMessage,
  syncToMain,
} from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import {
  Accordion,
  Alert,
  Button,
  Card,
  IconButton,
  Input,
  Stamp,
  Textarea,
  Tooltip,
} from '@dendelion/paper-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MergeIcon, PullIcon, PushIcon, WandIcon } from '../icons';
import { deskChalk, deskTextMuted, sectionLabelStyle } from './shared';

const COMMIT_TITLE_STORAGE_KEY = 'papercamp.commitTitle';
const COMMIT_MESSAGE_STORAGE_KEY = 'papercamp.commitMessage';

// Subsystem-area scopes — keep in sync with .commitlintrc.json's `scope-enum`
// (release/main are release-bot-only and intentionally excluded from suggestions).
const COMMIT_SCOPES = [
  'core',
  'cli',
  'app',
  'server',
  'agent',
  'plans',
  'ideas',
  'docs',
  'settings',
  'stack',
  'ui',
  'ci',
  'config',
  'deps',
  'repo',
];

function readStoredCommitField(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStoredCommitField(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall back to in-memory only
  }
}

export const CommitSection = () => {
  const plans = useAppStore((s) => s.plans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);

  const [commitExpanded, setCommitExpanded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitTitle, setCommitTitle] = useState(() =>
    readStoredCommitField(COMMIT_TITLE_STORAGE_KEY),
  );
  const [commitMessage, setCommitMessage] = useState(() =>
    readStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY),
  );
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);

  const suggestedScope = useMemo(() => {
    // Scope is a subsystem area, never the plan id. Prefer the plan's first tag
    // that's a known scope (matches AGENTS.md's "usually the plan's primary tag"
    // rule); fall back to `repo`. The plan id goes in the Refs: footer instead.
    const tagScope = activePlan?.tags?.find((t) => COMMIT_SCOPES.includes(t));
    return tagScope ?? 'repo';
  }, [activePlan]);

  const allPhasesDone = useMemo(
    () => Boolean(activePlan?.phases.length) && activePlan!.phases.every((phase) => phase.done),
    [activePlan],
  );

  const suggestedTitle = useMemo(() => {
    if (!activePlan) return '';
    const kind = activePlan.kind ?? 'feat';
    if (allPhasesDone) return `${kind}(${suggestedScope}): updates`;
    return `${kind}(${suggestedScope}): ${activePlan.title}`;
  }, [activePlan, suggestedScope, allPhasesDone]);

  const suggestedMessage = useMemo(() => {
    if (!activePlan) return '';
    // Plan id lives in a Refs: footer (commit-scope convention), not the scope.
    const refs = activePlan.id ? `Refs: ${activePlan.id}` : '';
    const phaseBody =
      !allPhasesDone && activePlan.phases.length
        ? activePlan.phases.map((phase) => `- ${phase.text}`).join('\n')
        : '';
    return [phaseBody, refs].filter(Boolean).join('\n\n');
  }, [activePlan, allPhasesDone]);

  useEffect(() => {
    if (suggestedTitle && !commitTitle) {
      setCommitTitle(suggestedTitle);
    }
  }, [suggestedTitle, commitTitle]);

  // A finished fix-review leaves its work uncommitted and reports the message it
  // wants that work committed under. It beats both the heuristic default above and
  // a diff-based suggestion — the agent knows why it made each change — so it wins
  // outright. Keyed by content so it applies once per run and doesn't fight the
  // user's own edits afterwards.
  const appliedAgentCommitRef = useRef<string | null>(null);
  const suggestedCommit = agentStatus.find((t) => t.suggestedCommit)?.suggestedCommit;
  useEffect(() => {
    if (!suggestedCommit) {
      appliedAgentCommitRef.current = null;
      return;
    }
    const key = `${suggestedCommit.title}\n${suggestedCommit.message}`;
    if (appliedAgentCommitRef.current === key) return;
    appliedAgentCommitRef.current = key;
    setCommitTitle(suggestedCommit.title);
    setCommitMessage(suggestedCommit.message);
  }, [suggestedCommit]);

  useEffect(() => {
    if (suggestedMessage && !commitMessage) {
      setCommitMessage(suggestedMessage);
    }
  }, [suggestedMessage, commitMessage]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_TITLE_STORAGE_KEY, commitTitle);
  }, [commitTitle]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY, commitMessage);
  }, [commitMessage]);

  const knownPathsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!gitStatus) return;
    // Snapshot + advance the ref OUTSIDE the setState updater. Mutating it inside
    // makes the updater impure, and StrictMode double-invokes updaters: the first
    // pass would fill `known` with every path so the second pass selects nothing,
    // leaving the file list empty (and the Suggest/Commit buttons disabled).
    const known = knownPathsRef.current;
    knownPathsRef.current = new Set(gitStatus.map((e) => e.path));
    setSelectedFiles((prev) => {
      const next = new Set<string>();
      for (const entry of gitStatus) {
        // Auto-select newly-seen files; preserve the user's existing choice otherwise.
        if (!known.has(entry.path) || prev.has(entry.path)) {
          next.add(entry.path);
        }
      }
      return next;
    });
  }, [gitStatus]);

  const handleToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim() || commitInFlight) return;
    setCommitting(true);
    setCommitInFlight(true);
    setCommitError(null);
    try {
      await commitChanges(
        [...selectedFiles],
        commitTitle.trim(),
        commitMessage.trim() || undefined,
      );
      setCommitTitle(suggestedTitle);
      setCommitMessage('');
      setCommitExpanded(false);
      await loadGitStatus();
    } catch (err) {
      setCommitError((err as Error).message);
    } finally {
      setCommitting(false);
      setCommitInFlight(false);
    }
  }, [
    commitTitle,
    commitMessage,
    selectedFiles,
    suggestedTitle,
    loadGitStatus,
    commitInFlight,
    setCommitInFlight,
  ]);

  const handlePush = useCallback(async () => {
    setPushing(true);
    setPushError(null);
    try {
      await pushChanges();
      await loadGitStatus();
    } catch (err) {
      setPushError((err as Error).message);
    } finally {
      setPushing(false);
    }
  }, [loadGitStatus]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncToMain();
      // A sync can pull new commits (entities added/edited upstream), so refresh
      // the worklist too — reloading only git status would leave the plans/ideas
      // list showing stale pre-pull data until a full page reload.
      await Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);
    } catch (err) {
      setSyncError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [loadGitStatus, loadPlans, loadIdeas]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    setPullError(null);
    try {
      await pullFromOrigin();
      // Same as sync: the pull may bring in upstream entity changes, so refresh
      // the worklist alongside git status rather than requiring a page reload.
      await Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);
    } catch (err) {
      setPullError((err as Error).message);
    } finally {
      setPulling(false);
    }
  }, [loadGitStatus, loadPlans, loadIdeas]);

  const handleSuggestFromChanges = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestCommitMessage([...selectedFiles]);
      setCommitTitle(result.title);
      setCommitMessage(result.message);
    } catch (err) {
      setSuggestError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
  }, [selectedFiles]);

  return (
    <div
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: space[6],
      }}
    >
      <div style={{ ...sectionLabelStyle, display: 'flex', alignItems: 'center', gap: space[2] }}>
        Commit
        {gitBranch && (
          <Stamp surface="chalkboard" size="small">
            {gitBranch}
          </Stamp>
        )}
      </div>
      <Card surface="chalkboard" size="small" className="stack-card-fill">
        {gitStatus && gitStatus.length > 0 ? (
          <>
            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
              <Accordion
                title={`${gitStatus.length} file${gitStatus.length === 1 ? '' : 's'} changed`}
                expanded={commitExpanded}
                onToggle={() => setCommitExpanded(!commitExpanded)}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: space[2],
                    paddingTop: space[2],
                  }}
                >
                  {gitStatus.map((entry) => (
                    <label
                      key={entry.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[2],
                        fontFamily: fontFamily.mono,
                        fontSize: fontSize['2xs'],
                        color: deskChalk,
                        cursor: 'pointer',
                      }}
                    >
                      {/* Raw checkbox, not paper-ui's Checkbox: this row's mono file-path
                          layout with independently colored staged/unstaged text doesn't
                          fit Checkbox's single `label` slot, and its own blob/sketch
                          chrome would clash with this chalkboard file list. */}
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(entry.path)}
                        onChange={() => handleToggleFile(entry.path)}
                        style={{ accentColor: deskChalk }}
                      />
                      <span
                        style={{
                          color: entry.staged ? deskChalk : deskTextMuted,
                          minWidth: 24,
                        }}
                      >
                        {entry.status}
                      </span>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.path}
                      </span>
                    </label>
                  ))}
                </div>
              </Accordion>
            </div>
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: space[3],
                marginTop: space[3],
              }}
            >
              {gitBranchHygiene === 'stale-merged' ? (
                // Merged branch: committing here only strands more work off main, so
                // the agent-backed dirty sync (stash → main → ff, changes carried not
                // lost) replaces the commit controls instead of sitting under them.
                <>
                  {syncError && (
                    <Alert surface="chalkboard" dismissible onDismiss={() => setSyncError(null)}>
                      {syncError}
                    </Alert>
                  )}
                  <Button
                    surface="chalkboard"
                    size="small"
                    fullWidth
                    icon={<MergeIcon size={14} />}
                    disabled={syncing}
                    onClick={handleSync}
                  >
                    {syncing ? 'Syncing…' : 'Branch merged — sync to main'}
                  </Button>
                </>
              ) : (
                <>
                  {suggestError && (
                    <Alert surface="chalkboard" dismissible onDismiss={() => setSuggestError(null)}>
                      {suggestError}
                    </Alert>
                  )}
                  <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        surface="chalkboard"
                        size="small"
                        placeholder="Commit title"
                        value={commitTitle}
                        onChange={(e) => setCommitTitle(e.currentTarget.value)}
                      />
                    </div>
                    <IconButton
                      icon={<WandIcon size={16} />}
                      surface="chalkboard"
                      size="small"
                      label="Suggest title and message from the diff"
                      disabled={selectedFiles.size === 0 || suggesting}
                      onClick={handleSuggestFromChanges}
                      wobble={suggesting ? 1 : 0}
                    />
                  </div>
                  <Textarea
                    surface="chalkboard"
                    size="small"
                    placeholder="Commit message (optional)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.currentTarget.value)}
                    rows={2}
                  />
                  {commitError && (
                    <Alert surface="chalkboard" dismissible onDismiss={() => setCommitError(null)}>
                      {commitError}
                    </Alert>
                  )}
                  <Button
                    surface="chalkboard"
                    size="small"
                    fullWidth
                    disabled={
                      selectedFiles.size === 0 ||
                      !commitTitle.trim() ||
                      committing ||
                      commitInFlight
                    }
                    onClick={handleCommit}
                  >
                    {committing || commitInFlight ? 'Committing…' : 'Commit'}
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space[3],
            }}
          >
            {gitAhead > 0 ? (
              <>
                <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
                  All changes committed — {gitAhead} commit{gitAhead === 1 ? '' : 's'} ready to
                  push.
                </p>
                {pushError && (
                  <Alert surface="chalkboard" dismissible onDismiss={() => setPushError(null)}>
                    {pushError}
                  </Alert>
                )}
                <Button
                  surface="chalkboard"
                  size="small"
                  icon={<PushIcon size={14} />}
                  disabled={pushing}
                  onClick={handlePush}
                >
                  {pushing ? 'Pushing…' : `Push ${gitAhead} commit${gitAhead === 1 ? '' : 's'}`}
                </Button>
              </>
            ) : (
              <>
                <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>No changed files.</p>
                {syncError && (
                  <Alert surface="chalkboard" dismissible onDismiss={() => setSyncError(null)}>
                    {syncError}
                  </Alert>
                )}
                {pullError && (
                  <Alert surface="chalkboard" dismissible onDismiss={() => setPullError(null)}>
                    {pullError}
                  </Alert>
                )}
                <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
                  <Tooltip
                    content={
                      gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined
                    }
                    surface="chalkboard"
                  >
                    <Button
                      surface="chalkboard"
                      size="small"
                      icon={<MergeIcon size={14} />}
                      disabled={syncing || gitBranchHygiene === 'clean-on-main'}
                      onClick={handleSync}
                    >
                      {syncing ? 'Syncing…' : 'Sync to main'}
                    </Button>
                  </Tooltip>
                  {/* Distinct from Sync: fast-forwards the current branch in place,
                      so it stays enabled on clean main (where Sync is a no-op) to
                      pull down origin/main. */}
                  <Button
                    surface="chalkboard"
                    size="small"
                    icon={<PullIcon size={14} />}
                    disabled={pulling}
                    onClick={handlePull}
                  >
                    {pulling ? 'Pulling…' : 'Pull'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
