import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { killWithEscalation, runProcessWithTimeout } from './agent-process';

interface FakeProc {
  killed: boolean;
  exitCode: number | null;
  signalCode: string | null;
  kill: (signal?: string | number) => boolean;
  on: EventEmitter['on'];
  emit: EventEmitter['emit'];
}

function makeFakeProc(): FakeProc {
  const emitter = new EventEmitter();
  const proc: FakeProc = {
    killed: false,
    exitCode: null,
    signalCode: null,
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
    kill: vi.fn((signal?: string | number) => {
      proc.killed = true;
      if (signal === 'SIGKILL') {
        proc.exitCode = null;
        proc.signalCode = 'SIGKILL';
        proc.emit('close', null);
      }
      return true;
    }),
  };
  return proc;
}

function asChildProcess(proc: FakeProc): ChildProcess {
  return proc as unknown as ChildProcess;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('killWithEscalation', () => {
  it('sends SIGTERM immediately and SIGKILL after the grace period if still running', () => {
    const proc = makeFakeProc();
    killWithEscalation(asChildProcess(proc), 5000);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    vi.advanceTimersByTime(4999);
    expect(proc.kill).not.toHaveBeenCalledWith('SIGKILL');
    vi.advanceTimersByTime(1);
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('skips SIGKILL once the process already exited on its own', () => {
    const proc = makeFakeProc();
    killWithEscalation(asChildProcess(proc), 5000);
    proc.exitCode = 0;
    vi.advanceTimersByTime(5000);
    expect(proc.kill).not.toHaveBeenCalledWith('SIGKILL');
  });
});

describe('runProcessWithTimeout', () => {
  it('kills the process once lastStreamAt is older than the idle limit', async () => {
    const proc = makeFakeProc();
    const lastStreamAt = Date.now();
    const result = runProcessWithTimeout(
      asChildProcess(proc),
      30 * 60 * 1000,
      2 * 60 * 60 * 1000,
      () => lastStreamAt,
    );
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toEqual({ ok: false, timedOut: true });
  });

  it('survives past the idle limit as long as lastStreamAt keeps advancing', async () => {
    const proc = makeFakeProc();
    let lastStreamAt = Date.now();
    const result = runProcessWithTimeout(
      asChildProcess(proc),
      30 * 60 * 1000,
      2 * 60 * 60 * 1000,
      () => lastStreamAt,
    );
    for (let minute = 0; minute < 40; minute++) {
      await vi.advanceTimersByTimeAsync(60 * 1000);
      lastStreamAt = Date.now();
    }
    expect(proc.kill).not.toHaveBeenCalled();
    proc.emit('close', 0);
    await expect(result).resolves.toEqual({ ok: true, timedOut: false });
  });

  it('arms only one escalation timer across repeated polls past the timeout', async () => {
    const proc = makeFakeProc();
    const lastStreamAt = Date.now();
    runProcessWithTimeout(
      asChildProcess(proc),
      30 * 60 * 1000,
      2 * 60 * 60 * 1000,
      () => lastStreamAt,
    );
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    const timersAfterFirstTick = vi.getTimerCount();
    await vi.advanceTimersByTimeAsync(3000);
    expect(vi.getTimerCount()).toBe(timersAfterFirstTick);
  });

  it('kills at the wall-clock cap even when lastStreamAt keeps advancing', async () => {
    const proc = makeFakeProc();
    let lastStreamAt = Date.now();
    const result = runProcessWithTimeout(
      asChildProcess(proc),
      30 * 60 * 1000,
      2 * 60 * 60 * 1000,
      () => lastStreamAt,
    );
    for (let minute = 0; minute < 120; minute++) {
      await vi.advanceTimersByTimeAsync(60 * 1000);
      lastStreamAt = Date.now();
    }
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toEqual({ ok: false, timedOut: true });
  });
});
