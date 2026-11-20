import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { chatAboutParam } from '@/app/features/chat/helpers';
import { ChatView } from '../chat/chat-view';
import { useChatScreen } from '../hooks/use-chat-screen';
import { SCREEN_PATHS } from '../shell/screens';

export const ChatPage = () => {
  const { about } = useSearch({ strict: false }) as { about?: unknown };
  const navigate = useNavigate();
  const onAboutConsumed = useCallback(
    () => void navigate({ to: SCREEN_PATHS.chat, search: {}, replace: true }),
    [navigate],
  );
  const screen = useChatScreen({ about: chatAboutParam(about), onAboutConsumed });
  return <ChatView screen={screen} />;
};
