import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

function fallbackDataRoot() {
  return join(homedir(), '.claude', 'plugins-data', 'hello2cc');
}

export function pluginDataRoot() {
  return String(process.env.CLAUDE_PLUGIN_DATA || '').trim() || fallbackDataRoot();
}

export function readJsonFile(path, fallback = {}) {
  if (!existsSync(path)) return fallback;

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJsonFile(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

export function readPluginDataJson(relativePath, fallback = {}) {
  return readJsonFile(join(pluginDataRoot(), relativePath), fallback);
}

export function writePluginDataJson(relativePath, payload) {
  writeJsonFile(join(pluginDataRoot(), relativePath), payload);
}
