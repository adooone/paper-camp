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
  useToast,
} from '@dendelion/paper-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MergeIcon, PullIcon, PushIcon, WandIcon } from '../icons';
import { deskChalk, deskTextMuted, sectionLabelStyle } from './shared';

const COMMIT_TITLE_STORAGE_KEY = 'papercamp.commitTitle';
const COMMIT_MESSAGE_STORAGE_KEY = 'papercamp.commitMessage';

// Keep in sync with .commitlintrc.json's `scope-enum` (release/main are release-bot-only, excluded here).
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

// Git failures arrive as multi-line output ("To github…\n ! [rejected]…\nhint:…");
// a toast wants the one line that states the problem.
function gitErrorSummary(message: string): string {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const marked = lines.find(
    (line) => line.startsWith('!') || line.startsWith('error:') || line.startsWith('fatal:'),
  );
  return marked ?? lines.at(-1) ?? message;
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
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const { toast } = useToast();

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);

  const suggestedScope = useMemo(() => {
    // Scope is a subsystem area, not the plan id (AGENTS.md: plan's primary tag); plan id goes in Refs: footer.
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

  // A fix-review's suggested commit wins over heuristics/diff suggestions (the agent
  // knows why each change was made); keyed by content so it applies once per run.
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
    // Snapshot ref before setState: mutating it inside the updater is unsafe under
    // StrictMode's double-invoke, which would empty the file list on the second pass.
    const known = knownPathsRef.current;
    knownPathsRef.current = new Set(gitStatus.map((e) => e.path));
    setSelectedFiles((prev) => {
      const next = new Set<string>();
      for (const entry of gitStatus) {
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
      toast({
        title: 'Commit failed',
        description: gitErrorSummary((err as Error).message),
        variant: 'error',
      });
      // A failed commit can leave stale "changed files" behind (e.g. nothing left to
      // commit), which would otherwise invite a doomed retry.
      await loadGitStatus();
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
    toast,
  ]);

  const handlePush = useCallback(async () => {
    setPushing(true);
    try {
      await pushChanges();
      await loadGitStatus();
    } catch (err) {
      toast({
        title: 'Push failed',
        description: gitErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setPushing(false);
    }
  }, [loadGitStatus, toast]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncToMain();
      // Sync can pull upstream commits, so refresh plans/ideas too — git-status alone would leave them stale.
      await Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);
    } catch (err) {
      toast({
        title: 'Sync failed',
        description: gitErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setSyncing(false);
    }
  }, [loadGitStatus, loadPlans, loadIdeas, toast]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    try {
      await pullFromOrigin();
      // Pull can also bring upstream entity changes, so refresh plans/ideas alongside git status.
      await Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);
    } catch (err) {
      toast({
        title: 'Pull failed',
        description: gitErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setPulling(false);
    }
  }, [loadGitStatus, loadPlans, loadIdeas, toast]);

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
                      {/* Raw checkbox: paper-ui's Checkbox has one label slot (can't fit this
                          multi-color mono layout) and its blob/sketch chrome would clash here. */}
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
                // stale-merged: committing here would strand work off main, so dirty
                // sync (stash → main → ff) replaces the commit controls.
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
                  {/* Pull fast-forwards in place, so unlike Sync it stays enabled on clean main. */}
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
