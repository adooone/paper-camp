export interface DiffToken {
  type: 'same' | 'added' | 'removed';
  text: string;
}

/**
 * Word-level diff via LCS, for comparing short prose (plan body, phase text/
 * description) rather than whole files. O(n*m) — fine for the short strings
 * a reconcile pass rewrites, not meant for large documents.
 */
export function diffWords(before: string, after: string): DiffToken[] {
  const a = before.split(/(\s+)/).filter((t) => t !== '');
  const b = after.split(/(\s+)/).filter((t) => t !== '');
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      tokens.push({ type: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    tokens.push({ type: 'removed', text: a[i] });
    i++;
  }
  while (j < m) {
    tokens.push({ type: 'added', text: b[j] });
    j++;
  }

  return mergeAdjacent(tokens);
}

function mergeAdjacent(tokens: DiffToken[]): DiffToken[] {
  const merged: DiffToken[] = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.type === token.type) {
      last.text += token.text;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}
