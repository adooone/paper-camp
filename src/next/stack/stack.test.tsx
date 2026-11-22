import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/app/stores/app-store';
import { dismissQueueSummary, stopQueue, stopTask } from '../shell/stack-actions';
import { Sheet } from '../ui/sheet';
import { NoticeCard, QueueCard, TaskCard } from './task-card';

const render = (element: ReactElement): string => renderToStaticMarkup(element);
const noop = () => {};

const view = {
  title: 'Phase 1: IDEA-7',
  meta: 'Claude · now',
  stamp: { meaning: 'running' as const, label: 'running' },
  signedOut: false,
  live: true,
  stopping: false,
};

describe('Stack panel actions go through the shared agent store', () => {
  const original = useAppStore.getState();
  afterEach(() => useAppStore.setState(original, true));

  it('stops a run by its task id, as the desk does', async () => {
    const stopAgent = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ stopAgent });
    await stopTask('r1');
    expect(stopAgent).toHaveBeenCalledWith('r1');
  });

  it('stops the queue and dismisses its report through the batch slice', async () => {
    const controlBatch = vi.fn().mockResolvedValue(undefined);
    const dismissBatchSummary = vi.fn();
    useAppStore.setState({ controlBatch, dismissBatchSummary });
    await stopQueue();
    dismissQueueSummary();
    expect(controlBatch).toHaveBeenCalledWith('stop');
    expect(dismissBatchSummary).toHaveBeenCalledOnce();
  });
});

describe('run cards', () => {
  it('offers Stop agent only for a live run', () => {
    const live = render(<TaskCard view={view} onOpen={noop} onStop={noop} onSignIn={noop} />);
    expect(live).toContain('Stop agent');
    const done = render(
      <TaskCard
        view={{ ...view, live: false, stamp: { meaning: 'done', label: 'done' } }}
        onOpen={noop}
        onStop={noop}
        onSignIn={noop}
      />,
    );
    expect(done).not.toContain('Stop agent');
  });

  it('disables Stop while a run is stopping and tags a cross-project run', () => {
    const html = render(
      <TaskCard
        view={{ ...view, stopping: true }}
        chip="other-project"
        onOpen={noop}
        onStop={noop}
        onSignIn={noop}
      />,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Stop agent/s);
    expect(html).toContain('other-project');
  });

  it('makes the signed-out stamp a way to sign back in', () => {
    const html = render(
      <TaskCard
        view={{
          ...view,
          live: false,
          signedOut: true,
          stamp: { meaning: 'failed', label: 'stopped — agent signed out' },
        }}
        onOpen={noop}
        onStop={noop}
        onSignIn={noop}
      />,
    );
    expect(html).toMatch(/<button[^>]*><span[^>]*>stopped — agent signed out/);
  });

  it('swaps the queue card between Stop queue and Dismiss', () => {
    const queue = {
      title: 'Run queue — 1/3',
      line: 'queued',
      stamp: { meaning: 'running' as const, label: 'running' },
      canStop: true,
      canDismiss: false,
    };
    expect(render(<QueueCard view={queue} onStop={noop} onDismiss={noop} />)).toContain(
      'Stop queue',
    );
    const report = render(
      <QueueCard
        view={{ ...queue, canStop: false, canDismiss: true }}
        onStop={noop}
        onDismiss={noop}
      />,
    );
    expect(report).toContain('Dismiss');
    expect(report).not.toContain('Stop queue');
  });

  it('lets an interrupted-run notice be dismissed', () => {
    const html = render(<NoticeCard title="IDEA-7" onOpen={noop} onDismiss={noop} />);
    expect(html).toContain('A run was interrupted; run again');
    expect(html).toContain('Dismiss');
  });
});

describe('chalk sheet', () => {
  it('rises on the chalkboard rather than the elevated sheet', () => {
    const html = render(
      <Sheet visible onRequestClose={noop} chalk label="Stack">
        <p>body</p>
      </Sheet>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toMatch(/class="[^"]*chalk/);
  });
});
