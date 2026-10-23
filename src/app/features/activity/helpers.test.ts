import type { ScopeRow } from '@/app/features/scope';
import { describe, expect, it, vi } from 'vitest';
import { markAllReadSettled, markReadOrToast } from './helpers';

describe('markReadOrToast', () => {
  it('resolves quietly when markRead succeeds', async () => {
    const onFailure = vi.fn();
    await markReadOrToast('abc', () => Promise.resolve(), onFailure);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('calls onFailure instead of throwing when markRead rejects', async () => {
    const onFailure = vi.fn();
    await expect(
      markReadOrToast('abc', () => Promise.reject(new Error('boom')), onFailure),
    ).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledOnce();
  });
});

describe('markAllReadSettled', () => {
  const project = { runtimeUrl: 'http://other' } as ScopeRow;

  it('does not call onFailure when every mark succeeds', async () => {
    const onFailure = vi.fn();
    await markAllReadSettled(
      ['a', 'b'],
      [{ project, id: 'c' }],
      () => Promise.resolve(),
      () => Promise.resolve(),
      onFailure,
    );
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('runs every id even after one rejects, and reports the failure count once', async () => {
    const own = vi.fn((id: string) =>
      id === 'b' ? Promise.reject(new Error('boom')) : Promise.resolve(),
    );
    const foreign = vi.fn(() => Promise.reject(new Error('boom')));
    const onFailure = vi.fn();

    await markAllReadSettled(['a', 'b'], [{ project, id: 'c' }], own, foreign, onFailure);

    expect(own).toHaveBeenCalledWith('a');
    expect(own).toHaveBeenCalledWith('b');
    expect(foreign).toHaveBeenCalledWith(project, 'c');
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(2);
  });
});
