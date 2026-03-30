export const DEFAULT_PRIMARY_MODEL = 'cc-gpt-5.4';
export const DEFAULT_LIGHTWEIGHT_MODEL = 'cc-gpt-5.3-codex-medium';

export function envValue(name) {
  return String(process.env[name] || '').trim();
}

export function pluginOption(key) {
  return envValue(`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`);
}

export function configuredPolicy() {
  return pluginOption('routing_policy') || 'native-inject';
}

export function configuredModels() {
  const primaryModel = pluginOption('primary_model') || DEFAULT_PRIMARY_MODEL;
  const subagentFallback = envValue('CLAUDE_CODE_SUBAGENT_MODEL');
  const subagentModel = pluginOption('subagent_model') || subagentFallback || primaryModel;

  return {
    routingPolicy: configuredPolicy(),
    primaryModel,
    subagentModel,
    guideModel: pluginOption('guide_model') || primaryModel,
    exploreModel: pluginOption('explore_model') || DEFAULT_LIGHTWEIGHT_MODEL,
    planModel: pluginOption('plan_model') || primaryModel,
    generalModel: pluginOption('general_model') || primaryModel,
    teamModel: pluginOption('team_model') || subagentModel,
  };
}
