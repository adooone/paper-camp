import { InlineSelect } from '@/app/components';
import {
  AGENT_IDS,
  AGENT_LABELS,
  AGENT_OPTIONS,
  type AgentConfig,
  type AgentId,
  DEFAULT_AGENTS,
  DEFAULT_AGENT_KEYS,
  type DefaultAgentKey,
  type DefaultAgentsMap,
} from '@/types/index';
import { Input, Table } from '@dendelion/folk-ui';
import { useEffect, useState } from 'react';
import { TASK_TYPE_LABELS } from '../constants';

interface AgentTaskTableRow {
  taskKey: DefaultAgentKey;
  agentConfig: AgentConfig;
  // The code-authoring group's config — chat reviews PRs, so its model must never match it (IDEA-170).
  authorConfig?: AgentConfig;
}

type OnSaveAgentConfig = (key: DefaultAgentKey, config: AgentConfig) => Promise<void>;

interface AgentTaskTableProps {
  defaultAgents: DefaultAgentsMap | undefined;
  onSave: OnSaveAgentConfig;
}

const AgentCell = ({ row, onSave }: { row: AgentTaskTableRow; onSave: OnSaveAgentConfig }) => {
  const handleAgentChange = (v: string) => {
    const newId = v as AgentId;
    const newOpts = AGENT_OPTIONS[newId];
    const newConfig: AgentConfig = { agent: newId };
    // Only carry the model over if the new agent accepts it — otherwise a claude
    // model like 'opus' would leak into opencode and fail at launch.
    if (
      row.agentConfig.model &&
      (newOpts.model === null || newOpts.model?.includes(row.agentConfig.model))
    ) {
      newConfig.model = row.agentConfig.model;
    }
    if (row.agentConfig.effort && Array.isArray(newOpts.effort)) {
      newConfig.effort = row.agentConfig.effort;
    }
    onSave(row.taskKey, newConfig);
  };

  return (
    <InlineSelect
      ariaLabel={`Agent for ${TASK_TYPE_LABELS[row.taskKey].label}`}
      value={row.agentConfig.agent}
      onChange={handleAgentChange}
      options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
    />
  );
};

const ModelCell = ({ row, onSave }: { row: AgentTaskTableRow; onSave: OnSaveAgentConfig }) => {
  // Fall back if the config carries an unknown agent id — never white-screen the page.
  const opts = AGENT_OPTIONS[row.agentConfig.agent] ?? AGENT_OPTIONS['claude-code'];
  const excludedModel =
    row.authorConfig && row.authorConfig.agent === row.agentConfig.agent
      ? (row.authorConfig.model ?? '')
      : undefined;
  const modelOpts = Array.isArray(opts.model)
    ? opts.model.filter((m) => m !== excludedModel)
    : opts.model;
  const [localModel, setLocalModel] = useState(row.agentConfig.model ?? '');

  useEffect(() => {
    setLocalModel(row.agentConfig.model ?? '');
  }, [row.agentConfig.model]);

  if (Array.isArray(modelOpts)) {
    return (
      <InlineSelect
        ariaLabel={`Model for ${TASK_TYPE_LABELS[row.taskKey].label}`}
        value={row.agentConfig.model ?? ''}
        onChange={(v) => onSave(row.taskKey, { ...row.agentConfig, model: v || undefined })}
        options={[
          ...(excludedModel === '' ? [] : [{ value: '', label: 'Default' }]),
          ...modelOpts.map((m) => ({ value: m, label: m })),
        ]}
      />
    );
  }

  if (modelOpts === null) {
    return (
      <Input
        size="small"
        value={localModel}
        placeholder="Default model"
        onChange={(e) => setLocalModel(e.target.value)}
        onBlur={() => onSave(row.taskKey, { ...row.agentConfig, model: localModel || undefined })}
      />
    );
  }

  return null;
};

const EffortCell = ({ row, onSave }: { row: AgentTaskTableRow; onSave: OnSaveAgentConfig }) => {
  const opts = AGENT_OPTIONS[row.agentConfig.agent] ?? AGENT_OPTIONS['claude-code'];
  const effortOpts = opts.effort;
  if (!Array.isArray(effortOpts)) return null;

  return (
    <InlineSelect
      ariaLabel={`Effort for ${TASK_TYPE_LABELS[row.taskKey].label}`}
      value={row.agentConfig.effort ?? ''}
      onChange={(v) => onSave(row.taskKey, { ...row.agentConfig, effort: v || undefined })}
      options={[
        { value: '', label: 'Default' },
        ...effortOpts.map((e) => ({ value: e, label: e })),
      ]}
    />
  );
};

export const AgentTaskTable = ({ defaultAgents, onSave }: AgentTaskTableProps) => {
  const rows: AgentTaskTableRow[] = DEFAULT_AGENT_KEYS.map((taskKey) => ({
    taskKey,
    agentConfig: defaultAgents?.[taskKey] ?? DEFAULT_AGENTS[taskKey],
    authorConfig: taskKey === 'chat' ? (defaultAgents?.build ?? DEFAULT_AGENTS.build) : undefined,
  }));

  return (
    <Table
      data={rows}
      rowKey={(row) => row.taskKey}
      density="compact"
      columns={[
        {
          key: 'task',
          header: 'Task',
          cell: (row) => (
            <span className="flex flex-col">
              <span className="text-sm opacity-[0.65]">{TASK_TYPE_LABELS[row.taskKey].label}</span>
              <span className="text-xs opacity-[0.45]">{TASK_TYPE_LABELS[row.taskKey].detail}</span>
            </span>
          ),
        },
        {
          key: 'agent',
          width: 'auto',
          header: 'Agent',
          cell: (row) => <AgentCell row={row} onSave={onSave} />,
        },
        {
          key: 'model',
          width: 'auto',
          header: 'Model',
          cell: (row) => <ModelCell row={row} onSave={onSave} />,
        },
        {
          key: 'effort',
          width: 'auto',
          header: 'Effort',
          cell: (row) => <EffortCell row={row} onSave={onSave} />,
        },
      ]}
    />
  );
};
