import { PageTitle } from '@/app/components/page-title';
import { fetchConfig } from '@/app/services/config-api';
import { fetchIconDataUri, uploadIcon } from '@/app/services/icon-api';
import type { PaperCampConfig } from '@/types/index';
import { Alert, Button, Card, Stamp } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';

export const SettingsPage = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const [iconDataUri, setIconDataUri] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig().then(setConfig);
    fetchIconDataUri().then(setIconDataUri);
  }, []);

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
        setIconDataUri(dataUri);
        setTimeout(() => setSaved(false), 2000);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <PageTitle>Settings</PageTitle>

      {/* Project info card */}
      {config === undefined && <p>Loading…</p>}
      {config === null && (
        <Alert variant="warning" title="No .paper-camp/config.json found">
          Run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <Card accent accentColor="slate">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>{config.projectName}</h2>
            <Stamp size="small" fillColor="rgba(143, 185, 150, 0.25)" textColor="#5E8A66">
              v{config.version}
            </Stamp>
          </div>
          <p>
            <strong>Initialized:</strong> {new Date(config.initializedAt).toLocaleString()}
          </p>
        </Card>
      )}

      {/* Icon section */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Project Icon</h3>
        <Card>
          <div className="flex items-center gap-4">
            {iconDataUri && (
              <img
                src={iconDataUri}
                alt="Project icon"
                style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <div>
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
                <span className="text-sm" style={{ opacity: 0.6, marginLeft: '0.5rem' }}>
                  Saved
                </span>
              )}
              {!iconDataUri && !saving && (
                <p className="text-sm" style={{ opacity: 0.45, margin: '0.25rem 0 0' }}>
                  No icon set. Upload an SVG, PNG, or JPG.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
