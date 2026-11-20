import { useState } from 'react';
import { bodyPreview } from '../shell/idea-model';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import styles from './idea.module.css';

export function BodyCard({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = body.trim();
  if (!text) {
    return (
      <KraftCard>
        <Hand size="base" color="inkSoft">
          No body.
        </Hand>
      </KraftCard>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
      className={styles.bodyButton}
    >
      <KraftCard className={styles.bodyCard}>
        <Hand size="base" className={styles.prose}>
          {bodyPreview(text, expanded)}
        </Hand>
        <Hand size="xs" color="inkFaint">
          {expanded ? 'Tap to collapse' : 'Tap to expand'}
        </Hand>
      </KraftCard>
    </button>
  );
}
