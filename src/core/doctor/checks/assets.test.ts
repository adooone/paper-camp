import { describe, expect, it } from 'vitest';
import type { DoctorAssetFolder, DoctorContext, DoctorEntityFile } from '../doctor';
import { assetChecks } from './assets';

function run(
  files: DoctorEntityFile[],
  assetFolders: DoctorAssetFolder[] = [],
  assetMaxBytes?: number,
) {
  const context: DoctorContext = { files, config: null, assetFolders, assetMaxBytes };
  return assetChecks.flatMap((check) => check(context));
}

function file(id: string, body: string): DoctorEntityFile {
  return {
    id,
    path: `papercamp/ideas/${id}.md`,
    content: `---\nid: ${id}\ntitle: A title\nstatus: idea\ncreated: 2026-01-01\n---\n\n${body}\n`,
    archived: false,
  };
}

describe('checkAssetOrphanFolder', () => {
  it('flags a folder whose id matches no entity', () => {
    const findings = run([file('IDEA-1', 'Body.')], [{ id: 'IDEA-9', files: [] }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('asset-orphan-folder');
  });

  it('does not flag a folder whose id matches an entity', () => {
    const findings = run([file('IDEA-1', 'Body.')], [{ id: 'IDEA-1', files: [] }]);
    expect(findings).toHaveLength(0);
  });
});

describe('checkAssetOversized', () => {
  it('flags a file over the limit', () => {
    const findings = run(
      [file('IDEA-1', 'Body.')],
      [{ id: 'IDEA-1', files: [{ name: 'big.png', size: 10 * 1024 * 1024 }] }],
      5 * 1024 * 1024,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('asset-oversized');
  });

  it('does not flag a file under the limit', () => {
    const findings = run(
      [file('IDEA-1', 'Body.')],
      [{ id: 'IDEA-1', files: [{ name: 'small.png', size: 1024 }] }],
      5 * 1024 * 1024,
    );
    expect(findings).toHaveLength(0);
  });
});

describe('checkAssetDanglingLink', () => {
  it('flags a relative link to a file that does not exist', () => {
    const findings = run(
      [file('IDEA-1', '[mockup](assets/mockup.html)')],
      [{ id: 'IDEA-1', files: [] }],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('asset-dangling-link');
  });

  it('does not flag a relative link to a file that exists', () => {
    const findings = run(
      [file('IDEA-1', '[mockup](assets/mockup.html)')],
      [{ id: 'IDEA-1', files: [{ name: 'mockup.html', size: 10 }] }],
    );
    expect(findings).toHaveLength(0);
  });

  it('flags a cross-idea link to a file that does not exist', () => {
    const findings = run(
      [file('IDEA-1', '[mockup](../assets/IDEA-2/mockup.html)'), file('IDEA-2', 'Body.')],
      [{ id: 'IDEA-2', files: [] }],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('asset-dangling-link');
  });

  it('does not flag a cross-idea link to a file that exists', () => {
    const findings = run(
      [file('IDEA-1', '[mockup](../assets/IDEA-2/mockup.html)'), file('IDEA-2', 'Body.')],
      [{ id: 'IDEA-2', files: [{ name: 'mockup.html', size: 10 }] }],
    );
    expect(findings).toHaveLength(0);
  });
});
