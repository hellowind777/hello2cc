import {
  activeWorktreeFailure,
  hasIntentTeamSemantics,
  isImplicitAssistantTeamName,
  isOmittedTeamPlaceholder,
  provenActiveTeamContext,
  readTrimmed,
  stripAgentTeamFields,
  stripAgentWorktreeIsolation,
  wantsIntentWorktree,
} from './agent-input-shared.mjs';

export function normalizeAgentTeamSemantics(input = {}, sessionContext = {}) {
  const workerName = readTrimmed(input?.name);
  const explicitTeamName = readTrimmed(input?.team_name);
  const activeTeamName = readTrimmed(sessionContext?.teamName);
  const teamSemantics = hasIntentTeamSemantics(sessionContext);
  const hasTeamSemantics = Boolean(workerName || explicitTeamName);
  const activeTeamIsImplicit = isImplicitAssistantTeamName(activeTeamName);
  const explicitTeamIsImplicit = isImplicitAssistantTeamName(explicitTeamName);

  if (!hasTeamSemantics) {
    return { input, changed: false, reason: '', blocked: false };
  }

  if (!teamSemantics) {
    return {
      input: stripAgentTeamFields(input),
      changed: true,
      reason: 'hello2cc normalized Agent to plain subagent semantics outside explicit team-oriented workflows',
      blocked: false,
    };
  }

  if (explicitTeamName && !explicitTeamIsImplicit) {
    return { input, changed: false, reason: '', blocked: false };
  }

  if (provenActiveTeamContext(sessionContext) && !activeTeamIsImplicit) {
    return {
      input: {
        ...input,
        team_name: activeTeamName,
      },
      changed: true,
      reason: `hello2cc made Agent.team_name explicit from verified active team context (${activeTeamName})`,
      blocked: false,
    };
  }

  return {
    input: stripAgentTeamFields(input),
    changed: true,
    reason: isOmittedTeamPlaceholder(explicitTeamName)
      ? `hello2cc stripped placeholder Agent.team_name=${JSON.stringify(explicitTeamName)}; plain workers should omit team_name entirely, and real teammates should pass a real team_name or establish the team first`
      : explicitTeamIsImplicit
      ? 'hello2cc blocked implicit assistant team semantics until TeamCreate or a real explicit team_name is available'
      : 'hello2cc stripped implicit teammate fields until host state proves a real active team context; plain workers should omit name/team_name, and real teammates should pass an explicit team_name or establish the team first',
    blocked: false,
  };
}

export function normalizeAgentIsolation(input = {}, sessionContext = {}) {
  const explicitIsolation = readTrimmed(input?.isolation).toLowerCase();
  const wantsWorktree = wantsIntentWorktree(sessionContext);
  const worktreeFailure = explicitIsolation === 'worktree'
    ? activeWorktreeFailure(sessionContext)
    : null;

  if (worktreeFailure) {
    return {
      input,
      changed: false,
      blocked: true,
      reason: `hello2cc blocked repeated worktree isolation in this cwd because Claude Code already failed here with a non-git/no-hook precondition; switch to a git repository, configure WorktreeCreate hooks, or retry without worktree isolation`,
    };
  }

  if (explicitIsolation !== 'worktree' || wantsWorktree) {
    return { input, changed: false, reason: '', blocked: false };
  }

  return {
    input: stripAgentWorktreeIsolation(input),
    changed: true,
    reason: 'hello2cc removed Agent.isolation=worktree because the user did not explicitly request worktree isolation',
    blocked: false,
  };
}

export function normalizeTeamCreateInput(input = {}, sessionContext = {}) {
  return { input, changed: false, reason: '', blocked: false };
}

export function normalizeEnterWorktreeInput(input = {}, sessionContext = {}) {
  if (!wantsIntentWorktree(sessionContext)) {
    return { input, changed: false, reason: '', blocked: false };
  }

  const worktreeFailure = activeWorktreeFailure(sessionContext);
  if (!worktreeFailure) {
    return { input, changed: false, reason: '', blocked: false };
  }

  return {
    input,
    changed: false,
    blocked: true,
    reason: 'hello2cc blocked repeated EnterWorktree retry in this cwd because Claude Code already proved the worktree preconditions were not met here; switch into a git repository or configure WorktreeCreate/WorktreeRemove hooks first',
  };
}
