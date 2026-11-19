import { CLASSIC_DESK_PATH, deskUrl } from '@/app/services/desk-links';
import { mountPrefix } from '@/app/services/mount';
import { getRuntimeConnection } from '@/app/services/runtime-connection';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { Paper } from '../ui/paper';
import styles from './settings-page.module.css';

const openClassicDesk = () =>
  window.location.assign(deskUrl(CLASSIC_DESK_PATH, mountPrefix, getRuntimeConnection()));

export const SettingsPage = () => (
  <Paper>
    <div className={styles.page}>
      <Hand as="h1" font="display" size="2xl">
        Settings
      </Hand>
      <Button label="Back to the classic desk" variant="secondary" onPress={openClassicDesk} />
    </div>
  </Paper>
);
