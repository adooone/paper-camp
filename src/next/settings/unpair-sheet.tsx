import type { SettingsMachine } from '../hooks/use-settings-screen';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { Sheet } from '../ui/sheet';
import styles from './settings.module.css';

interface UnpairSheetProps {
  machine: SettingsMachine | null;
  onUnpair: (machine: SettingsMachine) => void;
  onClose: () => void;
}

export function UnpairSheet({ machine, onUnpair, onClose }: UnpairSheetProps) {
  return (
    <Sheet visible={machine !== null} onRequestClose={onClose} label="Unpair this machine">
      {machine ? (
        <div className={styles.sheetBody}>
          <Hand size="xl" bold>
            Unpair {machine.host}?
          </Hand>
          <Hand size="sm" color="inkSoft">
            This desk forgets the machine. Pair again from the daemon's link to get it back.
          </Hand>
          <div className={styles.sheetActions}>
            <Button label="Keep" variant="ghost" onPress={onClose} />
            <Button
              label="Unpair"
              onPress={() => {
                onUnpair(machine);
                onClose();
              }}
            />
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
