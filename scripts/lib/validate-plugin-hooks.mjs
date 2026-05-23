function validateSubagentHooks(context, hooks) {
  const subagentStart = hooks.SubagentStart;
  if (!Array.isArray(subagentStart)) {
    context.fail('hooks.json should define SubagentStart hooks for built-in native agents');
  } else {
    const matchers = new Set(subagentStart.map((entry) => entry.matcher));
    if (!matchers.has('Explore') || !matchers.has('Plan') || !matchers.has('general-purpose')) {
      context.fail('hooks.json should attach SubagentStart guidance for Explore, Plan, and general-purpose');
    } else {
      context.ok('hooks SubagentStart coverage');
    }
  }

  const subagentStop = hooks.SubagentStop;
  const teammateIdle = hooks.TeammateIdle;
  const taskCreated = hooks.TaskCreated;
  const taskCompleted = hooks.TaskCompleted;
  if (!Array.isArray(subagentStop) || !Array.isArray(teammateIdle) || !Array.isArray(taskCreated) || !Array.isArray(taskCompleted)) {
    context.fail('hooks.json should define SubagentStop, TeammateIdle, TaskCreated, and TaskCompleted guards');
    return;
  }

  const stopMatchers = new Set(subagentStop.map((entry) => entry.matcher));
  if (!stopMatchers.has('Explore') || !stopMatchers.has('Plan') || !stopMatchers.has('general-purpose')) {
    context.fail('hooks.json should attach SubagentStop quality gates for Explore, Plan, and general-purpose');
  } else {
    context.ok('hooks subagent stop guards');
  }

  if (teammateIdle.length === 0) {
    context.fail('hooks.json should define TeammateIdle hooks for teammate mailbox continuity');
  } else {
    context.ok('hooks teammate idle continuity');
  }

  context.ok('hooks task lifecycle guards');
}

function validatePreToolHooks(context, hooks) {
  const preToolUse = hooks.PreToolUse;
  if (!Array.isArray(preToolUse)) {
    context.fail('hooks.json should define PreToolUse hooks');
    return;
  }

  const hasAgentHook = preToolUse.some((entry) => entry.matcher === 'Agent' || entry.matcher === 'Task');
  const hasEnterWorktreeHook = preToolUse.some((entry) => entry.matcher === 'EnterWorktree');
  const hasTeamCreateHook = preToolUse.some((entry) => entry.matcher === 'TeamCreate');
  if (!hasAgentHook || !hasEnterWorktreeHook || !hasTeamCreateHook) {
    context.fail('hooks.json should define PreToolUse hooks for Agent/Task alias, EnterWorktree, and TeamCreate');
  } else {
    context.ok('hooks Agent pretool injection');
  }
}

function validatePostToolHooks(context, hooks) {
  const postToolUse = hooks.PostToolUse;
  if (!Array.isArray(postToolUse)) {
    context.fail('hooks.json should define PostToolUse hooks');
  } else {
    const postMatchers = new Set(postToolUse.map((entry) => entry.matcher));
    if (!postMatchers.has('TeamCreate') || !postMatchers.has('TeamDelete') || (!postMatchers.has('Agent') && !postMatchers.has('Task'))) {
      context.fail('hooks.json should track TeamCreate, TeamDelete, and Agent/Task success via PostToolUse');
    } else {
      context.ok('hooks PostToolUse coverage');
    }
  }

  const postToolUseFailure = hooks.PostToolUseFailure;
  if (!Array.isArray(postToolUseFailure)) {
    context.fail('hooks.json should define PostToolUseFailure hooks');
  } else {
    const failureMatchers = new Set(postToolUseFailure.map((entry) => entry.matcher));
    if ((!failureMatchers.has('Agent') && !failureMatchers.has('Task')) || !failureMatchers.has('EnterWorktree')) {
      context.fail('hooks.json should track Agent/Task and EnterWorktree failures via PostToolUseFailure');
    } else {
      context.ok('hooks PostToolUseFailure coverage');
    }
  }

  const configChange = hooks.ConfigChange;
  if (!Array.isArray(configChange) || configChange.length === 0) {
    context.fail('hooks.json should define ConfigChange hooks');
  } else {
    context.ok('hooks ConfigChange coverage');
  }
}

/**
 * Validates hook coverage for native agents, pretool injection, and failure recovery.
 */
export function validateHooks(context) {
  const hooks = context.readJson('hooks/hooks.json')?.hooks;
  if (!hooks) return;

  validateSubagentHooks(context, hooks);
  validatePreToolHooks(context, hooks);
  validatePostToolHooks(context, hooks);
}
