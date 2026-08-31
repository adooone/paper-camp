import { Button, IconButton, Input, Menu, Modal } from '@dendelion/paper-ui';
import { useState } from 'react';

interface RenameModalProps {
  open: boolean;
  currentLabel: string;
  onClose: () => void;
  onSubmit: (label: string) => void;
}

const RenameModal = ({ open, currentLabel, onClose, onSubmit }: RenameModalProps) => {
  const [label, setLabel] = useState(currentLabel);

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setLabel(currentLabel);
      }}
      title="Rename project"
      size="small"
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Project name"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => onSubmit(label)}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export interface ProjectActionsMenuProps {
  projectName: string;
  currentLabel: string;
  onRename: (label: string) => void;
  onRemove: () => void;
}

export const ProjectActionsMenu = ({
  projectName,
  currentLabel,
  onRename,
  onRemove,
}: ProjectActionsMenuProps) => {
  const [renameOpen, setRenameOpen] = useState(false);

  return (
    <>
      <Menu
        align="end"
        trigger={
          <IconButton
            variant="ghost"
            size="small"
            className="shrink-0"
            label={`${projectName} actions`}
            icon={<span aria-hidden="true">···</span>}
            onClick={(e) => e.stopPropagation()}
          />
        }
        items={[
          { id: 'rename', label: 'Rename', onSelect: () => setRenameOpen(true) },
          { id: 'remove', label: 'Remove', danger: true, onSelect: onRemove },
        ]}
      />
      <RenameModal
        open={renameOpen}
        currentLabel={currentLabel}
        onClose={() => setRenameOpen(false)}
        onSubmit={(label) => {
          onRename(label);
          setRenameOpen(false);
        }}
      />
    </>
  );
};
