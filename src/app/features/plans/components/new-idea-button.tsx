import { createIdea } from '@/app/services/ideas-api';
import { useAppStore } from '@/app/stores/app-store';
import { IconButton } from '@dendelion/paper-ui';
import { useState } from 'react';
import { CreateIdeaModal } from './create-idea-modal';

export const NewIdeaButton = () => {
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const [open, setOpen] = useState(false);

  const handleAdd = async (idea: { title: string; content?: string }) => {
    await createIdea(idea);
    await loadIdeas();
    setOpen(false);
  };

  return (
    <>
      <IconButton
        icon={<span>+</span>}
        variant="ghost"
        size="small"
        label="New idea"
        onClick={() => setOpen(true)}
      />
      <CreateIdeaModal open={open} onClose={() => setOpen(false)} onAdd={handleAdd} />
    </>
  );
};
