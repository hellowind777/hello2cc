import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureClaudeCli, spawnClaude } from './claude-regression-cli.mjs';
import { fail, ok } from './claude-regression-shared.mjs';

function extractPluginBlock(text, pluginName) {
  const lines = String(text || '').split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(pluginName));
  if (index < 0) {
    return '';
  }

  const block = [lines[index]];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) break;
    if (line.includes('@') && !line.includes(pluginName)) break;
    if (/^\S/.test(line)) break;
    block.push(line);
  }

  return block.join('\n');
}

/**
 * Validates the cached hello2cc plugin install shape exposed by a real Claude session.
 */
export function assertPluginCacheShape(pluginPath, name) {
  if (!pluginPath) {
    fail(`real-session case "${name}" did not expose hello2cc plugin path`);
  }

  const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    fail(`real-session case "${name}" missing cached plugin manifest`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if ('skills' in manifest) {
    fail(`real-session case "${name}" cached manifest still exposes skills`);
  }

  if (existsSync(join(pluginPath, 'skills'))) {
    fail(`real-session case "${name}" cached plugin still ships a skills directory`);
  }

  const settingsPath = join(pluginPath, 'settings.json');
  if (existsSync(settingsPath)) {
    fail(`real-session case "${name}" cached plugin should not ship settings.json or inject a default hello2cc main agent`);
  }

  const agentPath = join(pluginPath, 'agents', 'native.md');
  if (!existsSync(agentPath)) {
    fail(`real-session case "${name}" missing hello2cc native main agent`);
  }

  const outputStylePath = join(pluginPath, 'output-styles', 'hello2cc-native.md');
  if (!existsSync(outputStylePath)) {
    fail(`real-session case "${name}" missing hello2cc native output style`);
  }

  const outputStyleText = readFileSync(outputStylePath, 'utf8');
  if (!/force-for-plugin:\s*true/m.test(outputStyleText)) {
    fail(`real-session case "${name}" output style is not force-for-plugin`);
  }
}

/**
 * Ensures hello2cc is installed and temporarily enabled, returning a restore callback.
 */
export function ensureHello2ccEnabled() {
  const cliPluginCommand = ensureClaudeCli();
  const result = spawnClaude([cliPluginCommand, 'list']);
  if (result.error || result.status !== 0) {
    fail('unable to inspect installed Claude Code plugins');
  }

  const pluginBlock = extractPluginBlock(result.stdout || '', 'hello2cc@hello2cc-local');
  if (!pluginBlock) {
    fail('hello2cc@hello2cc-local is not installed in the current Claude Code environment');
  }

  const scopeMatch = pluginBlock.match(/Scope:\s*(user|project|local)/i);
  const scope = String(scopeMatch?.[1] || '').toLowerCase();
  const scopedArgs = scope ? ['--scope', scope] : [];
  const wasDisabled = /Status:\s*✘\s*disabled/i.test(pluginBlock);
  if (wasDisabled) {
    const enableResult = spawnClaude([cliPluginCommand, 'enable', ...scopedArgs, 'hello2cc@hello2cc-local']);
    if (enableResult.error || enableResult.status !== 0) {
      fail('hello2cc is installed but disabled, and automatic enable failed');
    }
  }

  return {
    restore() {
      if (!wasDisabled) {
        return;
      }

      const disableResult = spawnClaude([cliPluginCommand, 'disable', ...scopedArgs, 'hello2cc@hello2cc-local']);
      if (disableResult.error || disableResult.status !== 0) {
        fail('hello2cc was initially disabled, but restoring the disabled state failed after real-session regression');
      }
    },
  };
}

function createIsolatedClaudeEnv() {
  const root = mkdtempSync(join(tmpdir(), 'hello2cc-real-install-'));
  return {
    HOME: root,
    USERPROFILE: root,
    APPDATA: join(root, 'AppData', 'Roaming'),
    LOCALAPPDATA: join(root, 'AppData', 'Local'),
  };
}

/**
 * Verifies a clean Claude environment can add, install, and load hello2cc successfully.
 */
export function runIsolatedInstallSmoke() {
  const cliPluginCommand = ensureClaudeCli();
  const env = createIsolatedClaudeEnv();
  const pluginId = 'hello2cc@hello2cc-local';

  const addResult = spawnClaude([cliPluginCommand, 'marketplace', 'add', process.cwd()], env);
  if (addResult.error || addResult.status !== 0) {
    fail(`isolated install smoke failed during marketplace add: ${addResult.stderr || addResult.error?.message || 'unknown error'}`);
  }

  const installResult = spawnClaude([cliPluginCommand, 'install', pluginId], env);
  if (installResult.error || installResult.status !== 0) {
    fail(`isolated install smoke failed during plugin install: ${installResult.stderr || installResult.error?.message || 'unknown error'}`);
  }

  const listResult = spawnClaude([cliPluginCommand, 'list', '--json'], env);
  if (listResult.error || listResult.status !== 0) {
    fail(`isolated install smoke failed during plugin list: ${listResult.stderr || listResult.error?.message || 'unknown error'}`);
  }

  const plugins = JSON.parse(listResult.stdout || '[]');
  const plugin = Array.isArray(plugins) ? plugins.find((entry) => entry.id === pluginId) : null;
  if (!plugin) {
    fail('isolated install smoke did not surface hello2cc in plugin list output');
  }

  if (Array.isArray(plugin.errors) && plugin.errors.length > 0) {
    fail(`isolated install smoke reported plugin load errors: ${plugin.errors.join('; ')}`);
  }

  assertPluginCacheShape(plugin.installPath, 'isolated-install');
  ok('isolated-install');
}
