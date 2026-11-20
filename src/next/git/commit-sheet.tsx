import { useState } from 'react';
import type { GitStatusEntry } from '@/types/index';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { Sheet } from '../ui/sheet';
import styles from './git.module.css';

interface CommitSheetProps {
  visible: boolean;
  entries: GitStatusEntry[];
  onClose: () => void;
  suggest: (files: string[]) => Promise<{ title: string; message: string }>;
  commit: (files: string[], title: string, message: string) => Promise<string | null>;
}

function CommitForm({ entries, onClose, suggest, commit }: Omit<CommitSheetProps, 'visible'>) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'suggest' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const files = entries.map((entry) => entry.path);

  const onSuggest = async () => {
    setBusy('suggest');
    setError(null);
    try {
      const suggestion = await suggest(files);
      setTitle(suggestion.title);
      setMessage(suggestion.message ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The agent couldn't suggest a message.");
    } finally {
      setBusy(null);
    }
  };

  const onCommit = async () => {
    setBusy('commit');
    setError(null);
    const failure = await commit(files, title.trim(), message.trim());
    setBusy(null);
    if (failure) setError(failure);
  };

  return (
    <div className={styles.sheetBody}>
      <Hand size="xl" bold>
        Commit {entries.length} {entries.length === 1 ? 'change' : 'changes'}
      </Hand>
      <Hand size="sm" color="inkSoft">
        Everything in the working tree goes into one commit.
      </Hand>
      {/* folk-ui's Input is a sketched field; the phone's commit fields are plain stroked inputs. */}
      <input
        aria-label="Commit title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="type(scope): what changed"
        autoCapitalize="none"
        autoCorrect="off"
        disabled={busy !== null}
        className={`${styles.field} ${styles.mono}`}
      />
      {/* folk-ui's Textarea is a sketched field; the phone's commit body is a plain stroked area. */}
      <textarea
        aria-label="Commit message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Why, in a line or two (optional)"
        disabled={busy !== null}
        className={`${styles.field} ${styles.body}`}
      />
      {error ? (
        <Hand size="sm" color="danger">
          {error}
        </Hand>
      ) : null}
      <div className={styles.sheetActions}>
        <Button
          label={busy === 'suggest' ? 'Asking…' : 'Suggest'}
          variant="ghost"
          onPress={() => void onSuggest()}
          disabled={busy !== null}
        />
        <span className={styles.grow} />
        <Button label="Cancel" variant="ghost" onPress={onClose} disabled={busy !== null} />
        <Button
          label={busy === 'commit' ? 'Committing…' : 'Commit'}
          onPress={() => void onCommit()}
          disabled={busy !== null || title.trim().length === 0}
        />
      </div>
    </div>
  );
}

export function CommitSheet({ visible, ...form }: CommitSheetProps) {
  return (
    <Sheet visible={visible} onRequestClose={form.onClose} label="Commit changes">
      {visible ? <CommitForm {...form} /> : null}
    </Sheet>
  );
}
