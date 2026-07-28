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
import type { BranchHygieneStatus, GitStatusEntry, PlanEntry } from '@/types/index';
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
import { deskChalk, deskTextMuted, gitErrorSummary, sectionLabelStyle } from './shared';

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

function writeStoredCommitField(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall back to in-memory only
  }
}

function deriveSuggestedCommit(plan: PlanEntry | undefined): { title: string; message: string } {
  if (!plan) return { title: '', message: '' };
  // Scope is a subsystem area, not the plan id (AGENTS.md: plan's primary tag); plan id goes in Refs: footer.
  const scope = plan.tags?.find((t) => COMMIT_SCOPES.includes(t)) ?? 'repo';
  const kind = plan.kind ?? 'feat';
  const allDone = Boolean(plan.phases.length) && plan.phases.every((phase) => phase.done);
  const title = allDone ? `${kind}(${scope}): updates` : `${kind}(${scope}): ${plan.title}`;
  const refs = plan.id ? `Refs: ${plan.id}` : '';
  const phaseBody =
    !allDone && plan.phases.length ? plan.phases.map((phase) => `- ${phase.text}`).join('\n') : '';
  return { title, message: [phaseBody, refs].filter(Boolean).join('\n\n') };
}

function useSelectedFiles(gitStatus: GitStatusEntry[] | null) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
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
        if (!known.has(entry.path) || prev.has(entry.path)) next.add(entry.path);
      }
      return next;
    });
  }, [gitStatus]);

  const onToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return { selectedFiles, onToggleFile };
}

const CommitFileList = ({
  gitStatus,
  expanded,
  onToggleExpanded,
  selectedFiles,
  onToggleFile,
}: {
  gitStatus: GitStatusEntry[];
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
}) => (
  <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
    <Accordion
      title={`${gitStatus.length} file${gitStatus.length === 1 ? '' : 's'} changed`}
      expanded={expanded}
      onToggle={onToggleExpanded}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: space[2], paddingTop: space[2] }}
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
              onChange={() => onToggleFile(entry.path)}
              style={{ accentColor: deskChalk }}
            />
            <span style={{ color: entry.staged ? deskChalk : deskTextMuted, minWidth: 24 }}>
              {entry.status}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.path}
            </span>
          </label>
        ))}
      </div>
    </Accordion>
  </div>
);

const CommitForm = ({
  selectedFiles,
  onCommitted,
}: { selectedFiles: Set<string>; onCommitted: () => void }) => {
  const plans = useAppStore((s) => s.plans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);
  const { toast } = useToast();

  const [commitTitle, setCommitTitle] = useState(() =>
    readStoredCommitField(COMMIT_TITLE_STORAGE_KEY),
  );
  const [commitMessage, setCommitMessage] = useState(() =>
    readStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY),
  );
  const [committing, setCommitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);
  const { title: suggestedTitle, message: suggestedMessage } = useMemo(
    () => deriveSuggestedCommit(activePlan),
    [activePlan],
  );

  useEffect(() => {
    if (suggestedTitle && !commitTitle) setCommitTitle(suggestedTitle);
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
    if (suggestedMessage && !commitMessage) setCommitMessage(suggestedMessage);
  }, [suggestedMessage, commitMessage]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_TITLE_STORAGE_KEY, commitTitle);
  }, [commitTitle]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY, commitMessage);
  }, [commitMessage]);

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
      onCommitted();
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
    onCommitted,
    toast,
  ]);

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
        disabled={selectedFiles.size === 0 || !commitTitle.trim() || committing || commitInFlight}
        onClick={handleCommit}
      >
        {committing || commitInFlight ? 'Committing…' : 'Commit'}
      </Button>
    </>
  );
};

// Shared by push/sync/pull below: run an action, flag it busy meanwhile, and
// toast a one-line summary if it throws — the only thing the three differ on.
function useTrackedAction(failTitle: string) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const run = useCallback(
    async (action: () => Promise<void>) => {
      setRunning(true);
      try {
        await action();
      } catch (err) {
        toast({
          title: failTitle,
          description: gitErrorSummary((err as Error).message),
          variant: 'error',
        });
      } finally {
        setRunning(false);
      }
    },
    [toast, failTitle],
  );
  return [running, run] as const;
}

function useBranchSync() {
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  // Sync/pull can bring upstream commits, so refresh plans/ideas too — git-status alone would leave them stale.
  const refreshAfterUpstream = () => Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);

  const [pushing, runPush] = useTrackedAction('Push failed');
  const [syncing, runSync] = useTrackedAction('Sync failed');
  const [pulling, runPull] = useTrackedAction('Pull failed');

  const handlePush = () =>
    runPush(async () => {
      await pushChanges();
      await loadGitStatus();
    });
  const handleSync = () =>
    runSync(async () => {
      await syncToMain();
      await refreshAfterUpstream();
    });
  const handlePull = () =>
    runPull(async () => {
      await pullFromOrigin();
      await refreshAfterUpstream();
    });

  return { pushing, syncing, pulling, handlePush, handleSync, handlePull };
}

const StaleMergedSyncButton = () => {
  const { syncing, handleSync } = useBranchSync();
  return (
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
  );
};

const NoChangesActions = ({
  gitAhead,
  gitBranchHygiene,
}: { gitAhead: number; gitBranchHygiene: BranchHygieneStatus | null }) => {
  const { pushing, syncing, pulling, handlePush, handleSync, handlePull } = useBranchSync();

  if (gitAhead > 0) {
    return (
      <>
        <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
          All changes committed — {gitAhead} commit{gitAhead === 1 ? '' : 's'} ready to push.
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
    );
  }

  return (
    <>
      <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>No changed files.</p>
      <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
        <Tooltip
          content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined}
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
  );
};

export const CommitSection = () => {
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const { selectedFiles, onToggleFile } = useSelectedFiles(gitStatus);
  const [commitExpanded, setCommitExpanded] = useState(false);

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
            <CommitFileList
              gitStatus={gitStatus}
              expanded={commitExpanded}
              onToggleExpanded={() => setCommitExpanded(!commitExpanded)}
              selectedFiles={selectedFiles}
              onToggleFile={onToggleFile}
            />
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
                <StaleMergedSyncButton />
              ) : (
                <CommitForm
                  selectedFiles={selectedFiles}
                  onCommitted={() => setCommitExpanded(false)}
                />
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
            <NoChangesActions gitAhead={gitAhead} gitBranchHygiene={gitBranchHygiene} />
          </div>
        )}
      </Card>
    </div>
  );
};
