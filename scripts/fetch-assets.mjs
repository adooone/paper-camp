import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const doodlesDir = join(repoRoot, 'public', 'img', 'doodles');

async function main() {
  const url = process.env.PAPERCAMP_ASSETS_URL?.trim();
  if (!url) {
    console.log('fetch-assets: PAPERCAMP_ASSETS_URL is not set, skipping the doodle pack.');
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch-assets: ${url} responded with status ${response.status}`);
  }
  const archive = Buffer.from(await response.arrayBuffer());

  const workDir = await mkdtemp(join(tmpdir(), 'paper-camp-assets-'));
  try {
    const archivePath = join(workDir, 'doodles.tar.gz');
    await writeFile(archivePath, archive);

    await rm(doodlesDir, { recursive: true, force: true });
    await mkdir(doodlesDir, { recursive: true });

    const extract = spawnSync('tar', ['-xzf', archivePath, '-C', doodlesDir], {
      encoding: 'utf-8',
    });
    if (extract.status !== 0) {
      throw new Error(`fetch-assets: tar extraction failed:\n${extract.stderr}`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  console.log(`fetch-assets: unpacked the doodle pack into ${doodlesDir}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
