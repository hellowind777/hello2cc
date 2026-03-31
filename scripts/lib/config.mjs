export const DEFAULT_PRIMARY_MODEL = 'cc-gpt-5.4';
export const DEFAULT_LIGHTWEIGHT_MODEL = 'cc-gpt-5.3-codex-medium';
export const DEFAULT_MANAGED_OUTPUT_STYLE = 'hello2cc Native';

export function envValue(name) {
  return String(process.env[name] || '').trim();
}

export function pluginOption(key) {
  return envValue(`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`);
}

export function configuredPolicy() {
  return pluginOption('routing_policy') || 'native-inject';
}

export function configuredMirrorSessionModel() {
  return pluginOption('mirror_session_model') !== 'false';
}

export function configuredOutputStyleBootstrapPolicy() {
  return pluginOption('bootstrap_output_style') || 'user-if-unset';
}

export function configuredManagedOutputStyle() {
  return pluginOption('managed_output_style') || DEFAULT_MANAGED_OUTPUT_STYLE;
}

function mirroredSessionModel(sessionContext) {
  if (!configuredMirrorSessionModel()) return '';

  return String(
    sessionContext?.mainModel ||
    sessionContext?.model ||
    '',
  ).trim();
}

export function configuredModels(sessionContext = {}) {
  const sessionModel = mirroredSessionModel(sessionContext);
  const primaryModel = pluginOption('primary_model') || sessionModel || DEFAULT_PRIMARY_MODEL;
  const subagentFallback = envValue('CLAUDE_CODE_SUBAGENT_MODEL');
  const subagentModel = pluginOption('subagent_model') || subagentFallback || sessionModel || primaryModel;
  const explicitExploreModel = pluginOption('explore_model');

  return {
    routingPolicy: configuredPolicy(),
    mirrorSessionModel: configuredMirrorSessionModel(),
    sessionModel,
    primaryModel,
    subagentModel,
    guideModel: pluginOption('guide_model') || primaryModel,
    exploreModel: explicitExploreModel || sessionModel || DEFAULT_LIGHTWEIGHT_MODEL,
    planModel: pluginOption('plan_model') || primaryModel,
    generalModel: pluginOption('general_model') || primaryModel,
    teamModel: pluginOption('team_model') || subagentModel,
  };
}
