import { join } from 'node:path';
import { readJsonFile } from './plugin-data.mjs';

export function pluginRoot() {
  return String(process.env.CLAUDE_PLUGIN_ROOT || '').trim() || process.cwd();
}

export function pluginVersion() {
  const pkg = readJsonFile(join(pluginRoot(), 'package.json'), {});
  return String(pkg.version || '0.0.0').trim() || '0.0.0';
}
