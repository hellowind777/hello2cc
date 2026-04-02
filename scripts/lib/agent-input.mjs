function trimmed(value) {
  return String(value || '').trim();
}

const IMPLICIT_ASSISTANT_TEAM_NAMES = new Set(['main', 'default']);

function isImplicitAssistantTeamName(value) {
  return IMPLICIT_ASSISTANT_TEAM_NAMES.has(trimmed(value).toLowerCase());
}

function stripAgentTeamFields(input) {
  const updatedInput = { ...input };
  delete updatedInput.name;
  delete updatedInput.team_name;
  return updatedInput;
}

function stripAgentWorktreeIsolation(input) {
  const updatedInput = { ...input };
  delete updatedInput.isolation;
  return updatedInput;
}

export function normalizeAgentTeamSemantics(input = {}, sessionContext = {}) {
  const workerName = trimmed(input?.name);
  const explicitTeamName = trimmed(input?.team_name);
  const activeTeamName = trimmed(sessionContext?.teamName);
  const teamWorkflow = Boolean(sessionContext?.lastPromptSignals?.teamWorkflow);
  const hasTeamSemantics = Boolean(workerName || explicitTeamName);
  const activeTeamIsImplicit = isImplicitAssistantTeamName(activeTeamName);
  const explicitTeamIsImplicit = isImplicitAssistantTeamName(explicitTeamName);

  if (!hasTeamSemantics) {
    return { input, changed: false, reason: '' };
  }

  if (!teamWorkflow) {
    return {
      input: stripAgentTeamFields(input),
      changed: true,
      reason: 'hello2cc normalized Agent to plain subagent semantics by removing implicit team fields outside explicit team workflows',
    };
  }

  if (explicitTeamName && !explicitTeamIsImplicit) {
    return { input, changed: false, reason: '' };
  }

  if (activeTeamName && !activeTeamIsImplicit) {
    return {
      input: {
        ...input,
        team_name: activeTeamName,
      },
      changed: true,
      reason: `hello2cc made Agent.team_name explicit from active team context (${activeTeamName})`,
    };
  }

  return {
    input: stripAgentTeamFields(input),
    changed: true,
    reason: 'hello2cc blocked implicit assistant team semantics until TeamCreate or a real explicit team_name is available',
  };
}

export function normalizeAgentIsolation(input = {}, sessionContext = {}) {
  const explicitIsolation = trimmed(input?.isolation).toLowerCase();
  const wantsWorktree = Boolean(sessionContext?.lastPromptSignals?.wantsWorktree);

  if (explicitIsolation !== 'worktree' || wantsWorktree) {
    return { input, changed: false, reason: '' };
  }

  return {
    input: stripAgentWorktreeIsolation(input),
    changed: true,
    reason: 'hello2cc removed Agent.isolation=worktree because the user did not explicitly request worktree isolation',
  };
}
