import { useNavigate, useParams } from '@tanstack/react-router';
import { DocMarkdown } from '../docs/doc-markdown';
import { DocSheet } from '../docs/doc-sheet';
import styles from '../docs/docs.module.css';
import { useDocsScreen } from '../hooks/use-docs-screen';
import { BackHeader } from '../shell/back-header';
import { isMarkdownDoc } from '../shell/docs-model';
import { SCREEN_PATHS } from '../shell/screens';
import { EmptyState } from '../ui/empty-state';
import { SkeletonRows } from '../ui/skeleton-rows';

export const DocPage = () => {
  const { doc: name } = useParams({ strict: false }) as { doc?: string };
  const screen = useDocsScreen();
  const navigate = useNavigate();
  const file = screen.docs.find((candidate) => candidate.name === name);
  const toDocs = () => void navigate({ to: SCREEN_PATHS.docs });

  return (
    <div className={styles.page}>
      <BackHeader onBack={toDocs} label="Docs" />
      <div className={styles.content}>
        {screen.load === 'loading' ? <SkeletonRows /> : null}
        {screen.load === 'ready' && !file ? (
          <EmptyState
            title="Couldn't find this doc"
            line="It is no longer in the repository."
            actionLabel="Back to the docs"
            onAction={toDocs}
          />
        ) : null}
        {file ? (
          <DocSheet title={file.name}>
            {isMarkdownDoc(file.name) ? (
              <DocMarkdown>{file.content}</DocMarkdown>
            ) : (
              <pre className={styles.plain}>{file.content}</pre>
            )}
          </DocSheet>
        ) : null}
      </div>
    </div>
  );
};
