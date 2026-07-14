import { color } from '@/app/styles/tokens';
import { copyToClipboard } from '@/app/utils/clipboard';
import { CheckIcon, CloseIcon, CopyIcon, IconButton } from '@dendelion/paper-ui';
import { useState } from 'react';

interface PhaseCopyButtonProps {
  planTitle: string;
  planId?: string;
  phaseIndex: number;
}

export const PhaseCopyButton = ({ planTitle, planId, phaseIndex }: PhaseCopyButtonProps) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = `Start phase ${phaseIndex + 1} of plan "${planTitle}" in papercamp/ideas/${planId ?? '<ID>'}.md`;
    const ok = await copyToClipboard(prompt);
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 1500);
  };

  return (
    <IconButton
      icon={
        status === 'copied' ? (
          <CheckIcon size={16} />
        ) : status === 'failed' ? (
          <CloseIcon size={16} />
        ) : (
          <CopyIcon size={16} />
        )
      }
      variant="ghost"
      size="small"
      label={
        status === 'copied'
          ? 'Copied'
          : status === 'failed'
            ? 'Copy failed — select and copy manually'
            : 'Copy phase prompt'
      }
      onClick={handleCopy}
      className="transition-opacity"
      style={{
        color:
          status === 'copied' ? '#6A9B72' : status === 'failed' ? '#A06060' : color.textSecondary,
      }}
    />
  );
};
