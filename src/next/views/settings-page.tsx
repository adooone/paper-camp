import { useState } from 'react';
import { HUB_DESK_PATH } from '@/app/services/desk-links';
import { CLIENT_VERSION } from '@/app/services/version';
import { type DefaultAgentKey, NOTIFICATION_SETTING_KINDS } from '@/types/index';
import { useSettingsScreen } from '../hooks/use-settings-screen';
import { AgentSheet } from '../settings/agent-sheet';
import { AppearanceSection } from '../settings/appearance-section';
import styles from '../settings/settings.module.css';
import { openDesk } from '../shell/open-desk';
import {
  AGENT_ROLE_LABELS,
  AGENT_ROLES,
  DESK_PAGES,
  daemonDetail,
  describeAgent,
  NOTIFICATION_KIND_LABELS,
  pushStamp,
} from '../shell/settings-model';
import { VersionStamp } from '../shell/version-stamp';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { ListLabel, ListRow } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';
import { Stamp } from '../ui/stamp';
import { Switch } from '../ui/switch';

const Chevron = ({ glyph = '›' }: { glyph?: string }) => (
  <Hand size="lg" color="inkFaint">
    {glyph}
  </Hand>
);

export const SettingsPage = () => {
  const screen = useSettingsScreen();
  const [editing, setEditing] = useState<DefaultAgentKey | null>(null);
  const label = screen.projectName ?? 'No project';
  const stamp = pushStamp(screen.permission);

  return (
    <div className={styles.page}>
      <AppearanceSection />

      <div className={styles.list}>
        <ListLabel trailing={<Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>}>
          Notifications · {label}
        </ListLabel>
        {screen.permission === 'denied' ? (
          <EmptyState
            title="Push is off"
            line="Allow notifications for Paper Camp in the browser's site settings to get them."
          />
        ) : null}
        {screen.load.status === 'loading' ? <SkeletonRows count={2} /> : null}
        {screen.load.status === 'error' ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              This project has no config yet.
            </Hand>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              onPress={() => void screen.reload()}
              className={styles.inline}
            />
          </div>
        ) : null}
        {screen.kinds
          ? NOTIFICATION_SETTING_KINDS.map((kind) => (
              <ListRow
                key={kind}
                title={NOTIFICATION_KIND_LABELS[kind].title}
                detail={NOTIFICATION_KIND_LABELS[kind].detail}
                trailing={
                  <Switch
                    value={screen.kinds?.[kind] ?? false}
                    label={NOTIFICATION_KIND_LABELS[kind].title}
                    disabled={screen.pendingKind !== null}
                    onChange={() => void screen.toggleKind(kind)}
                  />
                }
              />
            ))
          : null}
        {screen.saveError ? (
          <div className={styles.note}>
            <Hand size="sm" color="danger">
              {screen.saveError}
            </Hand>
          </div>
        ) : null}
      </div>

      {screen.agents ? (
        <div className={styles.list}>
          <ListLabel>Agents · {label}</ListLabel>
          {AGENT_ROLES.map((role) => (
            <ListRow
              key={role}
              title={AGENT_ROLE_LABELS[role].title}
              detail={describeAgent(screen.agents?.[role] ?? { agent: 'claude-code' })}
              trailing={<Chevron />}
              accessibilityLabel={`Change the ${AGENT_ROLE_LABELS[role].title} agent`}
              onPress={() => setEditing(role)}
            />
          ))}
        </div>
      ) : null}

      <div className={styles.list}>
        <ListLabel>Machines</ListLabel>
        {screen.machines.map((machine) => (
          <ListRow
            key={machine.url}
            title={machine.host}
            detail={daemonDetail(machine.version)}
            trailing={
              machine.pairedHere ? (
                <Button
                  label="Unpair"
                  variant="ghost"
                  size="sm"
                  onPress={() => screen.unpair(machine)}
                />
              ) : undefined
            }
          />
        ))}
        {screen.machines.length === 0 ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              No machines paired yet.
            </Hand>
          </div>
        ) : null}
        <Button
          label="+ Add a machine"
          variant="secondary"
          onPress={() => openDesk(HUB_DESK_PATH)}
        />
      </div>

      <div className={styles.list}>
        <ListLabel>Desk pages</ListLabel>
        {DESK_PAGES.map((page) => (
          <ListRow
            key={page.path}
            title={page.label}
            detail={page.detail}
            trailing={<Chevron glyph="↗" />}
            onPress={() => openDesk(page.path)}
          />
        ))}
      </div>

      <div className={styles.list}>
        <ListLabel>About</ListLabel>
        <ListRow title="Paper Camp desk" detail={`Version ${CLIENT_VERSION}`} />
        <VersionStamp />
      </div>

      <AgentSheet
        role={editing}
        agent={editing ? (screen.agents?.[editing] ?? null) : null}
        onSave={screen.saveAgent}
        onClose={() => setEditing(null)}
      />
    </div>
  );
};
