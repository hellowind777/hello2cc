function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const HOST_AGENT_MODEL_SLOTS = ['opus', 'sonnet', 'haiku'];

function isInheritModel(value) {
  return normalizeSlug(value) === 'inherit';
}

export function canonicalAgentType(input) {
  const raw = String(input?.subagent_type || input?.agent_type || input?.name || '').trim();
  if (!raw) return '';

  const slug = normalizeSlug(raw);

  if (slug === 'explore') return 'Explore';
  if (slug === 'plan') return 'Plan';

  if ([
    'general-purpose',
    'general-purpose-agent',
    'generalpurpose',
  ].includes(slug)) {
    return 'general-purpose';
  }

  if ([
    'claude-code-guide',
    'claude-code-guide-agent',
    'claude-guide',
    'claudecodeguide',
  ].includes(slug)) {
    return 'claude-code-guide';
  }

  return raw;
}

export function hostAgentModelSlot(value) {
  const slug = normalizeSlug(value);
  if (!slug) return '';

  for (const slot of HOST_AGENT_MODEL_SLOTS) {
    if (
      slug === slot ||
      slug.startsWith(`${slot}-`) ||
      slug.endsWith(`-${slot}`) ||
      slug.includes(`-${slot}-`)
    ) {
      return slot;
    }
  }

  return '';
}

export function preferredModelForAgent(input, config) {
  if (!input || config.routingPolicy === 'prompt-only' || input.model) {
    return '';
  }

  const agentType = canonicalAgentType(input);
  const teamName = String(input?.team_name || '').trim();
  const hasTeamName = Boolean(teamName);

  if (agentType === 'claude-code-guide') {
    return config.guideModel || config.defaultAgentModel || config.sessionModel || config.primaryModel || '';
  }

  if (agentType === 'Explore') {
    return config.exploreModel || config.defaultAgentModel || config.sessionModel || config.subagentModel || config.primaryModel || '';
  }

  if (agentType === 'Plan') {
    if (!config.explicitPlanModel && !config.explicitDefaultAgentModel) {
      return '';
    }

    return config.planModel || config.defaultAgentModel || '';
  }

  if (agentType === 'general-purpose' && hasTeamName) {
    if (!config.explicitTeamModel && !config.explicitSubagentModel && !config.explicitDefaultAgentModel) {
      return '';
    }

    return config.teamModel || config.subagentModel || config.generalModel || config.primaryModel || '';
  }

  if (agentType === 'general-purpose') {
    if (!config.explicitGeneralModel && !config.explicitSubagentModel && !config.explicitDefaultAgentModel) {
      return '';
    }

    return config.generalModel || config.subagentModel || config.primaryModel || '';
  }

  if (hasTeamName) {
    if (!config.explicitTeamModel && !config.explicitSubagentModel && !config.explicitDefaultAgentModel) {
      return '';
    }

    return config.teamModel || config.subagentModel || config.generalModel || config.primaryModel || '';
  }

  if (!agentType) {
    return (config.explicitSubagentModel || config.explicitDefaultAgentModel) ? config.subagentModel || '' : '';
  }

  if (config.explicitSubagentModel || config.explicitDefaultAgentModel) {
    return config.subagentModel || '';
  }

  return '';
}

export function resolvedAgentModelOverride(input, config) {
  const preferredModel = preferredModelForAgent(input, config);
  if (!preferredModel) {
    return { model: '', reason: '' };
  }

  if (isInheritModel(preferredModel)) {
    return { model: '', reason: '' };
  }

  const directSlot = hostAgentModelSlot(preferredModel);
  if (directSlot) {
    return {
      model: directSlot,
      reason: `hello2cc injected Agent.model=${directSlot}`,
    };
  }

  const fallbackSlot = [
    config?.sessionModel,
    config?.defaultAgentModel,
    config?.subagentModel,
    config?.primaryModel,
    config?.generalModel,
    config?.teamModel,
  ]
    .map(hostAgentModelSlot)
    .find(Boolean) || '';

  if (!fallbackSlot) {
    return { model: '', reason: '' };
  }

  return {
    model: fallbackSlot,
    reason: `hello2cc normalized unsupported Agent.model=${preferredModel} to host-safe slot=${fallbackSlot}`,
  };
}
