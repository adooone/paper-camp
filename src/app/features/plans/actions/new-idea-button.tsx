import { createIdea } from '@/app/services/content';
import { refreshIdeas } from '@/app/services/query-client';
import { Button, LightbulbIcon } from '@dendelion/folk-ui';
import { useState } from 'react';
import { CreateIdeaModal } from '../modals/create-idea-modal';

export const NewIdeaButton = () => {
  const [open, setOpen] = useState(false);

  const handleAdd = async (idea: {
    title: string;
    content?: string;
    kind?: 'idea' | 'note' | 'board';
  }) => {
    await createIdea(idea);
    await refreshIdeas();
    setOpen(false);
  };

  return (
    <>
      <Button
        icon={<LightbulbIcon size={16} opacity={0.55} />}
        size="small"
        onClick={() => setOpen(true)}
      >
        New idea
      </Button>
      <CreateIdeaModal open={open} onClose={() => setOpen(false)} onAdd={handleAdd} />
    </>
  );
};
