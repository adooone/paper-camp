import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AgentId } from '@/types/index';
import { localFile, readMaybe } from './helpers';

interface ChatSession {
  sessionId: string;
  agent: AgentId;
  model?: string;
}

const chatSessionPath = (root: string) => localFile(root, 'chat-session.json');

export async function readChatSession(root: string): Promise<ChatSession | null> {
  const raw = await readMaybe(chatSessionPath(root));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ChatSession>;
    if (typeof data.sessionId !== 'string' || typeof data.agent !== 'string') return null;
    return {
      sessionId: data.sessionId,
      agent: data.agent,
      ...(typeof data.model === 'string' && { model: data.model }),
    };
  } catch {
    return null;
  }
}

export async function writeChatSession(root: string, session: ChatSession): Promise<void> {
  const path = chatSessionPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(session, null, 2)}\n`, 'utf-8');
}
