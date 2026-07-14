import { createIdea } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { IconButton, LightbulbIcon } from '@dendelion/paper-ui';
import { useState } from 'react';
import { CreateIdeaModal } from '../modals/create-idea-modal';

export const NewIdeaButton = () => {
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const [open, setOpen] = useState(false);

  const handleAdd = async (idea: { title: string; content?: string; kind?: 'idea' | 'note' }) => {
    await createIdea(idea);
    await loadIdeas();
    setOpen(false);
  };

  return (
    <>
      <IconButton
        icon={<LightbulbIcon size={16} />}
        variant="ghost"
        size="small"
        label="New idea"
        onClick={() => setOpen(true)}
      />
      <CreateIdeaModal open={open} onClose={() => setOpen(false)} onAdd={handleAdd} />
    </>
  );
};
