import { createIdea } from '@/app/services/content';
import { createGithubIdea } from '@/app/services/github/corpus';
import { useAppStore } from '@/app/stores/app-store';
import { Button, LightbulbIcon } from '@dendelion/paper-ui';
import { useState } from 'react';
import { CreateIdeaModal } from '../modals/create-idea-modal';

export const NewIdeaButton = () => {
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const runtimeReachable = useAppStore((s) => s.runtimeReachable);
  const githubConfig = useAppStore((s) => s.githubConfig);
  const [open, setOpen] = useState(false);

  const handleAdd = async (idea: { title: string; content?: string; kind?: 'idea' | 'note' }) => {
    if (!runtimeReachable && githubConfig) {
      await createGithubIdea(githubConfig, idea);
    } else {
      await createIdea(idea);
    }
    await loadIdeas();
    setOpen(false);
  };

  return (
    <>
      <Button icon={<LightbulbIcon size={16} />} size="small" onClick={() => setOpen(true)}>
        New idea
      </Button>
      <CreateIdeaModal open={open} onClose={() => setOpen(false)} onAdd={handleAdd} />
    </>
  );
};
