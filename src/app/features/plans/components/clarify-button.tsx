import { color } from '@/app/styles/tokens';
import { copyToClipboard } from '@/app/utils/clipboard';
import type { PlanEntry } from '@/types/index';
import { Button, CheckIcon, CloseIcon, CopyIcon } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildClarifyPrompt } from '../prompts';

interface ClarifyButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const ClarifyButton = ({ plan, disabled }: ClarifyButtonProps) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleClick = async () => {
    const prompt = buildClarifyPrompt(plan);
    const ok = await copyToClipboard(prompt);
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 1500);
  };

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={disabled}
      icon={
        status === 'copied' ? (
          <CheckIcon size={14} />
        ) : status === 'failed' ? (
          <CloseIcon size={14} />
        ) : (
          <CopyIcon size={14} />
        )
      }
      title={
        status === 'copied'
          ? 'Copied'
          : status === 'failed'
            ? 'Copy failed — select and copy manually'
            : 'Copy clarification prompt'
      }
      style={{
        color:
          status === 'copied' ? '#6A9B72' : status === 'failed' ? '#A06060' : color.textSecondary,
      }}
    >
      Copy Clarifications Prompt
    </Button>
  );
};
