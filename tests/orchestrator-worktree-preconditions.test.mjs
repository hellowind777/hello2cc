import {
  test,
  assert,
  mkdirSync,
  writeFileSync,
  join,
  run,
  isolatedEnv,
} from './helpers/orchestrator-test-helpers.mjs';

test('post-tool-failure records non-git worktree failures and pre-agent-model fail-closes repeated worktree retries', () => {
  const env = isolatedEnv();
  const failedCwd = join(env.HOME, 'non-git-worktree');
  const differentCwd = join(env.HOME, 'other-non-git-worktree');
  mkdirSync(failedCwd, { recursive: true });
  mkdirSync(differentCwd, { recursive: true });

  const failure = run('post-tool-failure', {
    session_id: 'worktree-precondition',
    cwd: failedCwd,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'claude-code-guide',
      isolation: 'worktree',
    },
    error: 'Cannot create agent worktree: not in a git repository and no WorktreeCreate hooks are configured. Configure WorktreeCreate/WorktreeRemove hooks in settings.json to use worktree isolation with other VCS systems.',
  }, env);
  assert.deepEqual(failure, { suppressOutput: true });

  const blocked = run('pre-agent-model', {
    session_id: 'worktree-precondition',
    cwd: failedCwd,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'claude-code-guide',
      isolation: 'worktree',
    },
  }, env);

  assert.equal(blocked.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(blocked.hookSpecificOutput.permissionDecisionReason, /blocked repeated worktree isolation/i);

  const allowedDifferentCwd = run('pre-agent-model', {
    session_id: 'worktree-precondition',
    cwd: differentCwd,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'claude-code-guide',
      isolation: 'worktree',
    },
  }, env);

  assert.deepEqual(allowedDifferentCwd, { suppressOutput: true });
});

test('pre-agent-model auto-unblocks stale worktree failures after the cwd becomes a git repo', () => {
  const env = isolatedEnv();
  const repoDir = join(env.HOME, 'repo');
  mkdirSync(join(repoDir, '.git'), { recursive: true });

  run('post-tool-failure', {
    session_id: 'worktree-recovered-git',
    cwd: repoDir,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      isolation: 'worktree',
    },
    error: 'Cannot create agent worktree: not in a git repository and no WorktreeCreate hooks are configured. Configure WorktreeCreate/WorktreeRemove hooks in settings.json to use worktree isolation with other VCS systems.',
  }, env);

  const output = run('pre-agent-model', {
    session_id: 'worktree-recovered-git',
    cwd: repoDir,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      isolation: 'worktree',
    },
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});

test('post-tool-failure records non-git EnterWorktree failures and pre-enter-worktree fail-closes repeated retries', () => {
  const env = isolatedEnv();
  const failedCwd = join(env.HOME, 'non-git-enter-worktree');
  mkdirSync(failedCwd, { recursive: true });

  run('post-tool-failure', {
    session_id: 'enter-worktree-precondition',
    cwd: failedCwd,
    tool_name: 'EnterWorktree',
    tool_input: {
      name: 'sandbox',
    },
    error: 'Cannot create a worktree: not in a git repository and no WorktreeCreate hooks are configured. Configure WorktreeCreate/WorktreeRemove hooks in settings.json to use worktree isolation with other VCS systems.',
  }, env);

  const blocked = run('pre-enter-worktree', {
    session_id: 'enter-worktree-precondition',
    cwd: failedCwd,
    tool_name: 'EnterWorktree',
    tool_input: {
      name: 'sandbox',
    },
  }, env);

  assert.equal(blocked.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(blocked.hookSpecificOutput.permissionDecisionReason, /blocked repeated EnterWorktree retry/i);
});

test('pre-enter-worktree auto-unblocks stale failures after WorktreeCreate hooks are configured', () => {
  const env = isolatedEnv();
  const projectDir = join(env.HOME, 'project');
  mkdirSync(join(projectDir, '.claude'), { recursive: true });
  writeFileSync(join(projectDir, '.claude', 'settings.local.json'), JSON.stringify({
    hooks: {
      WorktreeCreate: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'echo ready',
            },
          ],
        },
      ],
    },
  }, null, 2));

  run('post-tool-failure', {
    session_id: 'enter-worktree-recovered-hooks',
    cwd: projectDir,
    tool_name: 'EnterWorktree',
    tool_input: {
      name: 'sandbox',
    },
    error: 'Cannot create a worktree: not in a git repository and no WorktreeCreate hooks are configured. Configure WorktreeCreate/WorktreeRemove hooks in settings.json to use worktree isolation with other VCS systems.',
  }, env);

  const output = run('pre-enter-worktree', {
    session_id: 'enter-worktree-recovered-hooks',
    cwd: projectDir,
    tool_name: 'EnterWorktree',
    tool_input: {
      name: 'sandbox',
    },
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
