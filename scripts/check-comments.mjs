#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const MAX_RATIO = 3.5;

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
const summary = `${totalComments} comment lines / ${totalLines} source lines = ${ratio.toFixed(2)}% (budget ${MAX_RATIO}%)`;
if (ratio > MAX_RATIO) {
  perFile.sort((a, b) => b[1] - a[1]);
  console.error(`Comment ratio over budget: ${summary}`);
  for (const [file, count] of perFile.slice(0, 10)) {
    console.error(`  ${String(count).padStart(4)}  ${file}`);
  }
  console.error(
    'CODE_STYLE.md §7: comments default to zero — reasoning goes in the commit message.',
  );
  process.exit(1);
}
console.log(`Comment ratio OK: ${summary}`);
