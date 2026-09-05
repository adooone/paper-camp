import { commitChanges, stagePath, suggestCommitMessage } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/app/utils/local-draft-store';
import type { AgentTaskState } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface CommitFormFile {
  path: string;
  staged: boolean;
}

interface CommitDraft {
  title: string;
  message: string;
}

interface CommitOutcome {
  // A file that must land in this commit alongside whatever's already
  // staged/listed — e.g. a plan's entity file after a phase gets recorded.
  extraPath?: string;
  onFailure?: () => Promise<void> | void;
}

export interface UseCommitFormOptions {
  formKey: string;
  suggestedTitle?: string;
  matchesSuggestionTask: (task: AgentTaskState) => boolean;
  beforeCommit?: (title: string) => Promise<CommitOutcome>;
}

// Module-level, not component state: must survive the unmount that happens when the
// user navigates away mid-suggestion, so its result is still recognized on return.
const lastClearedAt = new Map<string, number>();
const appliedSuggestionIds = new Map<string, Set<string>>();

const commitDraftKey = (formKey: string) => `commit-draft:${formKey}`;

// Commit mechanics shared by every commit form; plan-scoped extras (phase recording, Fix) wrap this.
export function useCommitForm(files: CommitFormFile[], options: UseCommitFormOptions) {
  const { formKey, suggestedTitle, matchesSuggestionTask, beforeCommit } = options;
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  // A commit leaves the changed-files list stale; nothing else refreshes it in-app —
  // the activity stream only watches the corpus, and window focus never fires here.
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);
  const { toast } = useToast();

  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestErrorKind, setSuggestErrorKind] = useState<'auth' | undefined>(undefined);

  const filePaths = useMemo(() => files.map((f) => f.path), [files]);
  const stagedCount = useMemo(() => files.filter((f) => f.staged).length, [files]);

  useEffect(() => {
    if (suggestedTitle && !commitTitle) setCommitTitle(suggestedTitle);
  }, [suggestedTitle, commitTitle]);

  const draftKey = commitDraftKey(formKey);

  useEffect(() => {
    const draft = readLocalDraft<CommitDraft>(draftKey);
    setCommitTitle(draft?.title ?? '');
    setCommitMessage(draft?.message ?? '');
  }, [draftKey]);

  useEffect(() => {
    if (!commitTitle && !commitMessage) return;
    writeLocalDraft<CommitDraft>(draftKey, { title: commitTitle, message: commitMessage });
  }, [draftKey, commitTitle, commitMessage]);

  useEffect(() => {
    const clearedAt = lastClearedAt.get(formKey) ?? Date.now();
    lastClearedAt.set(formKey, clearedAt);
    const applied = appliedSuggestionIds.get(formKey) ?? new Set<string>();
    const task = agentStatus.find(
      (t) =>
        matchesSuggestionTask(t) &&
        t.suggestedCommit &&
        !applied.has(t.id) &&
        (t.lastStreamAt ?? 0) > clearedAt,
    );
    if (!task?.suggestedCommit) return;
    applied.add(task.id);
    appliedSuggestionIds.set(formKey, applied);
    setCommitTitle(task.suggestedCommit.title);
    setCommitMessage(task.suggestedCommit.message);
  }, [agentStatus, formKey, matchesSuggestionTask]);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim() || commitInFlight) return;
    setCommitting(true);
    setCommitInFlight(true);
    let onFailure: (() => Promise<void> | void) | undefined;
    try {
      const outcome = beforeCommit ? await beforeCommit(commitTitle.trim()) : undefined;
      onFailure = outcome?.onFailure;
      const extraPath = outcome?.extraPath;
      if (stagedCount > 0) {
        // Committing the index respects a partially-staged file's split, so an
        // extra file can't ride along in the pathspec — stage it explicitly instead.
        if (extraPath) await stagePath(extraPath);
        await commitChanges([], commitTitle.trim(), commitMessage.trim() || undefined);
      } else {
        const commitFiles =
          extraPath && !filePaths.includes(extraPath) ? [...filePaths, extraPath] : filePaths;
        await commitChanges(commitFiles, commitTitle.trim(), commitMessage.trim() || undefined);
      }
      setCommitTitle('');
      setCommitMessage('');
      lastClearedAt.set(formKey, Date.now());
      removeLocalDraft(draftKey);
      await Promise.all([loadGitStatus(), loadDiffFiles()]);
    } catch (err) {
      if (onFailure) await onFailure();
      toast({
        title: 'Commit failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
      await Promise.all([loadGitStatus(), loadDiffFiles()]);
    } finally {
      setCommitting(false);
      setCommitInFlight(false);
    }
  }, [
    commitTitle,
    commitMessage,
    filePaths,
    stagedCount,
    loadGitStatus,
    loadDiffFiles,
    commitInFlight,
    setCommitInFlight,
    toast,
    formKey,
    draftKey,
    beforeCommit,
  ]);

  const clearSuggestError = useCallback(() => {
    setSuggestError(null);
    setSuggestErrorKind(undefined);
  }, []);

  const handleSuggestFromChanges = useCallback(async () => {
    if (filePaths.length === 0) return;
    setSuggesting(true);
    clearSuggestError();
    try {
      const result = await suggestCommitMessage(filePaths);
      setCommitTitle(result.title);
      setCommitMessage(result.message);
    } catch (err) {
      setSuggestError((err as Error).message);
      setSuggestErrorKind((err as { kind?: 'auth' }).kind);
    } finally {
      setSuggesting(false);
    }
  }, [filePaths, clearSuggestError]);

  return {
    commitTitle,
    setCommitTitle,
    commitMessage,
    setCommitMessage,
    committing,
    commitInFlight,
    stagedCount,
    suggesting,
    suggestError,
    suggestErrorKind,
    clearSuggestError,
    handleCommit,
    handleSuggestFromChanges,
  };
}

export type CommitFormState = ReturnType<typeof useCommitForm>;
