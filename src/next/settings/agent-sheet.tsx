import { useState } from 'react';
import {
  AGENT_IDS,
  AGENT_LABELS,
  AGENT_OPTIONS,
  type AgentConfig,
  type AgentId,
  type DefaultAgentKey,
} from '@/types/index';
import { AGENT_ROLE_LABELS, switchAgent } from '../shell/settings-model';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { Sheet } from '../ui/sheet';
import styles from './settings.module.css';

interface ChoiceGroupProps {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string | undefined;
  onChange: (next: string) => void;
}

function ChoiceGroup({ label, options, value, onChange }: ChoiceGroupProps) {
  return (
    <div className={styles.choiceGroup}>
      <Hand size="xs" bold color="inkSoft" className={styles.choiceLabel}>
        {label}
      </Hand>
      <div className={styles.chips}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={option.value === value ? `${styles.chip} ${styles.chipActive}` : styles.chip}
          >
            <Hand size="sm" bold>
              {option.label}
            </Hand>
          </button>
        ))}
      </div>
    </div>
  );
}

interface AgentFormProps {
  role: DefaultAgentKey;
  initial: AgentConfig;
  onSave: (next: AgentConfig) => Promise<string | null>;
  onClose: () => void;
}

const plain = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

function AgentForm({ role, initial, onSave, onClose }: AgentFormProps) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { model: models, effort: efforts } = AGENT_OPTIONS[draft.agent];

  const save = async () => {
    setSaving(true);
    setError(null);
    const failure = await onSave(draft);
    setSaving(false);
    if (failure) setError(failure);
  };

  return (
    <div className={styles.sheetBody}>
      <Hand size="xl" bold>
        {AGENT_ROLE_LABELS[role].title}
      </Hand>
      <Hand size="sm" color="inkSoft">
        {AGENT_ROLE_LABELS[role].detail}
      </Hand>
      <ChoiceGroup
        label="Agent"
        options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
        value={draft.agent}
        onChange={(id) => setDraft(switchAgent(draft, id as AgentId))}
      />
      {models ? (
        <ChoiceGroup
          label="Model"
          options={plain(models)}
          value={draft.model}
          onChange={(model) => setDraft({ ...draft, model })}
        />
      ) : null}
      {efforts ? (
        <ChoiceGroup
          label="Effort"
          options={plain(efforts)}
          value={draft.effort}
          onChange={(effort) => setDraft({ ...draft, effort })}
        />
      ) : null}
      {error ? (
        <Hand size="sm" color="danger" className={styles.error}>
          {error}
        </Hand>
      ) : null}
      <div className={styles.sheetActions}>
        <Button label="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
        <Button label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving} />
      </div>
    </div>
  );
}

interface AgentSheetProps {
  role: DefaultAgentKey | null;
  agent: AgentConfig | null;
  onSave: (role: DefaultAgentKey, next: AgentConfig) => Promise<string | null>;
  onClose: () => void;
}

export function AgentSheet({ role, agent, onSave, onClose }: AgentSheetProps) {
  return (
    <Sheet visible={role !== null} onRequestClose={onClose} label="Change the agent">
      {role && agent ? (
        <AgentForm
          key={role}
          role={role}
          initial={agent}
          onSave={async (next) => {
            const failure = await onSave(role, next);
            if (!failure) onClose();
            return failure;
          }}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}
