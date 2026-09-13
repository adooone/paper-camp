import {
  AGENT_IDS,
  AGENT_LABELS,
  AGENT_OPTIONS,
  type AgentConfig,
  type AgentId,
} from '@/types/index';
import { Card, Input, Select } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { TASK_TYPE_LABELS, type TaskTypeKey } from '../constants';
import { AGENT_TABLE_GRID_CLASS } from './agent-task-row-header';

const AGENT_COLUMN_WIDTH = 140;
const MODEL_COLUMN_WIDTH = 160;
const EFFORT_COLUMN_WIDTH = 110;

interface AgentTaskRowProps {
  taskKey: TaskTypeKey;
  agentConfig: AgentConfig;
  onSave: (key: TaskTypeKey, config: AgentConfig) => Promise<void>;
  // The code-authoring task's config — codeReview's model must never match it (IDEA-170).
  authorConfig?: AgentConfig;
}

export const AgentTaskRow = ({ taskKey, agentConfig, onSave, authorConfig }: AgentTaskRowProps) => {
  // Fall back if the config carries an unknown agent id — never white-screen the page.
  const opts = AGENT_OPTIONS[agentConfig.agent] ?? AGENT_OPTIONS['claude-code'];
  const excludedModel =
    authorConfig && authorConfig.agent === agentConfig.agent
      ? (authorConfig.model ?? '')
      : undefined;
  const modelOpts = Array.isArray(opts.model)
    ? opts.model.filter((m) => m !== excludedModel)
    : opts.model;
  const effortOpts = opts.effort;
  const [localModel, setLocalModel] = useState(agentConfig.model ?? '');

  useEffect(() => {
    setLocalModel(agentConfig.model ?? '');
  }, [agentConfig.model]);

  const handleAgentChange = (v: string) => {
    const newId = v as AgentId;
    const newOpts = AGENT_OPTIONS[newId];
    const newConfig: AgentConfig = { agent: newId };
    // Only carry the model over if the new agent accepts it — otherwise a claude
    // model like 'opus' would leak into opencode and fail at launch.
    if (
      agentConfig.model &&
      (newOpts.model === null || newOpts.model?.includes(agentConfig.model))
    ) {
      newConfig.model = agentConfig.model;
    }
    if (agentConfig.effort && Array.isArray(newOpts.effort)) newConfig.effort = agentConfig.effort;
    onSave(taskKey, newConfig);
  };

  const handleModelSelectChange = (v: string) => {
    onSave(taskKey, { ...agentConfig, model: v || undefined });
  };

  const handleModelInputBlur = () => {
    onSave(taskKey, { ...agentConfig, model: localModel || undefined });
  };

  const handleEffortChange = (v: string) => {
    onSave(taskKey, { ...agentConfig, effort: v || undefined });
  };

  return (
    <Card size="small" texture="kraft" className="plan-row-card">
      <div className="overflow-x-auto">
        <div className={AGENT_TABLE_GRID_CLASS}>
          <span className="text-sm opacity-[0.65] overflow-hidden text-ellipsis whitespace-nowrap">
            {TASK_TYPE_LABELS[taskKey]}
          </span>
          <Select
            size="small"
            width={AGENT_COLUMN_WIDTH}
            value={agentConfig.agent}
            onChange={handleAgentChange}
            options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
          />
          {Array.isArray(modelOpts) ? (
            <Select
              size="small"
              width={MODEL_COLUMN_WIDTH}
              value={agentConfig.model ?? ''}
              onChange={handleModelSelectChange}
              options={[
                ...(excludedModel === '' ? [] : [{ value: '', label: 'Default' }]),
                ...modelOpts.map((m) => ({ value: m, label: m })),
              ]}
            />
          ) : modelOpts === null ? (
            <Input
              size="small"
              className="w-[160px]"
              value={localModel}
              placeholder="Default model"
              onChange={(e) => setLocalModel(e.target.value)}
              onBlur={handleModelInputBlur}
            />
          ) : null}
          {/* Reserve the effort slot even when the agent has no effort options, so
              switching agents doesn't change the control count and shift the row. */}
          <div className={Array.isArray(effortOpts) ? 'visible' : 'invisible'}>
            <Select
              size="small"
              width={EFFORT_COLUMN_WIDTH}
              value={agentConfig.effort ?? ''}
              onChange={handleEffortChange}
              options={[
                { value: '', label: 'Default' },
                ...(Array.isArray(effortOpts) ? effortOpts : []).map((e) => ({
                  value: e,
                  label: e,
                })),
              ]}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
