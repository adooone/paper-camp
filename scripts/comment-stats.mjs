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

const RUN_CAP = 2;
const TRAILING_COMMENT = /(?<!:)\/\//;

let totalLines = 0;
let totalComments = 0;
let totalTrailing = 0;
const perFile = [];
const overCapRuns = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  let comments = 0;
  let inBlock = false;
  let runStart = null;
  let runLength = 0;
  const endRun = () => {
    if (runLength > RUN_CAP) overCapRuns.push({ file, startLine: runStart, length: runLength });
    runStart = null;
    runLength = 0;
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    let isCommentLine = false;
    if (inBlock) {
      isCommentLine = true;
      comments++;
      if (line.includes('*/')) inBlock = false;
    } else if (line.startsWith('//')) {
      isCommentLine = true;
      comments++;
    } else if (line.startsWith('/*') || line.startsWith('{/*')) {
      isCommentLine = true;
      comments++;
      if (!line.slice(line.indexOf('/*') + 2).includes('*/')) inBlock = true;
    } else if (line !== '' && TRAILING_COMMENT.test(line)) {
      totalTrailing++;
    }
    if (isCommentLine) {
      if (runStart === null) runStart = i + 1;
      runLength++;
    } else {
      endRun();
    }
  });
  endRun();
  totalLines += lines.length;
  totalComments += comments;
  if (comments > 0) perFile.push([file, comments]);
}

const ratio = totalLines === 0 ? 0 : (totalComments / totalLines) * 100;
const overCapLines = overCapRuns.reduce((sum, run) => sum + run.length, 0);

if (asJson) {
  perFile.sort((a, b) => b[1] - a[1]);
  console.log(
    JSON.stringify({
      commentLines: totalComments,
      sourceLines: totalLines,
      ratio: Number(ratio.toFixed(3)),
      topFiles: perFile.slice(0, 10).map(([file, count]) => ({ file, count })),
      trailingComments: totalTrailing,
      overCapRuns,
      overCapLines,
    }),
  );
} else {
  console.log(`Comments: ${totalComments} / ${totalLines} lines = ${ratio.toFixed(2)}%`);
  console.log(`Trailing comment lines (code; // why): ${totalTrailing}`);
  console.log(`Runs over the ${RUN_CAP}-line cap: ${overCapRuns.length} (${overCapLines} lines)`);
  for (const run of overCapRuns) {
    console.log(`  ${run.file}:${run.startLine} — ${run.length} lines`);
  }
}
