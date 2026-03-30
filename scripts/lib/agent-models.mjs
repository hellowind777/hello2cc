function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
    'general',
  ].includes(slug)) {
    return 'general-purpose';
  }

  if ([
    'claude-code-guide',
    'claude-code-guide-agent',
    'claude-guide',
    'guide',
    'claudecodeguide',
  ].includes(slug)) {
    return 'claude-code-guide';
  }

  return raw;
}

export function preferredModelForAgent(input, config) {
  if (!input || config.routingPolicy === 'prompt-only' || input.model) {
    return '';
  }

  const agentType = canonicalAgentType(input);

  if (agentType === 'claude-code-guide') {
    return config.guideModel || config.primaryModel || config.subagentModel;
  }

  if (agentType === 'Explore') {
    return config.exploreModel || config.subagentModel || config.primaryModel;
  }

  if (agentType === 'Plan') {
    return config.planModel || config.subagentModel || config.primaryModel;
  }

  if (agentType === 'general-purpose') {
    return input.team_name
      ? config.teamModel || config.generalModel || config.subagentModel || config.primaryModel
      : config.generalModel || config.subagentModel || config.primaryModel;
  }

  if (input.team_name) {
    return config.teamModel || config.subagentModel || config.primaryModel;
  }

  if (!agentType) {
    return config.subagentModel || config.primaryModel;
  }

  return config.subagentModel || config.primaryModel;
}
