import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  configuredManagedOutputStyle,
  configuredOutputStyleBootstrapPolicy,
} from './config.mjs';
import {
  readJsonFile,
  writeJsonFile,
  readPluginDataJson,
  writePluginDataJson,
} from './plugin-data.mjs';
import { pluginVersion } from './plugin-meta.mjs';

const BOOTSTRAP_STATE_PATH = 'runtime/output-style-bootstrap.json';

function outputStyleAt(path) {
  const settings = readJsonFile(path, {});
  return String(settings?.outputStyle || '').trim();
}

function projectOutputStyle(cwd) {
  const localPath = join(cwd, '.claude', 'settings.local.json');
  const projectPath = join(cwd, '.claude', 'settings.json');

  for (const path of [localPath, projectPath]) {
    if (!existsSync(path)) continue;

    const outputStyle = outputStyleAt(path);
    if (outputStyle) {
      return {
        path,
        outputStyle,
      };
    }
  }

  return null;
}

export function userSettingsPath() {
  return join(homedir(), '.claude', 'settings.json');
}

/**
 * Bootstrap a managed output style at user scope once per plugin version.
 */
export function ensureManagedOutputStyle(cwd = process.cwd()) {
  const style = configuredManagedOutputStyle();
  const policy = configuredOutputStyleBootstrapPolicy();

  if (!style || policy === 'off') {
    return { applied: false, reason: 'disabled' };
  }

  const version = pluginVersion();
  const state = readPluginDataJson(BOOTSTRAP_STATE_PATH, {});
  if (state.versionApplied === version) {
    return { applied: false, reason: 'already-applied', version };
  }

  const projectOverride = projectOutputStyle(cwd);
  const path = userSettingsPath();
  const settings = readJsonFile(path, {});
  const currentUserStyle = String(settings.outputStyle || '').trim();

  if (policy !== 'force-user') {
    if (projectOverride) {
      writePluginDataJson(BOOTSTRAP_STATE_PATH, {
        versionApplied: version,
        applied: false,
        reason: 'project-override',
        path: projectOverride.path,
        outputStyle: projectOverride.outputStyle,
      });
      return { applied: false, reason: 'project-override', path: projectOverride.path };
    }

    if (currentUserStyle) {
      writePluginDataJson(BOOTSTRAP_STATE_PATH, {
        versionApplied: version,
        applied: false,
        reason: currentUserStyle === style ? 'already-set' : 'user-setting-exists',
        path,
        outputStyle: currentUserStyle,
      });
      return {
        applied: false,
        reason: currentUserStyle === style ? 'already-set' : 'user-setting-exists',
        path,
        outputStyle: currentUserStyle,
      };
    }
  }

  writeJsonFile(path, {
    ...settings,
    outputStyle: style,
  });

  writePluginDataJson(BOOTSTRAP_STATE_PATH, {
    versionApplied: version,
    applied: true,
    path,
    outputStyle: style,
  });

  return {
    applied: true,
    path,
    outputStyle: style,
    version,
  };
}
