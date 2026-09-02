#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// paper-ui ships no src/components, but its bundle's source map embeds every
// original .tsx in sourcesContent — so component source is readable in-workspace.
const MAP = 'node_modules/@dendelion/paper-ui/dist/index.cjs.map';

function loadMap() {
  try {
    return JSON.parse(readFileSync(MAP, 'utf-8'));
  } catch {
    console.error(`Could not read ${MAP}. Run \`pnpm install\` first.`);
    process.exit(1);
  }
}

const { sources, sourcesContent } = loadMap();
const query = process.argv[2];

if (!query) {
  const names = sources
    .filter((s) => s.includes('/components/'))
    .map((s) => s.replace(/^.*\/components\//, '').replace(/\.tsx$/, ''));
  console.log(`Usage: node scripts/paper-ui-source.mjs <name>\n\n${names.sort().join('\n')}`);
  process.exit(0);
}

const matches = sources
  .map((source, index) => ({ source, index }))
  .filter(({ source }) => source.toLowerCase().includes(query.toLowerCase()));

if (matches.length === 0) {
  console.error(`No paper-ui source matches "${query}". Run without arguments to list components.`);
  process.exit(1);
}

for (const { source, index } of matches) {
  console.log(`===== ${source.replace(/^\.\.\//, '')} =====`);
  console.log(sourcesContent[index]);
}
