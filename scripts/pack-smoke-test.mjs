import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer as createViteServer } from 'vite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} responded with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveExit) => setTimeout(resolveExit, 2000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function runCli(entry, args, env, cwd) {
  const result = spawnSync('node', [entry, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    timeout: 25000,
  });
  if (result.error) throw result.error;
  return result;
}

async function main() {
  const packDir = await mkdtemp(join(tmpdir(), 'paper-camp-pack-'));
  const extractDir = await mkdtemp(join(tmpdir(), 'paper-camp-extract-'));
  const configDir = await mkdtemp(join(tmpdir(), 'paper-camp-pack-config-'));
  const projectDir = await mkdtemp(join(tmpdir(), 'paper-camp-pack-project-'));
  const strangerDir = await mkdtemp(join(tmpdir(), 'paper-camp-pack-stranger-'));
  // A throwaway daemon must never replace the runner's global install at boot.
  const env = { PAPERCAMP_CONFIG_DIR: configDir, PAPERCAMP_SKIP_UPDATE_CHECK: '1' };
  process.env.PAPERCAMP_CONFIG_DIR = configDir;
  let daemon;
  let cliEntry;
  const viteServers = [];
  try {
    const pack = spawnSync('pnpm', ['pack', '--pack-destination', packDir], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    if (pack.status !== 0) throw new Error(`pnpm pack failed:\n${pack.stderr}`);

    const tarball = (await readdir(packDir)).find((name) => name.endsWith('.tgz'));
    if (!tarball) throw new Error('pnpm pack produced no tarball');

    const extract = spawnSync('tar', ['-xzf', join(packDir, tarball), '-C', extractDir], {
      encoding: 'utf-8',
    });
    if (extract.status !== 0) throw new Error(`tar extraction failed:\n${extract.stderr}`);

    const packageDir = join(extractDir, 'package');
    await symlink(join(repoRoot, 'node_modules'), join(packageDir, 'node_modules'), 'dir');

    const distEntries = await readdir(join(packageDir, 'dist'));
    if (distEntries.includes('app')) {
      throw new Error('tarball contains dist/app — the runtime must ship no dashboard frontend');
    }

    cliEntry = join(packageDir, 'dist', 'cli', 'index.js');
    const init = runCli(cliEntry, ['init'], env, projectDir);
    if (init.status !== 0) throw new Error(`\`init\` failed:\n${init.stderr}`);
    const ls = runCli(cliEntry, ['ls'], env, projectDir);
    const slug = (ls.stdout.trim().split('\n')[0] ?? '').trim().split(/\s+/)[0];
    if (!slug) throw new Error(`Could not find a slug in \`ls\` output:\n${ls.stdout}`);

    const daemonPort = await getFreePort();
    daemon = spawn('node', [cliEntry, 'daemon', '-p', String(daemonPort)], {
      cwd: projectDir,
      env: { ...process.env, ...env },
      stdio: 'ignore',
    });
    await waitForServer(`http://localhost:${daemonPort}/api/machine/projects`, 15000);

    const pluginPath = join(packageDir, 'dist', 'vite', 'index.js');
    const { paperCamp } = await import(pathToFileURL(pluginPath).href);

    await writeFile(join(projectDir, 'index.html'), '<!doctype html><html><body></body></html>\n');
    const hostPort = await getFreePort();
    const host = await createViteServer({
      configFile: false,
      root: projectDir,
      logLevel: 'silent',
      plugins: [paperCamp()],
      server: { port: hostPort, strictPort: true },
    });
    viteServers.push(host);
    await host.listen();

    const mount = `/p/${slug}`;
    const toolbarUrl = `http://localhost:${daemonPort}${mount}/toolbar.js`;
    const html = await (await fetch(`http://localhost:${hostPort}/`)).text();
    if (!html.includes(`src="${toolbarUrl}"`)) {
      throw new Error(`host index.html lacks the toolbar script tag for ${toolbarUrl}:\n${html}`);
    }
    if (!html.includes(`data-route="${mount}"`)) {
      throw new Error(`toolbar script tag lacks data-route="${mount}":\n${html}`);
    }
    console.log(`paperCamp() injected ${toolbarUrl} into a registered host app.`);

    const origin = `http://localhost:${hostPort}`;
    const response = await fetch(toolbarUrl, { headers: { Origin: origin } });
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`${toolbarUrl} responded with status ${response.status}`);
    }
    if (!contentType.includes('javascript')) {
      throw new Error(`${toolbarUrl} served content-type "${contentType}", expected JavaScript`);
    }
    if (body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')) {
      throw new Error(`${toolbarUrl} served an HTML fallback instead of the toolbar bundle`);
    }
    if (response.headers.get('access-control-allow-origin') !== origin) {
      throw new Error(
        `${toolbarUrl} answered origin ${origin} with access-control-allow-origin "${response.headers.get('access-control-allow-origin')}"`,
      );
    }
    console.log(
      'The daemon served the toolbar bundle as JavaScript with CORS for the host origin.',
    );

    await writeFile(join(strangerDir, 'index.html'), '<!doctype html><html><body></body></html>\n');
    const strangerPort = await getFreePort();
    const notices = [];
    const originalLog = console.log;
    console.log = (...args) => notices.push(args.join(' '));
    let stranger;
    try {
      stranger = await createViteServer({
        configFile: false,
        root: strangerDir,
        logLevel: 'silent',
        plugins: [paperCamp()],
        server: { port: strangerPort, strictPort: true },
      });
      viteServers.push(stranger);
      await stranger.listen();
    } finally {
      console.log = originalLog;
    }
    const strangerHtml = await (await fetch(`http://localhost:${strangerPort}/`)).text();
    if (strangerHtml.includes('toolbar.js')) {
      throw new Error(`an unregistered host app received the toolbar script:\n${strangerHtml}`);
    }
    if (!notices.some((line) => line.includes('paper-camp: toolbar off'))) {
      throw new Error(
        `an unregistered host app did not print the toolbar-off notice:\n${notices.join('\n')}`,
      );
    }
    console.log('An unregistered host app got the off notice and no script tag.');
  } finally {
    for (const server of viteServers) await server.close();
    if (cliEntry) runCli(cliEntry, ['stop'], env, projectDir);
    await stopProcess(daemon);
    for (const dir of [packDir, extractDir, configDir, projectDir, strangerDir]) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
