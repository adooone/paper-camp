import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { Sheet } from '../ui/sheet';
import { Stamp } from '../ui/stamp';
import type { ProjectSwitcherItem } from './project-items';
import styles from './project-switcher.module.css';

interface ProjectSwitcherProps {
  visible: boolean;
  onRequestClose: () => void;
  items: ProjectSwitcherItem[];
  currentId: string | null;
  singleMachineName?: string | null;
  onSelect: (item: ProjectSwitcherItem) => void;
  onAddMachine: () => void;
}

const runningFirst = (a: ProjectSwitcherItem, b: ProjectSwitcherItem): number =>
  Number(b.stamp?.meaning === 'running') - Number(a.stamp?.meaning === 'running');

export function ProjectSwitcher({
  visible,
  onRequestClose,
  items,
  currentId,
  singleMachineName = null,
  onSelect,
  onAddMachine,
}: ProjectSwitcherProps) {
  const sorted = [...items].sort(runningFirst);
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} label="Switch project">
      <Hand size="xl" bold>
        {singleMachineName ? `Switch project · ${singleMachineName}` : 'Switch project'}
      </Hand>
      <div className={styles.list}>
        {sorted.length === 0 ? (
          <div className={styles.empty}>
            <Hand size="md" color="inkSoft">
              No projects paired yet.
            </Hand>
          </div>
        ) : (
          sorted.map((item) => {
            const active = item.id === currentId;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect(item);
                  onRequestClose();
                }}
                className={styles.row}
              >
                <span className={styles.rowMain}>
                  <Hand size="lg" bold>
                    {item.projectName}
                  </Hand>
                  {singleMachineName ? null : (
                    <Hand size="sm" color="inkSoft">
                      {item.machineName}
                    </Hand>
                  )}
                </span>
                <span className={styles.rowSide}>
                  {item.stamp ? (
                    <Stamp meaning={item.stamp.meaning}>{item.stamp.label}</Stamp>
                  ) : null}
                  {active ? (
                    <Hand size="lg" bold>
                      ✓
                    </Hand>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className={styles.footer}>
        <Button
          label="+ Add a machine"
          variant="secondary"
          onPress={() => {
            onRequestClose();
            onAddMachine();
          }}
        />
      </div>
    </Sheet>
  );
}
