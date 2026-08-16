export interface SplitPath {
  dir: string;
  base: string;
}

export function splitPathForDisplay(path: string): SplitPath {
  const slash = path.lastIndexOf('/');
  return slash === -1
    ? { dir: '', base: path }
    : { dir: path.slice(0, slash + 1), base: path.slice(slash + 1) };
}
