import { envValue } from './config.mjs';

function envTruthy(name) {
  return ['1', 'true', 'yes', 'on'].includes(envValue(name).toLowerCase());
}

export function getApiProvider() {
  if (envTruthy('CLAUDE_CODE_USE_BEDROCK')) return 'bedrock';
  if (envTruthy('CLAUDE_CODE_USE_VERTEX')) return 'vertex';
  if (envTruthy('CLAUDE_CODE_USE_FOUNDRY')) return 'foundry';
  return 'firstParty';
}

export function isFirstPartyAnthropicBaseUrl() {
  const baseUrl = envValue('ANTHROPIC_BASE_URL');
  if (!baseUrl) return true;

  try {
    const host = new URL(baseUrl).host;
    const allowedHosts = ['api.anthropic.com'];

    if (envValue('USER_TYPE') === 'ant') {
      allowedHosts.push('api-staging.anthropic.com');
    }

    return allowedHosts.includes(host);
  } catch {
    return false;
  }
}

export function usesCustomAnthropicProxy() {
  return getApiProvider() === 'firstParty' && !isFirstPartyAnthropicBaseUrl();
}

export function hasObservedTools(sessionContext = {}) {
  return Array.isArray(sessionContext?.toolNames) && sessionContext.toolNames.length > 0;
}

function parseIsoTime(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeWebSearchHealth(health = {}) {
  return {
    consecutiveZeroSearches: Number(health?.consecutiveZeroSearches || 0),
    consecutiveErrors: Number(health?.consecutiveErrors || 0),
    cooldownUntil: String(health?.cooldownUntil || '').trim(),
    lastBaseUrl: String(health?.lastBaseUrl || '').trim(),
    lastModel: String(health?.lastModel || '').trim(),
    lastOutcome: String(health?.lastOutcome || '').trim(),
  };
}

function isWebSearchSessionDegraded(health = {}) {
  return (
    health.consecutiveErrors > 0 ||
    health.consecutiveZeroSearches >= 2 ||
    Boolean(health.cooldownUntil)
  );
}

export function resolveWebSearchGuidanceState(sessionContext = {}, options = {}) {
  const observedTools = hasObservedTools(sessionContext);
  const webSearchAvailable = Boolean(sessionContext?.webSearchAvailable);
  const customAnthropicProxy = usesCustomAnthropicProxy();
  const health = normalizeWebSearchHealth(sessionContext?.webSearchHealth);
  const currentBaseUrl = envValue('ANTHROPIC_BASE_URL');
  const currentModel = String(
    sessionContext?.mainModel ||
    sessionContext?.model ||
    '',
  ).trim();
  const transportChanged =
    Boolean(health.lastBaseUrl) &&
    health.lastBaseUrl !== currentBaseUrl;
  const modelChanged =
    Boolean(health.lastModel && currentModel) &&
    health.lastModel !== currentModel;
  const cooldownExpired =
    Boolean(health.cooldownUntil) &&
    parseIsoTime(health.cooldownUntil) <= Date.now();
  const retryRequested = Boolean(options?.retryRequested);
  const degraded = customAnthropicProxy && isWebSearchSessionDegraded(health);
  const shouldProbe = degraded && (retryRequested || transportChanged || modelChanged || cooldownExpired);

  if (webSearchAvailable && customAnthropicProxy) {
    if (degraded && shouldProbe) {
      return {
        mode: 'proxy-probe',
        degraded,
        shouldProbe,
        transportChanged,
        modelChanged,
        cooldownExpired,
      };
    }

    if (degraded) {
      return {
        mode: 'proxy-cooldown',
        degraded,
        shouldProbe,
        transportChanged,
        modelChanged,
        cooldownExpired,
      };
    }

    return {
      mode: 'proxy-conditional',
      degraded,
      shouldProbe,
      transportChanged,
      modelChanged,
      cooldownExpired,
    };
  }

  if (webSearchAvailable) {
    return {
      mode: 'available',
      degraded,
      shouldProbe,
      transportChanged,
      modelChanged,
      cooldownExpired,
    };
  }

  if (observedTools) {
    return {
      mode: 'not-exposed',
      degraded,
      shouldProbe,
      transportChanged,
      modelChanged,
      cooldownExpired,
    };
  }

  if (customAnthropicProxy) {
    return {
      mode: 'proxy-unknown',
      degraded,
      shouldProbe,
      transportChanged,
      modelChanged,
      cooldownExpired,
    };
  }

  return {
    mode: 'generic',
    degraded,
    shouldProbe,
    transportChanged,
    modelChanged,
    cooldownExpired,
  };
}

export function resolveWebSearchGuidanceMode(sessionContext = {}, options = {}) {
  return resolveWebSearchGuidanceState(sessionContext, options).mode;
}
