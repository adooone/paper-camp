import { spawnSync } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliEntry = join(repoRoot, 'dist', 'cli', 'index.js');

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolvePort(port));
    });
  });
}

function runCli(args, env, cwd = repoRoot) {
  const result = spawnSync('node', [cliEntry, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    timeout: 25000,
  });
  if (result.error) throw result.error;
  return result;
}

function assertIncludes(haystack, needle, description) {
  if (!haystack.includes(needle)) {
    throw new Error(`${description}\n--- output ---\n${haystack}`);
  }
}

function firstSlug(lsOutput) {
  const firstLine = lsOutput.trim().split('\n')[0] ?? '';
  const slug = firstLine.trim().split(/\s+/)[0];
  if (!slug) throw new Error(`Could not find a slug in \`ls\` output:\n${lsOutput}`);
  return slug;
}

async function main() {
  await access(cliEntry).catch(() => {
    throw new Error(`${cliEntry} not found — run \`pnpm run build\` first.`);
  });

  const configDir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-smoke-config-'));
  const projectDir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-smoke-project-'));
  const env = { PAPERCAMP_CONFIG_DIR: configDir };

  try {
    const statusBeforeInit = runCli(['status'], env);
    assertIncludes(
      statusBeforeInit.stdout,
      'paper-camp: daemon is not running',
      '`status` should report no daemon running before anything is set up',
    );

    const init = runCli(['init'], env, projectDir);
    if (init.status !== 0) throw new Error(`\`init\` failed:\n${init.stderr}`);

    const lsUnregisteredDaemon = runCli(['ls'], env);
    const slug = firstSlug(lsUnregisteredDaemon.stdout);
    assertIncludes(lsUnregisteredDaemon.stdout, '—', '`ls` should show "—" with no daemon running');

    const port = await getFreePort();
    const start = runCli(['start', '-p', String(port)], env);
    if (start.status !== 0) throw new Error(`\`start\` failed:\n${start.stdout}\n${start.stderr}`);
    assertIncludes(start.stdout, 'Paper Camp v', '`start` should print the daemon banner');
    assertIncludes(start.stdout, `http://localhost:${port}`, '`start` should print the Local URL');

    const statusRunning = runCli(['status'], env);
    assertIncludes(
      statusRunning.stdout,
      'daemon running',
      '`status` should report the daemon running',
    );
    assertIncludes(
      statusRunning.stdout,
      `${slug}  idle`,
      '`status` should list the project as idle',
    );

    const mountResponse = await fetch(`http://localhost:${port}/p/${slug}/`);
    if (!mountResponse.ok) {
      throw new Error(`Mounting "${slug}" responded with status ${mountResponse.status}`);
    }

    const lsMounted = runCli(['ls'], env);
    assertIncludes(
      lsMounted.stdout,
      `${slug}  mounted`,
      '`ls` should report the project as mounted',
    );

    const logs = runCli(['logs'], env);
    assertIncludes(
      logs.stdout,
      'Paper Camp v',
      '`logs` should print the daemon banner it started with',
    );

    const pidBeforeRestart = /pid (\d+)/.exec(statusRunning.stdout)?.[1];
    const restart = runCli(['restart'], env);
    if (restart.status !== 0)
      throw new Error(`\`restart\` failed:\n${restart.stdout}\n${restart.stderr}`);
    assertIncludes(
      restart.stdout,
      'paper-camp: daemon stopped',
      '`restart` should stop the old daemon',
    );
    assertIncludes(
      restart.stdout,
      `http://localhost:${port}`,
      '`restart` should reuse the recorded port',
    );

    const statusAfterRestart = runCli(['status'], env);
    const pidAfterRestart = /pid (\d+)/.exec(statusAfterRestart.stdout)?.[1];
    if (!pidAfterRestart || pidAfterRestart === pidBeforeRestart) {
      throw new Error(
        `\`restart\` should bring up a new process (before: ${pidBeforeRestart}, after: ${pidAfterRestart})`,
      );
    }

    const stop = runCli(['stop'], env);
    assertIncludes(
      stop.stdout,
      'paper-camp: daemon stopped',
      '`stop` should confirm the daemon stopped',
    );

    const statusAfterStop = runCli(['status'], env);
    assertIncludes(
      statusAfterStop.stdout,
      'paper-camp: daemon is not running',
      '`status` should report not running again after `stop`',
    );
    assertIncludes(
      statusAfterStop.stdout,
      '—',
      '`status` should list the project as "—" again after `stop`',
    );

    console.log('paper-camp start/status/ls/logs/restart/stop lifecycle verified end to end.');
  } finally {
    runCli(['stop'], env);
    await rm(configDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
