import { createIdea } from '@/app/services/content';
import { Button, Spinner, Stamp, Textarea } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { useState } from 'react';

const titleStyle: CSSProperties = { fontWeight: 600, marginBottom: '0.5rem' };
const footerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '0.5rem',
  gap: '0.5rem',
};
const mutedStyle: CSSProperties = { opacity: 0.6, fontSize: '0.75rem' };
const errorRowStyle: CSSProperties = { marginTop: '0.375rem' };

const CAPTURE_TITLE_LIMIT = 80;

const captureTitle = (text: string) =>
  text.length > CAPTURE_TITLE_LIMIT ? `${text.slice(0, CAPTURE_TITLE_LIMIT - 1)}…` : text;

export const CapturePanel = () => {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    const text = input.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createIdea({
        title: captureTitle(text),
        content: `${text}\n\nCaptured from ${window.location.href}`,
        kind: 'note',
      });
      setInput('');
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={titleStyle}>Quick capture</div>
      <Textarea
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setSaved(false);
        }}
        aria-label="Capture an idea"
        placeholder="Note an idea in a sentence or two…"
        rows={2}
        disabled={saving}
      />
      <div style={footerRowStyle}>
        {saving ? (
          <Spinner size="small" label="Capturing…" />
        ) : saved ? (
          <span style={mutedStyle}>Captured with the current URL attached.</span>
        ) : (
          <span />
        )}
        <Button size="small" onClick={handleCapture} disabled={saving || !input.trim()}>
          Capture
        </Button>
      </div>
      {error && (
        <div style={errorRowStyle}>
          <Stamp size="small" variant="error">
            {error}
          </Stamp>
        </div>
      )}
    </div>
  );
};
