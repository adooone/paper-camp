#!/usr/bin/env node
// Reports the comment-line ratio across src/ — informational only, never fails.
// `--json` emits machine-readable output for the app's future stats view.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const asJson = process.argv.includes('--json');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
  }
})(ROOT);

let totalLines = 0;
let totalComments = 0;
const perFile = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  let comments = 0;
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (inBlock) {
      comments++;
      if (line.includes('*/')) inBlock = false;
    } else if (line.startsWith('//')) {
      comments++;
    } else if (line.startsWith('/*') || line.startsWith('{/*')) {
      comments++;
      if (!line.slice(line.indexOf('/*') + 2).includes('*/')) inBlock = true;
    }
  }
  totalLines += lines.length;
  totalComments += comments;
  if (comments > 0) perFile.push([file, comments]);
}

const ratio = (totalComments / totalLines) * 100;

if (asJson) {
  perFile.sort((a, b) => b[1] - a[1]);
  console.log(
    JSON.stringify({
      commentLines: totalComments,
      sourceLines: totalLines,
      ratio: Number(ratio.toFixed(3)),
      topFiles: perFile.slice(0, 10).map(([file, count]) => ({ file, count })),
    }),
  );
} else {
  console.log(`Comments: ${totalComments} / ${totalLines} lines = ${ratio.toFixed(2)}%`);
}
