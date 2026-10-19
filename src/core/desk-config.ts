import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeskConfig } from '../types/index';
import { deskConfigSchema } from './parse';

export function loadDeskConfig(root: string): DeskConfig {
  let raw: string;
  try {
    raw = readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8');
  } catch {
    return {};
  }
  try {
    const parsed = deskConfigSchema.safeParse(JSON.parse(raw).desk ?? {});
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
