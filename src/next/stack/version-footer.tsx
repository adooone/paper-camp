import { versionLabel } from '@/app/components/stack-panel/version-footer';
import { useCapabilities } from '@/app/hooks';
import { CLIENT_VERSION } from '@/app/services/version';
import styles from './stack.module.css';

export function VersionFooter() {
  const { runtimeVersion } = useCapabilities();
  return (
    <footer className={styles.foot}>
      <span className={styles.mono}>{versionLabel(runtimeVersion, CLIENT_VERSION)}</span>
    </footer>
  );
}
