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

describe('no-default-agents', () => {
  it('warns when config.json chooses no agents, and not when it does', () => {
    const base = { files: [], hasPermissionsAllow: true };
    const without = runDoctorChecks({ ...base, config: { nextId: { idea: 1 } } } as never);
    expect(without).toContainEqual(expect.objectContaining({ rule: 'no-default-agents' }));
    const withAgents = runDoctorChecks({
      ...base,
      config: { nextId: { idea: 1 }, defaultAgents: { phase: { agent: 'claude-code' } } },
    } as never);
    expect(withAgents).not.toContainEqual(expect.objectContaining({ rule: 'no-default-agents' }));
  });
});

describe('collectDoctorContext draft-pr templates', () => {
  it('reports both files as missing (null) when neither exists', async () => {
    const root = await makeTempDir('papercamp-doctor-draft-pr-missing-');
    const paperCampDir = await makePaperCampDir(root);

    const context = await collectDoctorContext(paperCampDir);

    expect(context.draftPrWorkflowContent).toBeNull();
    expect(context.pullRequestTemplateContent).toBeNull();
  });

  it('reads existing file contents', async () => {
    const root = await makeTempDir('papercamp-doctor-draft-pr-present-');
    const paperCampDir = await makePaperCampDir(root);
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(root, '.github', 'workflows', 'draft-pr.yml'),
      '# paper-camp draft-pr template v1\nname: Draft PR\n',
      'utf-8',
    );
    await writeFile(
      join(root, '.github', 'pull_request_template.md'),
      '<!-- paper-camp draft-pr template v1 -->\nbody\n',
      'utf-8',
    );

    const context = await collectDoctorContext(paperCampDir);

    expect(context.draftPrWorkflowContent).toContain('name: Draft PR');
    expect(context.pullRequestTemplateContent).toContain('body');
  });
});
