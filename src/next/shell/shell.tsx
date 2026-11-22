import { Outlet } from '@tanstack/react-router';
import { useShell } from '../hooks/use-shell';
import { useStackDock } from '../hooks/use-stack-dock';
import { StackPanel } from '../stack/stack-panel';
import { NavIsland } from '../ui/nav-island';
import { Paper } from '../ui/paper';
import { NAV_TABS } from './nav-tabs';
import { ProjectSwitcher } from './project-switcher';
import type { TabId } from './screens';
import styles from './shell.module.css';
import { TitleRow } from './title-row';

const isTab = (id: string): id is TabId => NAV_TABS.some((tab) => tab.id === id);

export function Shell() {
  const shell = useShell();
  const dock = useStackDock();
  const island = (
    <NavIsland
      tabs={NAV_TABS}
      current={shell.tab}
      onSelect={(id) => isTab(id) && shell.selectTab(id)}
      docked={!shell.wide}
    />
  );
  return (
    <Paper className={styles.root}>
      <div className={styles.frame}>
        <TitleRow
          title={shell.title}
          projectName={shell.projectName ?? undefined}
          onOpenSwitcher={shell.openSwitcher}
          stamp={shell.stamp}
          island={shell.wide ? island : undefined}
        />
        <main className={shell.split && shell.wide ? styles.bodySplit : styles.body}>
          <Outlet />
        </main>
      </div>
      {shell.wide ? null : island}
      <StackPanel dock={dock} />
      <ProjectSwitcher
        visible={shell.switcherOpen}
        onRequestClose={shell.closeSwitcher}
        items={shell.switcher.items}
        currentId={shell.switcher.currentId}
        singleMachineName={shell.switcher.singleMachineName}
        onSelect={shell.switcher.select}
        onAddMachine={shell.addMachine}
      />
    </Paper>
  );
}
