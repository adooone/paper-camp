import { CLIENT_VERSION } from '@/app/services/version';
import { Hand } from '../ui/hand';
import styles from './version-stamp.module.css';

interface VersionStampProps {
  onCheck?: () => void;
}

const reloadForUpdate = () => window.location.reload();

export function VersionStamp({ onCheck = reloadForUpdate }: VersionStampProps) {
  return (
    <button
      type="button"
      aria-label="Check for app updates"
      onClick={onCheck}
      className={styles.stamp}
    >
      <Hand size="sm" color="inkFaint">{`v${CLIENT_VERSION}`}</Hand>
      <Hand size="sm" color="inkFaint">
        check for updates
      </Hand>
    </button>
  );
}
