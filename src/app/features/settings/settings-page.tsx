import { PageTitle } from '@/app/components/page-title';
import { useProjectIdentity } from '@/app/hooks';
import { fetchConfig, saveConfig } from '@/app/services/config-api';
import { fetchConfigFile } from '@/app/services/configs-api';
import { fetchEnv, saveEnv } from '@/app/services/env-api';
import { uploadIcon } from '@/app/services/icon-api';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import {
  AGENT_IDS,
  AGENT_LABELS,
  type AgentId,
  DEFAULT_AGENTS,
  type EnvEntry,
  type PaperCampConfig,
} from '@/types/index';
import {
  Alert,
  Button,
  Card,
  CloseIcon,
  CodeBlock,
  IconButton,
  Input,
  Select,
  Stamp,
  Table,
} from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';

const GeneralSection = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const { iconDataUri: fetchedIconDataUri, loading: identityLoading } = useProjectIdentity();
  const [uploadedIconDataUri, setUploadedIconDataUri] = useState<string | null>(null);
  const iconDataUri = uploadedIconDataUri ?? fetchedIconDataUri;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [portInput, setPortInput] = useState('');
  const [portSaving, setPortSaving] = useState(false);
  const [portSaved, setPortSaved] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [agentSavedPhase, setAgentSavedPhase] = useState(false);
  const [agentSavedDraft, setAgentSavedDraft] = useState(false);
  const [agentSavedExtend, setAgentSavedExtend] = useState(false);
  const [agentSavedSuggest, setAgentSavedSuggest] = useState(false);

  useEffect(() => {
    fetchConfig().then((c) => {
      setConfig(c);
      if (c?.port !== undefined) setPortInput(String(c.port));
      if (c?.projectName !== undefined) setNameInput(c.projectName);
    });
  }, []);

  const handleSaveAgent = async (key: keyof typeof DEFAULT_AGENTS, value: string) => {
    const current = config?.defaultAgents;
    const updated: typeof DEFAULT_AGENTS = {
      phase: current?.phase ?? DEFAULT_AGENTS.phase,
      planDraft: current?.planDraft ?? DEFAULT_AGENTS.planDraft,
      ideaExtend: current?.ideaExtend ?? DEFAULT_AGENTS.ideaExtend,
      commitSuggest: current?.commitSuggest ?? DEFAULT_AGENTS.commitSuggest,
      [key]: value as AgentId,
    };
    const ok = await saveConfig({ defaultAgents: updated });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, defaultAgents: updated } : prev));
      const setter =
        key === 'phase'
          ? setAgentSavedPhase
          : key === 'planDraft'
            ? setAgentSavedDraft
            : key === 'ideaExtend'
              ? setAgentSavedExtend
              : setAgentSavedSuggest;
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  const handleSavePort = async () => {
    const port = Number(portInput);
    if (!Number.isInteger(port) || port <= 0) return;
    setPortSaving(true);
    const ok = await saveConfig({ port });
    setPortSaving(false);
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, port } : prev));
      setPortSaved(true);
      setTimeout(() => setPortSaved(false), 2000);
    }
  };

  const handleSaveName = async () => {
    const projectName = nameInput.trim();
    if (!projectName) return;
    setNameSaving(true);
    const ok = await saveConfig({ projectName });
    setNameSaving(false);
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, projectName } : prev));
      setNameInput(projectName);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      const ok = await uploadIcon(dataUri);
      setSaving(false);
      if (ok) {
        setSaved(true);
        setUploadedIconDataUri(dataUri);
        setTimeout(() => setSaved(false), 2000);
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
        <Alert variant="warning" title="No papercamp/config.json found">
          Run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <Card size="small">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              borderBottom: '1px solid rgba(61, 53, 43, 0.1)',
              paddingBottom: space[3],
            }}
          >
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              label="Project Name"
            />
            <Button
              variant="secondary"
              size="small"
              onClick={handleSaveName}
              disabled={nameSaving || !nameInput.trim() || nameInput.trim() === config.projectName}
            >
              {nameSaving ? 'Saving…' : 'Save'}
            </Button>
            <Stamp
              size="small"
              fillColor="rgba(143, 185, 150, 0.25)"
              textColor={color.accentGreenDark}
            >
              v{config.version}
            </Stamp>
            {nameSaved && (
              <span className="text-sm" style={{ opacity: 0.6 }}>
                Saved
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              borderBottom: '1px solid rgba(61, 53, 43, 0.1)',
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
                disabled={saving}
              >
                {saving ? 'Uploading…' : 'Choose File'}
              </Button>
              {saved && (
                <span className="text-sm" style={{ opacity: 0.6, marginLeft: space[2] }}>
                  Saved
                </span>
              )}
              {identityLoading && (
                <p className="text-sm" style={{ opacity: 0.5, margin: `${space[1]} 0 0` }}>
                  Loading…
                </p>
              )}
              {!identityLoading && !iconDataUri && !saving && (
                <p className="text-sm" style={{ opacity: 0.45, margin: `${space[1]} 0 0` }}>
                  No icon set.
                </p>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              borderBottom: '1px solid rgba(61, 53, 43, 0.1)',
              paddingBottom: space[3],
              paddingTop: space[3],
            }}
          >
            <Input
              type="number"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              label="Port"
              helperText="Default for `paper-camp dev`. Does not affect the running server."
            />
            <Button
              variant="secondary"
              size="small"
              onClick={handleSavePort}
              disabled={portSaving || !portInput}
            >
              {portSaving ? 'Saving…' : 'Save'}
            </Button>
            {portSaved && (
              <span className="text-sm" style={{ opacity: 0.6 }}>
                Saved
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              borderBottom: '1px solid rgba(61, 53, 43, 0.1)',
              paddingBottom: space[3],
              paddingTop: space[3],
            }}
          >
            <Select
              value={config.defaultAgents?.phase ?? DEFAULT_AGENTS.phase}
              onChange={(v: string) => handleSaveAgent('phase', v)}
              options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
              label="Phase execution"
              helperText="Runs a single phase of a plan."
            />
            {agentSavedPhase && (
              <span className="text-sm" style={{ opacity: 0.6 }}>
                Saved
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              borderBottom: '1px solid rgba(61, 53, 43, 0.1)',
              paddingBottom: space[3],
              paddingTop: space[3],
            }}
          >
            <Select
              value={config.defaultAgents?.planDraft ?? DEFAULT_AGENTS.planDraft}
              onChange={(v: string) => handleSaveAgent('planDraft', v)}
              options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
              label="Plan drafting"
              helperText="Writes a new plan from an idea."
            />
            {agentSavedDraft && (
              <span className="text-sm" style={{ opacity: 0.6 }}>
                Saved
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: space[3],
              borderBottom: '1px solid rgba(61, 53, 43, 0.1)',
              paddingBottom: space[3],
              paddingTop: space[3],
            }}
          >
            <Select
              value={config.defaultAgents?.ideaExtend ?? DEFAULT_AGENTS.ideaExtend}
              onChange={(v: string) => handleSaveAgent('ideaExtend', v)}
              options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
              label="Idea extension"
              helperText="Expands an idea with AI-generated detail."
            />
            {agentSavedExtend && (
              <span className="text-sm" style={{ opacity: 0.6 }}>
                Saved
              </span>
            )}
          </div>

          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: space[3], paddingTop: space[3] }}
          >
            <Select
              value={config.defaultAgents?.commitSuggest ?? DEFAULT_AGENTS.commitSuggest}
              onChange={(v: string) => handleSaveAgent('commitSuggest', v)}
              options={AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] }))}
              label="Commit suggestion"
              helperText="Generates commit title and message from the diff."
            />
            {agentSavedSuggest && (
              <span className="text-sm" style={{ opacity: 0.6 }}>
                Saved
              </span>
            )}
          </div>
        </Card>
      )}

      <p style={{ opacity: 0.45, fontSize: fontSize.sm, marginTop: space[4] }}>
        <strong>Initialized:</strong>{' '}
        {config ? new Date(config.initializedAt).toLocaleString() : '—'}
      </p>
    </div>
  );
};

interface ScriptRow {
  name: string;
  command: string;
}

const parsePackageScripts = (content: string): ScriptRow[] | null => {
  try {
    const parsed = JSON.parse(content) as { scripts?: Record<string, string> };
    if (!parsed.scripts || typeof parsed.scripts !== 'object') return null;
    return Object.entries(parsed.scripts).map(([name, command]) => ({ name, command }));
  } catch {
    return null;
  }
};

const ConfigEditorSection = ({ fileName }: { fileName: string }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchConfigFile(fileName).then((c) => {
      setContent(c);
      setLoading(false);
    });
  }, [fileName]);

  if (loading) return <p>Loading…</p>;
  if (content === null) {
    return (
      <Alert variant="warning" title="Could not load file">
        {fileName} not found.
      </Alert>
    );
  }

  const scripts = fileName === 'package.json' ? parsePackageScripts(content) : null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: space[4],
        }}
      >
        <h2 style={{ margin: 0 }}>{fileName}</h2>
      </div>
      {scripts ? (
        <Table
          data={scripts}
          columns={[
            {
              key: 'name',
              header: 'Script',
              cell: (row: ScriptRow) => (
                <span style={{ fontFamily: fontFamily.mono }}>{row.name}</span>
              ),
              width: 4,
            },
            {
              key: 'command',
              header: 'Command',
              cell: (row: ScriptRow) => (
                <span style={{ fontFamily: fontFamily.mono }}>{row.command}</span>
              ),
            },
          ]}
        />
      ) : (
        <CodeBlock code={content} filename={fileName} />
      )}
    </div>
  );
};

const isSecretKey = (key: string) => /key|secret|token|password/i.test(key);

const EnvSection = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnvEntry[]>([]);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEnv().then((env) => {
      setRows(env.entries);
      setMissingKeys(env.missingKeys);
      setLoading(false);
    });
  }, []);

  const updateRow = (index: number, patch: Partial<EnvEntry>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleAddRow = () => setRows((prev) => [...prev, { key: '', value: '' }]);

  const handleAddMissingKey = (key: string) => {
    setRows((prev) => [...prev, { key, value: '' }]);
    setMissingKeys((prev) => prev.filter((k) => k !== key));
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRevealed((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const toggleReveal = (index: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const handleSave = async () => {
    const trimmed = rows
      .map((row) => ({ key: row.key.trim(), value: row.value }))
      .filter((row) => row.key.length > 0);
    const keys = new Set(trimmed.map((row) => row.key));
    if (keys.size !== trimmed.length) {
      setError('Duplicate keys are not allowed');
      return;
    }
    setError(null);
    setSaving(true);
    const ok = await saveEnv(trimmed);
    setSaving(false);
    if (ok) {
      setRows(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError('Failed to save .env');
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: space[4] }}>Environment Variables</h2>
      {error && (
        <Alert variant="warning" title="Could not save">
          {error}
        </Alert>
      )}
      {missingKeys.length > 0 && (
        <Alert variant="warning" title="Missing from .env">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2], alignItems: 'center' }}>
            <span>Present in .env.example but not set:</span>
            {missingKeys.map((key) => (
              <Button
                key={key}
                variant="secondary"
                size="small"
                onClick={() => handleAddMissingKey(key)}
              >
                + {key}
              </Button>
            ))}
          </div>
        </Alert>
      )}
      <Table
        data={rows}
        columns={[
          {
            key: 'key',
            header: 'Key',
            cell: (row: EnvEntry, index: number) => (
              <Input
                value={row.key}
                placeholder="KEY"
                style={{ fontFamily: fontFamily.mono }}
                onChange={(e) => updateRow(index, { key: e.target.value })}
              />
            ),
            width: 6,
          },
          {
            key: 'value',
            header: 'Value',
            cell: (row: EnvEntry, index: number) => {
              const masked = isSecretKey(row.key) && !revealed.has(index);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                  <Input
                    type={masked ? 'password' : 'text'}
                    value={row.value}
                    placeholder="value"
                    style={{ fontFamily: fontFamily.mono, flex: 1 }}
                    onChange={(e) => updateRow(index, { value: e.target.value })}
                  />
                  {isSecretKey(row.key) && (
                    <Button variant="ghost" size="small" onClick={() => toggleReveal(index)}>
                      {masked ? 'Show' : 'Hide'}
                    </Button>
                  )}
                </div>
              );
            },
          },
          {
            key: 'actions',
            header: '',
            width: 2,
            cell: (_row: EnvEntry, index: number) => (
              <IconButton
                icon={<CloseIcon />}
                variant="ghost"
                size="small"
                label="Remove variable"
                onClick={() => handleDeleteRow(index)}
              />
            ),
          },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3], marginTop: space[4] }}>
        <Button variant="secondary" size="small" onClick={handleAddRow}>
          + Add variable
        </Button>
        <Button variant="primary" size="small" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && (
          <span className="text-sm" style={{ opacity: 0.6 }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
};

export const SettingsPage = () => {
  const activeSection = useAppStore((s) => s.activeSettingsSection);

  return (
    <div>
      <PageTitle>Settings</PageTitle>
      {activeSection === 'general' && <GeneralSection />}
      {activeSection === 'env' && <EnvSection />}
      {activeSection.startsWith('config:') && (
        <ConfigEditorSection fileName={activeSection.slice('config:'.length)} />
      )}
    </div>
  );
};
