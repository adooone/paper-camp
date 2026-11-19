import { ListRow } from './list';
import styles from './skeleton-rows.module.css';

interface SkeletonRowsProps {
  count?: number;
}

// folk-ui's Skeleton is a shimmering bar; the phone's loading state is faded empty list rows.
export function SkeletonRows({ count = 3 }: SkeletonRowsProps) {
  return (
    <div role="progressbar" aria-label="Loading" className={styles.root}>
      {Array.from({ length: count }, (_, index) => `skeleton-${index}`).map((key) => (
        <ListRow
          key={key}
          title={<span className={`${styles.bar} ${styles.titleBar}`} />}
          detail={<span className={`${styles.bar} ${styles.detailBar}`} />}
        />
      ))}
    </div>
  );
}
