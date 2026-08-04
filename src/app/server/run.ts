import { spawn } from 'node:child_process';

export interface ProbeResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function run(command: string, args: string[], cwd: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
      killSignal: 'SIGTERM',
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    // Missing binary: spawn emits 'error' instead of 'close'.
    proc.on('error', () => resolve({ code: null, stdout: '', stderr: '' }));
  });
}
