import type { DoctorCheck, DoctorEntityFile } from '../doctor';
import type { DoctorFinding } from '../finding';
import type { DoctorRuleId } from '../rules';

const RELATIVE_ASSET_LINK_RE = /\]\(assets\/([^)/]+)\)/g;
const CROSS_IDEA_ASSET_LINK_RE = /\]\(\.\.\/assets\/([^)/]+)\/([^)/]+)\)/g;

const DEFAULT_ASSET_MAX_BYTES = 5 * 1024 * 1024;

function mk(
  file: DoctorEntityFile,
  line: number,
  rule: DoctorRuleId,
  message: string,
): DoctorFinding {
  return { file: file.path, line, rule, message };
}

const checkAssetOrphanFolder: DoctorCheck = ({ files, assetFolders }) => {
  if (!assetFolders?.length) return [];
  const known = new Set(files.map((file) => file.id));
  return assetFolders
    .filter((folder) => !known.has(folder.id))
    .map((folder) => ({
      file: `papercamp/assets/${folder.id}`,
      line: 1,
      rule: 'asset-orphan-folder' as DoctorRuleId,
      message: `folder id "${folder.id}" matches no entity in the corpus`,
    }));
};

const checkAssetOversized: DoctorCheck = ({ assetFolders, assetMaxBytes }) => {
  if (!assetFolders?.length) return [];
  const maxBytes = assetMaxBytes ?? DEFAULT_ASSET_MAX_BYTES;
  const maxMb = maxBytes / (1024 * 1024);
  return assetFolders.flatMap((folder) =>
    folder.files
      .filter((f) => f.size > maxBytes)
      .map((f) => ({
        file: `papercamp/assets/${folder.id}/${f.name}`,
        line: 1,
        rule: 'asset-oversized' as DoctorRuleId,
        message: `${(f.size / (1024 * 1024)).toFixed(1)}MB exceeds the ${maxMb}MB per-file limit`,
      })),
  );
};

const checkAssetDanglingLink: DoctorCheck = ({ files, assetFolders }) => {
  const folderFiles = new Map<string, Set<string>>(
    (assetFolders ?? []).map((folder) => [folder.id, new Set(folder.files.map((f) => f.name))]),
  );

  return files.flatMap((file) => {
    const lines = file.content.split('\n');
    const findings: DoctorFinding[] = [];
    for (let i = 0; i < lines.length; i++) {
      for (const match of lines[i].matchAll(RELATIVE_ASSET_LINK_RE)) {
        const [, name] = match;
        if (!folderFiles.get(file.id)?.has(name)) {
          findings.push(mk(file, i + 1, 'asset-dangling-link', `assets/${name} does not exist`));
        }
      }
      for (const match of lines[i].matchAll(CROSS_IDEA_ASSET_LINK_RE)) {
        const [, id, name] = match;
        if (!folderFiles.get(id)?.has(name)) {
          findings.push(
            mk(file, i + 1, 'asset-dangling-link', `../assets/${id}/${name} does not exist`),
          );
        }
      }
    }
    return findings;
  });
};

export const assetChecks: DoctorCheck[] = [
  checkAssetOrphanFolder,
  checkAssetOversized,
  checkAssetDanglingLink,
];
