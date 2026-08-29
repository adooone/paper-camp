import { renameRuntime } from '@/app/services/runtime-connection';
import { Button, Input, Modal } from '@dendelion/paper-ui';
import { useState } from 'react';

interface RenameRuntimeButtonProps {
  runtimeUrl: string;
  currentLabel: string;
  onRenamed: () => void;
}

export const RenameRuntimeButton = ({
  runtimeUrl,
  currentLabel,
  onRenamed,
}: RenameRuntimeButtonProps) => {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(currentLabel);

  const handleClose = () => {
    setOpen(false);
    setLabel(currentLabel);
  };

  const handleSubmit = () => {
    renameRuntime(runtimeUrl, label, window.localStorage);
    setOpen(false);
    onRenamed();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="small"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        Rename
      </Button>
      <Modal open={open} onClose={handleClose} title="Rename project" size="small">
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Project name"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
