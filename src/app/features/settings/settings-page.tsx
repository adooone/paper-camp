import { PageTitle } from '@/app/components/page-title';
import { useActiveSettingsSection, useProjectIdentity } from '@/app/hooks';
import { fetchConfig, saveConfig, uploadIcon } from '@/app/services/system';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import {
  AGENT_IDS,
  AGENT_LABELS,
  AGENT_OPTIONS,
  type AgentConfig,
  type AgentId,
  DEFAULT_AGENTS,
  type DefaultAgentsMap,
  type PaperCampConfig,
} from '@/types/index';
import { Alert, Button, Card, Divider, Input, Select, Stamp, useToast } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';
import { SubjectsSection } from './components/subjects-section';

const TASK_TYPE_KEYS = ['phase', 'planDraft', 'ideaExtend', 'commitSuggest'] as const;
type TaskTypeKey = (typeof TASK_TYPE_KEYS)[number];

const TASK_TYPE_LABELS: Record<TaskTypeKey, string> = {
  phase: 'Phase run',
  planDraft: 'Plan draft',
  ideaExtend: 'Idea extend',
  commitSuggest: 'Commit suggest',
};

interface AgentTaskRowProps {
  taskKey: TaskTypeKey;
  agentConfig: AgentConfig;
  isLast: boolean;
  onSave: (key: TaskTypeKey, config: AgentConfig) => Promise<void>;
}

const TASK_COLUMN_WIDTH = 110;
const AGENT_COLUMN_WIDTH = 140;
const MODEL_COLUMN_WIDTH = 160;
const EFFORT_COLUMN_WIDTH = 110;

const AgentTaskRowHeader = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: space[3],
      paddingBottom: space[1],
    }}
  >
    <span style={{ width: TASK_COLUMN_WIDTH, flexShrink: 0, fontSize: fontSize.sm, opacity: 0.45 }}>
      Task
    </span>
    <span
      style={{ width: AGENT_COLUMN_WIDTH, flexShrink: 0, fontSize: fontSize.sm, opacity: 0.45 }}
    >
      Agent
    </span>
    <span
      style={{ width: MODEL_COLUMN_WIDTH, flexShrink: 0, fontSize: fontSize.sm, opacity: 0.45 }}
    >
      Model
    </span>
    <span
      style={{ width: EFFORT_COLUMN_WIDTH, flexShrink: 0, fontSize: fontSize.sm, opacity: 0.45 }}
    >
      Effort
    </span>
  </div>
);

const AgentTaskRow = ({ taskKey, agentConfig, isLast, onSave }: AgentTaskRowProps) => {
  // Fall back if the config carries an unknown agent id — never white-screen the page.
  const opts = AGENT_OPTIONS[agentConfig.agent] ?? AGENT_OPTIONS['claude-code'];
  const modelOpts = opts.model;
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
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
          paddingBottom: space[2],
          paddingTop: space[2],
        }}
      >
        <span
          style={{ width: TASK_COLUMN_WIDTH, flexShrink: 0, fontSize: fontSize.sm, opacity: 0.65 }}
        >
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
              { value: '', label: 'Default' },
              ...modelOpts.map((m) => ({ value: m, label: m })),
            ]}
          />
        ) : modelOpts === null ? (
          <Input
            size="small"
            style={{ width: MODEL_COLUMN_WIDTH }}
            value={localModel}
            placeholder="Default model"
            onChange={(e) => setLocalModel(e.target.value)}
            onBlur={handleModelInputBlur}
          />
        ) : null}
        {/* Reserve the effort slot even when the agent has no effort options, so
            switching agents doesn't change the control count and shift the row. */}
        <div style={{ visibility: Array.isArray(effortOpts) ? 'visible' : 'hidden' }}>
          <Select
            size="small"
            width={EFFORT_COLUMN_WIDTH}
            value={agentConfig.effort ?? ''}
            onChange={handleEffortChange}
            options={[
              { value: '', label: 'Default' },
              ...(Array.isArray(effortOpts) ? effortOpts : []).map((e) => ({ value: e, label: e })),
            ]}
          />
        </div>
      </div>
      {!isLast && <Divider />}
    </>
  );
};

const GeneralSection = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const { iconDataUri: fetchedIconDataUri, loading: identityLoading } = useProjectIdentity();
  const [uploadedIconDataUri, setUploadedIconDataUri] = useState<string | null>(null);
  const iconDataUri = uploadedIconDataUri ?? fetchedIconDataUri;
  const [uploading, setUploading] = useState(false);
  const [portInput, setPortInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig().then((c) => {
      setConfig(c);
      if (c?.port !== undefined) setPortInput(String(c.port));
      if (c?.projectName !== undefined) setNameInput(c.projectName);
    });
  }, []);

  const handleSaveAgentConfig = async (key: TaskTypeKey, newEntry: AgentConfig) => {
    const current = config?.defaultAgents;
    const updated: DefaultAgentsMap = {
      phase: current?.phase ?? DEFAULT_AGENTS.phase,
      planDraft: current?.planDraft ?? DEFAULT_AGENTS.planDraft,
      ideaExtend: current?.ideaExtend ?? DEFAULT_AGENTS.ideaExtend,
      commitSuggest: current?.commitSuggest ?? DEFAULT_AGENTS.commitSuggest,
      [key]: newEntry,
    };
    const { ok, error } = await saveConfig({ defaultAgents: updated });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, defaultAgents: updated } : prev));
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleSavePort = async () => {
    const port = Number(portInput);
    if (!config || !Number.isInteger(port) || port <= 0 || port === config.port) return;
    const { ok, error } = await saveConfig({ port });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, port } : prev));
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleSaveName = async () => {
    const projectName = nameInput.trim();
    if (!config || !projectName || projectName === config.projectName) return;
    const { ok, error } = await saveConfig({ projectName });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, projectName } : prev));
      setNameInput(projectName);
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      const ok = await uploadIcon(dataUri);
      setUploading(false);
      if (ok) {
        setUploadedIconDataUri(dataUri);
        toast({ title: 'Saved', variant: 'success' });
      } else {
        toast({ title: 'Failed to save', variant: 'error' });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ marginBottom: space[6] }}>
        <h2 style={{ margin: 0 }}>Project Info</h2>
      </div>
      {config === undefined && <p>Loading…</p>}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <Card size="small">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              paddingBottom: space[3],
            }}
          >
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              label="Project Name"
            />
            <Stamp
              size="small"
              fillColor="rgba(143, 185, 150, 0.25)"
              textColor={color.accentGreenDark}
            >
              v{config.version}
            </Stamp>
          </div>
          <Divider />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              paddingBottom: space[3],
              paddingTop: space[3],
            }}
          >
            {iconDataUri && (
              <img
                src={iconDataUri}
                alt="Project icon"
                style={{
                  width: 40,
                  height: 40,
                  objectFit: 'contain',
                  flexShrink: 0,
                  borderRadius: 4,
                }}
              />
            )}
            <div>
              {/* paper-ui has no file-input component, so this raw input is intentional */}
              <input
                ref={fileRef}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <Button
                variant="secondary"
                size="small"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Choose File'}
              </Button>
              {identityLoading && (
                <p className="text-sm" style={{ opacity: 0.5, margin: `${space[1]} 0 0` }}>
                  Loading…
                </p>
              )}
              {!identityLoading && !iconDataUri && !uploading && (
                <p className="text-sm" style={{ opacity: 0.45, margin: `${space[1]} 0 0` }}>
                  No icon set.
                </p>
              )}
            </div>
          </div>
          <Divider />

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              paddingBottom: space[3],
              paddingTop: space[3],
            }}
          >
            <Input
              type="number"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              onBlur={handleSavePort}
              label="Port"
              helperText="Default for `paper-camp dev`. Does not affect the running server."
            />
          </div>
          <Divider />

          <AgentTaskRowHeader />
          {TASK_TYPE_KEYS.map((key, idx) => (
            <AgentTaskRow
              key={key}
              taskKey={key}
              agentConfig={config.defaultAgents?.[key] ?? DEFAULT_AGENTS[key]}
              isLast={idx === TASK_TYPE_KEYS.length - 1}
              onSave={handleSaveAgentConfig}
            />
          ))}
        </Card>
      )}

      <p style={{ opacity: 0.45, fontSize: fontSize.sm, marginTop: space[4] }}>
        <strong>Initialized:</strong>{' '}
        {config ? new Date(config.initializedAt).toLocaleString() : '—'}
      </p>
    </div>
  );
};

export const SettingsPage = () => {
  const section = useActiveSettingsSection();
  return (
    <div>
      <PageTitle>Settings</PageTitle>
      {section === 'subjects' ? <SubjectsSection /> : <GeneralSection />}
    </div>
  );
};
