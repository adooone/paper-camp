import { describe, expect, it } from 'vitest';
import type { EntityStatus, PrInfo } from '../../types/index';
import {
  type StatusDerivationInput,
  deriveBoardStatus,
  deriveStatus,
  isArchivable,
  isStatusFallback,
} from './status';

const phase = (done: boolean) => ({ done, text: 'phase' });
const pr = (state: PrInfo['state']): PrInfo => ({ number: 1, url: 'u', state });

interface DeriveCase {
  name: string;
  entity: StatusDerivationInput;
  pr?: PrInfo;
  resolved?: boolean; // default: true
  mainActivity?: boolean;
  expected: EntityStatus | undefined;
}

describe('deriveStatus', () => {
  it.each<DeriveCase>([
    { name: 'no phases -> idea', entity: { phases: [] }, expected: 'idea' },
    { name: 'phases, no PR -> planned', entity: { phases: [phase(false)] }, expected: 'planned' },
    {
      name: 'open PR, unchecked -> in-progress',
      entity: { phases: [phase(true), phase(false)] },
      pr: pr('open'),
      expected: 'in-progress',
    },
    {
      name: 'draft PR, unchecked -> in-progress',
      entity: { phases: [phase(false)] },
      pr: pr('draft'),
      expected: 'in-progress',
    },
    {
      name: 'open PR, all checked -> review',
      entity: { phases: [phase(true), phase(true)] },
      pr: pr('open'),
      expected: 'review',
    },
    {
      name: 'draft PR, all checked -> review',
      entity: { phases: [phase(true)] },
      pr: pr('draft'),
      expected: 'review',
    },
    {
      name: 'open PR, phases checked, fix open -> in-progress',
      entity: { phases: [phase(true)], fixes: [phase(true), phase(false)] },
      pr: pr('open'),
      expected: 'in-progress',
    },
    {
      name: 'open PR, phases + fixes checked -> review',
      entity: { phases: [phase(true)], fixes: [phase(true)] },
      pr: pr('open'),
      expected: 'review',
    },
    {
      name: 'merged PR, all checked, overrides stale stored in-progress -> done',
      entity: { phases: [phase(true)], status: 'in-progress' },
      pr: pr('merged'),
      expected: 'done',
    },
    {
      name: 'merged PR, unchecked, stored in-progress -> planned',
      entity: { phases: [phase(false)], status: 'in-progress' },
      pr: pr('merged'),
      expected: 'planned',
    },
    {
      name: 'merged PR, unchecked, stored done -> planned',
      entity: { phases: [phase(false)], status: 'done' },
      pr: pr('merged'),
      expected: 'planned',
    },
    {
      name: 'closed-unmerged PR -> dropped',
      entity: { phases: [phase(true)] },
      pr: pr('closed'),
      expected: 'dropped',
    },
    {
      name: 'unreachable, stored review -> review',
      entity: { phases: [phase(false)], status: 'review' },
      resolved: false,
      expected: 'review',
    },
    {
      name: 'unreachable, stored done -> done',
      entity: { phases: [phase(true)], status: 'done' },
      resolved: false,
      expected: 'done',
    },
    {
      name: 'unreachable, nothing stored, phases -> planned',
      entity: { phases: [phase(false)] },
      resolved: false,
      expected: 'planned',
    },
    {
      name: 'unreachable, nothing stored, no phases -> idea',
      entity: { phases: [] },
      resolved: false,
      expected: 'idea',
    },
    {
      name: 'resolved, no matchable PR, stored done (legacy) -> done',
      entity: { phases: [phase(true)], status: 'done' },
      expected: 'done',
    },
    {
      name: 'resolved, no PR, stored review (direct-to-main) -> review',
      entity: { phases: [phase(true)], status: 'review' },
      expected: 'review',
    },
    {
      name: 'main activity, unchecked -> in-progress',
      entity: { phases: [phase(false)] },
      mainActivity: true,
      expected: 'in-progress',
    },
    {
      name: 'main activity, all checked -> review',
      entity: { phases: [phase(true)] },
      mainActivity: true,
      expected: 'review',
    },
    {
      name: 'main activity ignored with no phases -> idea',
      entity: { phases: [] },
      mainActivity: true,
      expected: 'idea',
    },
    {
      name: 'main activity ignored when unreachable -> planned',
      entity: { phases: [phase(true)] },
      resolved: false,
      mainActivity: true,
      expected: 'planned',
    },
    {
      name: 'main activity ignored once a PR exists -> in-progress',
      entity: { phases: [phase(false)] },
      pr: pr('open'),
      mainActivity: true,
      expected: 'in-progress',
    },
    {
      name: 'stored dropped, no PR -> dropped',
      entity: { phases: [], status: 'dropped' },
      expected: 'dropped',
    },
    {
      name: 'stored dropped overrides a merged PR -> dropped',
      entity: { phases: [phase(true)], status: 'dropped' },
      pr: pr('merged'),
      expected: 'dropped',
    },
    {
      name: 'archived, unreachable -> done',
      entity: { phases: [phase(false)], archived: true },
      resolved: false,
      expected: 'done',
    },
    {
      name: 'archived, no phases -> done',
      entity: { phases: [], archived: true },
      expected: 'done',
    },
    {
      name: 'stored dropped overrides archived -> dropped',
      entity: { phases: [], archived: true, status: 'dropped' },
      expected: 'dropped',
    },
    {
      name: 'note passes stored status through (open)',
      entity: { kind: 'note', status: 'open', phases: [] },
      pr: pr('open'),
      expected: 'open',
    },
    {
      name: 'note passes stored status through (done)',
      entity: { kind: 'note', status: 'done', phases: [phase(true)] },
      expected: 'done',
    },
  ])('$name', ({ entity, pr: prInfo, resolved = true, mainActivity, expected }) => {
    expect(deriveStatus(entity, prInfo, resolved, mainActivity)).toBe(expected);
  });
});

describe('isArchivable', () => {
  it.each<{
    name: string;
    entity: StatusDerivationInput;
    pr: PrInfo | undefined;
    expected: boolean;
  }>([
    {
      name: 'merged PR, review phases -> true',
      entity: { phases: [phase(true)] },
      pr: pr('merged'),
      expected: true,
    },
    {
      name: 'merged PR, stored done -> true',
      entity: { phases: [phase(true)], status: 'done' },
      pr: pr('merged'),
      expected: true,
    },
    { name: 'no PR -> false', entity: { phases: [phase(true)] }, pr: undefined, expected: false },
    {
      name: 'open PR -> false',
      entity: { phases: [phase(true)] },
      pr: pr('open'),
      expected: false,
    },
    {
      name: 'closed-unmerged PR -> false',
      entity: { phases: [phase(true)] },
      pr: pr('closed'),
      expected: false,
    },
    {
      name: 'note, even with a merged PR -> false',
      entity: { kind: 'note', phases: [] },
      pr: pr('merged'),
      expected: false,
    },
    {
      name: 'already archived -> false',
      entity: { phases: [phase(true)], archived: true },
      pr: pr('merged'),
      expected: false,
    },
    {
      name: 'stored dropped wins over a merged PR -> false',
      entity: { phases: [phase(true)], status: 'dropped' },
      pr: pr('merged'),
      expected: false,
    },
    {
      name: 'a merged idea gains a new unchecked phase, even stored done -> false',
      entity: { phases: [phase(true), phase(false)], status: 'done' },
      pr: pr('merged'),
      expected: false,
    },
  ])('$name', ({ entity, pr: prInfo, expected }) => {
    expect(isArchivable(entity, prInfo)).toBe(expected);
  });
});

describe('isStatusFallback', () => {
  it.each<{
    name: string;
    entity: StatusDerivationInput;
    pr?: PrInfo;
    resolved: boolean;
    expected: boolean;
  }>([
    {
      name: 'unreachable, no PR -> true',
      entity: { phases: [phase(false)] },
      resolved: false,
      expected: true,
    },
    {
      name: 'unreachable, no PR, even with a stored review -> true',
      entity: { phases: [phase(false)], status: 'review' },
      resolved: false,
      expected: true,
    },
    {
      name: 'PR lookup resolved -> false',
      entity: { phases: [phase(false)] },
      resolved: true,
      expected: false,
    },
    {
      name: 'a PR was found, even if lookup overall did not resolve -> false',
      entity: { phases: [phase(false)] },
      pr: pr('open'),
      resolved: false,
      expected: false,
    },
    {
      name: 'archived (derived, not guessed) -> false',
      entity: { phases: [], archived: true },
      resolved: false,
      expected: false,
    },
    {
      name: 'stored dropped always wins -> false',
      entity: { phases: [], status: 'dropped' },
      resolved: false,
      expected: false,
    },
    {
      name: 'note (never derives from PR state) -> false',
      entity: { kind: 'note', phases: [] },
      resolved: false,
      expected: false,
    },
    {
      name: 'board (rolls up from tickets) -> false',
      entity: { kind: 'board', phases: [] },
      resolved: false,
      expected: false,
    },
  ])('$name', ({ entity, pr: prInfo, resolved, expected }) => {
    expect(isStatusFallback(entity, prInfo, resolved)).toBe(expected);
  });
});

describe('deriveBoardStatus', () => {
  it.each<[string, EntityStatus[], ReturnType<typeof deriveBoardStatus>]>([
    ['no tickets (empty shell, not yet decomposed) -> idea', [], 'idea'],
    ['every ticket unstarted -> planned', ['idea', 'planned'], 'planned'],
    [
      'a ticket moved past planned (idea + in-progress) -> in-progress',
      ['idea', 'in-progress'],
      'in-progress',
    ],
    [
      'a ticket moved past planned (planned + review) -> in-progress',
      ['planned', 'review'],
      'in-progress',
    ],
    ['every ticket done -> review, never done', ['done', 'done'], 'review'],
    ['every ticket resolved, mixing done and dropped -> review', ['done', 'dropped'], 'review'],
    ['every ticket dropped -> review', ['dropped', 'dropped'], 'review'],
  ])('%s', (_description, ticketStatuses, expected) => {
    expect(deriveBoardStatus(ticketStatuses)).toBe(expected);
  });
});
