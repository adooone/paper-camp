import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SimilarityCandidate } from '@/app/features/plans/helpers';
import { readEntities } from '@/core/readers';
import {
  assignEntityId,
  formatEntityFile,
  removeSuggestionLine,
  todayDateString,
} from '@/core/serialize';
import type { SuggestionEntry } from '@/types/index';
import {
  campFile,
  entityFileInput,
  fileExists,
  readMaybe,
  regenerateIndexes,
  writeEntityFile,
} from '../../helpers';
import { readBody, sendJson } from '../../http';
import { checkIdeaOverlap } from '../../overlap-check';
import type { Route, RouteContext } from '../types';

export function ideaRoutes({ root, agent }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/ideas',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { title, content, kind } = JSON.parse(reqBody) as {
          title?: string;
          content?: string;
          kind?: 'idea' | 'note';
        };
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const configPath = join(root, 'papercamp', 'config.json');
        const newId = await assignEntityId(configPath);
        if (!newId) {
          sendJson(res, 500, { error: 'could not assign entity ID' });
          return;
        }
        const ideasDir = campFile(root, 'ideas');
        await mkdir(ideasDir, { recursive: true });
        const isNote = kind === 'note';
        const entityContent = formatEntityFile({
          id: newId,
          title: title.trim(),
          kind: isNote ? 'note' : undefined,
          status: isNote ? 'open' : 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await writeFile(join(ideasDir, `${newId}.md`), `${entityContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        sendJson(res, 201, { ok: true, id: newId });
      },
    },

    // Mints the id, writes the idea file, removes the suggestion line, and regenerates
    // the index synchronously; the client follows with a launch-extend call for the qualitative expansion.
    {
      method: 'POST',
      path: '/api/suggestions/promote',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { suggestion } = JSON.parse(reqBody) as { suggestion?: SuggestionEntry };
        if (!suggestion?.title || !suggestion.date) {
          sendJson(res, 400, { error: 'suggestion is required' });
          return;
        }
        const suggestionsPath = campFile(root, 'suggestions.md');
        const raw = await readMaybe(suggestionsPath);
        const updated = removeSuggestionLine(raw, suggestion);
        if (updated === raw) {
          sendJson(res, 404, { error: 'suggestion not found' });
          return;
        }
        const configPath = join(root, 'papercamp', 'config.json');
        const newId = await assignEntityId(configPath);
        if (!newId) {
          sendJson(res, 500, { error: 'could not assign entity ID' });
          return;
        }
        const ideasDir = campFile(root, 'ideas');
        await mkdir(ideasDir, { recursive: true });
        const entityContent = formatEntityFile({
          id: newId,
          title: suggestion.title,
          status: 'idea',
          created: todayDateString(),
          body: suggestion.description,
        });
        await writeFile(join(ideasDir, `${newId}.md`), `${entityContent}\n`, 'utf-8');
        await writeFile(suggestionsPath, updated, 'utf-8');
        await regenerateIndexes(root);
        sendJson(res, 201, { ok: true, id: newId });
      },
    },

    // Dismissing just deletes the line — no id was ever minted, so there's nothing else to clean up.
    {
      method: 'POST',
      path: '/api/suggestions/dismiss',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { suggestion } = JSON.parse(reqBody) as { suggestion?: SuggestionEntry };
        if (!suggestion?.title || !suggestion.date) {
          sendJson(res, 400, { error: 'suggestion is required' });
          return;
        }
        const suggestionsPath = campFile(root, 'suggestions.md');
        const raw = await readMaybe(suggestionsPath);
        const updated = removeSuggestionLine(raw, suggestion);
        if (updated === raw) {
          sendJson(res, 404, { error: 'suggestion not found' });
          return;
        }
        await writeFile(suggestionsPath, updated, 'utf-8');
        sendJson(res, 200, { ok: true });
      },
    },

    // The click that promotes to `done` IS the archive decision, so the frontmatter
    // change is written straight to the archive destination — never to the ideasDir
    // copy — instead of a write-then-move. Silently skips ids that no longer resolve
    // (already archived, or the id list going stale between list and click).
    {
      method: 'POST',
      path: '/api/ideas/archive',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { ids } = JSON.parse(reqBody) as { ids?: string[] };
        if (!ids?.length) {
          sendJson(res, 400, { error: 'ids is required' });
          return;
        }
        const ideasDir = campFile(root, 'ideas');
        const archiveDir = join(ideasDir, 'archive');
        const { entries } = await readEntities(ideasDir);
        await mkdir(archiveDir, { recursive: true });

        const archived: string[] = [];
        for (const id of ids) {
          const target = entries.find((e) => e.id === id && e.kind !== 'note' && !e.archived);
          const sourcePath = join(ideasDir, `${id}.md`);
          if (!target || !(await fileExists(sourcePath))) continue;
          await writeEntityFile(
            join(archiveDir, `${id}.md`),
            entityFileInput(target, { status: 'done', updated: todayDateString() }),
          );
          await unlink(sourcePath);
          archived.push(id);
        }

        await regenerateIndexes(root);
        sendJson(res, 200, { ok: true, archived });
      },
    },

    // Read-only — never edits a file, so unlike launch-draft/launch-extend it returns
    // the verdict directly instead of via polling.
    {
      method: 'POST',
      path: '/api/ideas/check-overlap',
      handle: async (req, res) => {
        try {
          const reqBody = await readBody(req);
          const { text, candidates } = JSON.parse(reqBody) as {
            text?: string;
            candidates?: SimilarityCandidate[];
          };
          if (!text?.trim()) {
            sendJson(res, 400, { error: 'text is required' });
            return;
          }
          const verdict = await checkIdeaOverlap(text, candidates ?? [], agent.runOverlapCheck);
          sendJson(res, 200, verdict);
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },
  ];
}
