import { useProjectIdentity } from '@/app/hooks';
import { fetchConfig, saveConfig, uploadIcon } from '@/app/services/system';
import {
  type AgentConfig,
  DEFAULT_AGENTS,
  type DefaultAgentsMap,
  type PaperCampConfig,
  agentConfigsEqual,
} from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';
import type { TaskTypeKey } from '../constants';

export const useSettingsPage = () => {
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
      feedback: current?.feedback ?? DEFAULT_AGENTS.feedback,
      codeReview: current?.codeReview ?? DEFAULT_AGENTS.codeReview,
      [key]: newEntry,
    };
    if (key === 'codeReview' && agentConfigsEqual(newEntry, updated.phase)) {
      toast({
        title: 'Failed to save',
        description: 'Code review must use a different model than Phase run.',
        variant: 'error',
      });
      return;
    }
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
      toast({
        title: 'Saved',
        description: 'Restart `paper-camp dev` to apply the new port.',
        variant: 'success',
      });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleToggleIntegration = async () => {
    if (!config) return;
    const next = !(config.integration?.toolbar?.enabled ?? true);
    const integration = {
      ...config.integration,
      toolbar: { ...config.integration?.toolbar, enabled: next },
    };
    const { ok, error } = await saveConfig({ integration });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, integration } : prev));
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

  return {
    fileRef,
    config,
    identityLoading,
    iconDataUri,
    uploading,
    portInput,
    setPortInput,
    nameInput,
    setNameInput,
    handleSaveAgentConfig,
    handleSavePort,
    handleToggleIntegration,
    handleSaveName,
    handleFile,
  };
};
