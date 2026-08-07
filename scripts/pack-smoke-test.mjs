import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
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

async function main() {
  const packDir = await mkdtemp(join(tmpdir(), 'paper-camp-pack-'));
  const extractDir = await mkdtemp(join(tmpdir(), 'paper-camp-extract-'));
  let campServer;
  let viteServer;
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

    const campPort = await getFreePort();
    campServer = spawn(
      'node',
      [join(packageDir, 'dist', 'cli', 'index.js'), 'dev', '--port', String(campPort)],
      { cwd: extractDir, stdio: 'ignore' },
    );
    await waitForServer(`http://localhost:${campPort}/toolbar.js`, 10000);

    const pluginPath = join(packageDir, 'dist', 'vite', 'index.js');
    const { paperCamp } = await import(pathToFileURL(pluginPath).href);

    const hostPort = await getFreePort();
    viteServer = await createViteServer({
      configFile: false,
      root: extractDir,
      logLevel: 'silent',
      plugins: [paperCamp({ port: campPort })],
      server: { port: hostPort, strictPort: true },
    });
    await viteServer.listen();

    const response = await fetch(`http://localhost:${hostPort}/paper-camp/toolbar.js`);
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`/paper-camp/toolbar.js responded with status ${response.status}`);
    }
    if (!contentType.includes('javascript')) {
      throw new Error(
        `/paper-camp/toolbar.js served content-type "${contentType}", expected JavaScript`,
      );
    }
    if (body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')) {
      throw new Error(
        '/paper-camp/toolbar.js served an HTML fallback instead of the toolbar bundle',
      );
    }

    console.log('/paper-camp/toolbar.js served as JavaScript through a packed tarball.');
  } finally {
    if (viteServer) await viteServer.close();
    await stopProcess(campServer);
    await rm(packDir, { recursive: true, force: true });
    await rm(extractDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
