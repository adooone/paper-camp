import { fontFamily, fontSize } from '@/app/styles/tokens';
import { copyToClipboard } from '@/app/utils/clipboard';
import { CheckIcon, CloseIcon, CopyIcon, IconButton } from '@dendelion/paper-ui';
import { useState } from 'react';

interface CopyPromptButtonProps {
  prompt: string;
  label?: string;
  variant?: 'icon' | 'link';
}

export const CopyPromptButton = ({
  prompt,
  label = 'Copy fix prompt',
  variant = 'icon',
}: CopyPromptButtonProps) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(prompt);
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 1500);
  };

  if (variant === 'link') {
    const text = status === 'copied' ? 'Copied!' : status === 'failed' ? 'Copy failed' : label;
    return (
      <button
        type="button"
        onClick={handleCopy}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'inherit',
          textDecoration: 'underline',
          cursor: 'pointer',
          font: 'inherit',
          fontFamily: fontFamily.handwritten,
          fontSize: fontSize.sm,
        }}
      >
        {text}
      </button>
    );
  }

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
      surface="chalkboard"
      size="small"
      label={status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : label}
      onClick={handleCopy}
    />
  );
};
