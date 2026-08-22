import type { IdeaEntry, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { entityLink, entityRouteParam, resolveByIdOrTitle } from './use-route-selection';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const idea = (overrides: Partial<IdeaEntry>): IdeaEntry => ({
  id: null,
  title: 'Untitled idea',
  body: '',
  ...overrides,
});

describe('resolveByIdOrTitle', () => {
  it('matches by id when present', () => {
    const entries = [plan({ id: '146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, '146')?.title).toBe('Route plans and ideas by id');
  });

  it('never confuses a ticket with the idea sharing its number', () => {
    const entries = [
      plan({ id: 'TICKET-2', title: 'Detach the client' }),
      plan({ id: 'IDEA-2', title: 'An unrelated idea' }),
    ];
    // The prefix comes from the route shape: /ideas/2 vs /ideas/195/tickets/2.
    expect(resolveByIdOrTitle(entries, '2')?.title).toBe('An unrelated idea');
    expect(resolveByIdOrTitle(entries, '2', 'TICKET')?.title).toBe('Detach the client');
  });

  it('falls back to title for an id-less entry', () => {
    const entries = [plan({ id: undefined, title: 'Deliver lives in the idea view' })];
    expect(resolveByIdOrTitle(entries, 'Deliver lives in the idea view')?.title).toBe(
      'Deliver lives in the idea view',
    );
  });

  it('does not fall back to title for an entry that has an id', () => {
    const entries = [plan({ id: '146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, 'Route plans and ideas by id')).toBeNull();
  });

  it('works for id-less idea entries too', () => {
    const entries = [idea({ id: null, title: 'A legacy note' })];
    expect(resolveByIdOrTitle(entries, 'A legacy note')?.title).toBe('A legacy note');
  });

  it('returns null when nothing matches', () => {
    const entries = [plan({ id: '146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, '999')).toBeNull();
  });

  it('still resolves a full-id link a previous routing scheme emitted', () => {
    const entries = [plan({ id: 'IDEA-146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, 'IDEA-146')?.title).toBe('Route plans and ideas by id');
  });
});

describe('entityLink', () => {
  it('nests a TICKET under the board that owns it', () => {
    expect(
      entityLink({
        id: 'TICKET-2',
        title: 'Detach the client',
        entityKind: 'ticket',
        idea: 'IDEA-195',
      }),
    ).toEqual({ to: '/ideas/$ideaId/tickets/$ticketId', params: { ideaId: '195', ticketId: '2' } });
  });

  it('keeps an idea promoted onto a board at its own address', () => {
    expect(
      entityLink({
        id: 'IDEA-117',
        title: 'Multi-project hub',
        entityKind: 'ticket',
        idea: 'IDEA-195',
      }),
    ).toEqual({ to: '/ideas/$ideaId', params: { ideaId: '117' } });
  });

  it('links a plain idea by its number', () => {
    expect(entityLink({ id: 'IDEA-195', title: 'A board' })).toEqual({
      to: '/ideas/$ideaId',
      params: { ideaId: '195' },
    });
  });
});

describe('entityRouteParam', () => {
  it('emits the bare number, since the route shape carries the rest', () => {
    expect(entityRouteParam('IDEA-146', 'Route plans and ideas by id')).toBe('146');
  });

  it('falls back to the URL-encoded title when id is absent', () => {
    expect(entityRouteParam(undefined, 'Deliver lives in the idea view')).toBe(
      encodeURIComponent('Deliver lives in the idea view'),
    );
  });
});
