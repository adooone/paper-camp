import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { collectDoctorContext, runDoctorChecks } from './doctor';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function makePaperCampDir(root: string): Promise<string> {
  const paperCampDir = join(root, 'papercamp');
  await mkdir(join(paperCampDir, 'ideas'), { recursive: true });
  return paperCampDir;
}

describe('collectDoctorContext hasPermissionsAllow', () => {
  it('is false when there is no .claude/settings.json', async () => {
    const root = await makeTempDir('papercamp-doctor-no-settings-');
    const paperCampDir = await makePaperCampDir(root);

    const context = await collectDoctorContext(paperCampDir);

    expect(context.hasPermissionsAllow).toBe(false);
  });

  it('is false when settings.json has no permissions.allow', async () => {
    const root = await makeTempDir('papercamp-doctor-settings-no-allow-');
    const paperCampDir = await makePaperCampDir(root);
    await mkdir(join(root, '.claude'), { recursive: true });
    await writeFile(join(root, '.claude', 'settings.json'), '{"hooks":{}}\n', 'utf-8');

    const context = await collectDoctorContext(paperCampDir);

    expect(context.hasPermissionsAllow).toBe(false);
  });

  it('is true when settings.json has a non-empty permissions.allow', async () => {
    const root = await makeTempDir('papercamp-doctor-settings-allow-');
    const paperCampDir = await makePaperCampDir(root);
    await mkdir(join(root, '.claude'), { recursive: true });
    await writeFile(
      join(root, '.claude', 'settings.json'),
      '{"permissions":{"allow":["Edit(src/**)"]}}\n',
      'utf-8',
    );

    const context = await collectDoctorContext(paperCampDir);

    expect(context.hasPermissionsAllow).toBe(true);
    expect(runDoctorChecks(context)).toEqual([]);
  });

  it('flows into runDoctorChecks as a missing-permissions-allow finding', async () => {
    const root = await makeTempDir('papercamp-doctor-settings-finding-');
    const paperCampDir = await makePaperCampDir(root);

    const context = await collectDoctorContext(paperCampDir);
    const findings = runDoctorChecks(context);

    expect(findings).toContainEqual(expect.objectContaining({ rule: 'missing-permissions-allow' }));
  });
});
