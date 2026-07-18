import { useProjectSubjects } from '@/app/hooks';
import { space } from '@/app/styles/tokens';
import { Button, Card, Divider, IconButton, Input, PlusIcon, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';

const SubjectRow = ({
  name,
  isLast,
  onRename,
  onRemove,
}: {
  name: string;
  isLast: boolean;
  onRename: (from: string, to: string) => Promise<boolean>;
  onRemove: (name: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(name);
  const { toast } = useToast();

  const handleBlur = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setValue(name);
      return;
    }
    const ok = await onRename(name, trimmed);
    if (!ok) {
      setValue(name);
      toast({ title: 'Failed to rename', variant: 'error' });
    }
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
        <Input
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          style={{ flex: 1 }}
        />
        <IconButton
          icon={<span>×</span>}
          variant="ghost"
          size="small"
          label={`Remove ${name}`}
          onClick={() => onRemove(name)}
        />
      </div>
      {!isLast && <Divider />}
    </>
  );
};

export const SubjectsSection = () => {
  const { subjects, loading, addSubject, renameSubject, removeSubject } = useProjectSubjects();
  const [newSubject, setNewSubject] = useState('');
  const { toast } = useToast();

  const handleAdd = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const ok = await addSubject(trimmed);
    if (ok) setNewSubject('');
    else toast({ title: 'Failed to add subject', variant: 'error' });
  };

  const handleRemove = async (name: string) => {
    const ok = await removeSubject(name);
    if (!ok) toast({ title: 'Failed to remove subject', variant: 'error' });
  };

  return (
    <div>
      <div style={{ marginBottom: space[6] }}>
        <h2 style={{ margin: 0 }}>Subjects</h2>
        <p style={{ opacity: 0.5, marginTop: space[1] }}>
          Group ideas by subject. Removing one falls its ideas back to "No subject" — file contents
          are untouched.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {!loading && (
        <Card size="small">
          {subjects.length === 0 && (
            <p style={{ opacity: 0.45, margin: 0, paddingBottom: space[2] }}>No subjects yet.</p>
          )}
          {subjects.map((name, idx) => (
            <SubjectRow
              key={name}
              name={name}
              isLast={idx === subjects.length - 1}
              onRename={renameSubject}
              onRemove={handleRemove}
            />
          ))}
          {subjects.length > 0 && <Divider />}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              paddingTop: space[3],
            }}
          >
            <Input
              size="small"
              placeholder="New subject"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              style={{ flex: 1 }}
            />
            <Button
              variant="secondary"
              size="small"
              onClick={handleAdd}
              disabled={!newSubject.trim()}
            >
              <PlusIcon size={14} /> Add
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
