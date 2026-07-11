import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import {
  Accordion,
  Alert,
  Button,
  IconButton,
  Input,
  Modal,
  Stamp,
  Textarea,
  Tooltip,
} from '@dendelion/paper-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { findFocusPlan } from '../features/plans/helpers';
import { commitChanges, pushChanges, suggestCommitMessage, syncToMain } from '../services/git-api';
import { useAppStore } from '../stores/app-store';

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

const WandIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m12 3-1.6 4.85a2 2 0 0 1-1.27 1.27L4.27 10.7l4.86 1.6a2 2 0 0 1 1.27 1.27L12 18.4l1.6-4.86a2 2 0 0 1 1.27-1.27l4.86-1.6-4.86-1.6a2 2 0 0 1-1.27-1.27L12 3Z" />
    <path d="M19 3v3" />
    <path d="M20.5 4.5h-3" />
  </svg>
);

const PushIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

const MergeIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 9v5c0 .667 3 1 6 1s6-.333 6-1V9" />
    <path d="M12 17v2" />
  </svg>
);

interface CommitModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Commit form summoned from the header status cluster (IDEA-39): title,
 * message, file list, and the findFocusPlan-driven suggestion, previously
 * embedded in the Stack panel. Same store state and /api git calls as
 * before — only the mount point moved.
 */
export const CommitModal = ({ open, onClose }: CommitModalProps) => {
  const plans = useAppStore((s) => s.plans);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
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

  useEffect(() => {
    if (gitStatus) {
      setSelectedFiles(new Set(gitStatus.map((e) => e.path)));
    }
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
    if (!commitTitle.trim()) return;
    setCommitting(true);
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
    }
  }, [commitTitle, commitMessage, selectedFiles, suggestedTitle, loadGitStatus]);

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
      const isClean = gitStatus && gitStatus.length === 0;
      await syncToMain(isClean ? 'clean' : 'dirty');
      await loadGitStatus();
    } catch (err) {
      setSyncError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [gitStatus, loadGitStatus]);

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
    <Modal open={open} onClose={onClose} title="Commit" size="medium">
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginBottom: space[3] }}>
        {gitBranch && <Stamp size="small">{gitBranch}</Stamp>}
      </div>
      {gitStatus && gitStatus.length > 0 ? (
        <>
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
                maxHeight: 240,
                overflowY: 'auto',
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
                    fontSize: fontSize.xs,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(entry.path)}
                    onChange={() => handleToggleFile(entry.path)}
                  />
                  <span
                    style={{
                      color: entry.staged ? color.deskText : color.deskTextMuted,
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
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: space[3], marginTop: space[3] }}
          >
            {suggestError && (
              <Alert dismissible onDismiss={() => setSuggestError(null)}>
                {suggestError}
              </Alert>
            )}
            <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input
                  size="small"
                  placeholder="Commit title"
                  value={commitTitle}
                  onChange={(e) => setCommitTitle(e.currentTarget.value)}
                />
              </div>
              <IconButton
                icon={<WandIcon size={16} />}
                size="small"
                label="Suggest title and message from the diff"
                disabled={selectedFiles.size === 0 || suggesting}
                onClick={handleSuggestFromChanges}
                wobble={suggesting ? 1 : 0}
              />
            </div>
            <Textarea
              size="small"
              placeholder="Commit message (optional)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.currentTarget.value)}
              rows={3}
            />
            {commitError && (
              <Alert dismissible onDismiss={() => setCommitError(null)}>
                {commitError}
              </Alert>
            )}
            <Button
              size="small"
              fullWidth
              disabled={selectedFiles.size === 0 || !commitTitle.trim() || committing}
              onClick={handleCommit}
            >
              {committing ? 'Committing…' : 'Commit'}
            </Button>
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[3],
            padding: `${space[6]} 0`,
          }}
        >
          {gitAhead > 0 ? (
            <>
              <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
                All changes committed — {gitAhead} commit{gitAhead === 1 ? '' : 's'} ready to push.
              </p>
              {pushError && (
                <Alert dismissible onDismiss={() => setPushError(null)}>
                  {pushError}
                </Alert>
              )}
              <Button icon={<PushIcon size={14} />} disabled={pushing} onClick={handlePush}>
                {pushing ? 'Pushing…' : `Push ${gitAhead} commit${gitAhead === 1 ? '' : 's'}`}
              </Button>
            </>
          ) : (
            <>
              <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>No changed files.</p>
              {syncError && (
                <Alert dismissible onDismiss={() => setSyncError(null)}>
                  {syncError}
                </Alert>
              )}
              <Tooltip
                content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined}
              >
                <Button
                  icon={<MergeIcon size={14} />}
                  disabled={syncing || gitBranchHygiene === 'clean-on-main'}
                  onClick={handleSync}
                >
                  {syncing ? 'Syncing…' : 'Sync to main'}
                </Button>
              </Tooltip>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
