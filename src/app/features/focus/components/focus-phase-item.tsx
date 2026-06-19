import type { PhaseItem } from '@/types/index';
import { Checkbox } from '@dendelion/paper-ui';
import { useState } from 'react';

interface FocusPhaseItemProps {
  phase: PhaseItem;
  planTitle: string;
  phaseIndex: number;
  onToggle: () => void;
}

/**
 * navigator.clipboard is undefined outside a secure context — which includes any
 * non-"localhost" origin over plain http (Tailscale/LAN access, which this dev server
 * supports). Falls back to the legacy execCommand path there instead of throwing.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export const FocusPhaseItem = ({ phase, planTitle, phaseIndex, onToggle }: FocusPhaseItemProps) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async () => {
    const prompt = `Start phase ${phaseIndex + 1} of plan "${planTitle}" in papercamp/plans.md`;
    const ok = await copyToClipboard(prompt);
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 1500);
  };

  return (
    <div className="flex items-center gap-3 py-2 group">
      <Checkbox checked={phase.done} onChange={onToggle} />
      <span
        className={`text-base flex-1 ${phase.done ? 'line-through' : ''}`}
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          lineHeight: 1.35,
          opacity: phase.done ? 0.55 : 1,
        }}
      >
        {phase.text}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={`transition-opacity ${status === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: status === 'copied' ? '#6A9B72' : status === 'failed' ? '#A06060' : '#68635C',
          flexShrink: 0,
        }}
      >
        {status === 'copied' ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Copied</title>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : status === 'failed' ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Copy failed — select and copy manually</title>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Copy phase prompt</title>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
};
