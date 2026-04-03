import {
  test,
  assert,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  join,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('route keeps plain worker guidance for one-shot parallel fan-out work', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-plain-workers',
    prompt: 'Use subagent workers in parallel to inspect three modules and report back.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /并行发起多个原生 `Agent` worker/);
  assert.match(context, /不要给普通 worker 传 `name` 或 `team_name`/);
  assert.doesNotMatch(context, /更接近 Claude Code 原生 team 语义/);
  assert.doesNotMatch(context, /TeamCreate/);
});

test('route promotes TeamCreate for explicit team workflows', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-team',
    prompt: 'Use TeamCreate to build a persistent agent team for this multi-agent workflow.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TeamCreate/);
  assert.match(context, /显式传入 `name` \+ `team_name`/);
  assert.match(context, /SendMessage/);
  assert.match(context, /TeamDelete/);
  assert.doesNotMatch(context, /TaskOutput/);
});

test('route proactively promotes TeamCreate for sustained collaboration tasks', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-proactive-team',
    prompt: 'Build a frontend and backend feature, coordinate ownership across agents, and keep shared task handoffs clear.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /更接近 Claude Code 原生 team 语义/);
  assert.match(context, /TeamCreate/);
  assert.match(context, /TaskCreate/);
  assert.match(context, /TaskList/);
  assert.match(context, /TaskUpdate/);
  assert.match(context, /TaskGet/);
  assert.match(context, /SendMessage/);
});

test('route strengthens task-board bootstrap and recovery guidance for sustained team workflows', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-team-recovery',
    prompt: '请完成一个前后端联动的小功能：先调研、再拆任务、再实现、再验证，需要多个 agent 协作推进，并维护可交接的任务状态。',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TaskList` \/ `TaskCreate` 把研究、实现、验证和 handoff 落成真实 task board/);
  assert.match(context, /`Explore` \/ `Plan` 只读，`General-Purpose` 才承担实现或验证/);
  assert.match(context, /0 tool uses/);
  assert.match(context, /TaskGet` \/ `TaskList` \+ `SendMessage` 自修复/);
});

test('route promotes General-Purpose for bounded implementation slices', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-general',
    prompt: 'Implement a focused one-file fix and validate it.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /General-Purpose/);
  assert.match(context, /全工具面/);
});

test('route uses AskUserQuestion on decision-heavy tasks', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-ask-user',
    prompt: 'Which approach should I choose between option A and B if there is a trade-off?',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /AskUserQuestion/);
});

test('route keeps strict native task-board guidance instead of TodoWrite fallback semantics', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-todowrite',
    tools: ['TodoWrite'],
    prompt: 'Implement a multi-file change and keep a todo list for the work.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TaskCreate/);
  assert.match(context, /TaskList/);
  assert.match(context, /TaskUpdate/);
  assert.match(context, /TaskGet/);
  assert.doesNotMatch(context, /TodoWrite/);
});

test('route keeps TeamCreate guidance for explicit team workflows even without host proof', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-no-team',
    prompt: 'Use TeamCreate and teammates to coordinate research and implementation in parallel.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TeamCreate/);
  assert.match(context, /SendMessage/);
  assert.match(context, /TeamDelete/);
});

test('route warns against using TaskOutput as the default worker polling path', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-no-taskoutput-polling',
    tools: ['Agent', 'SendMessage', 'TaskStop', 'TaskOutput'],
    prompt: 'Use subagent workers in parallel to research this repo, implement the change, and verify the result.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /不要把 `TaskOutput` 当成普通 worker 的默认结果获取方式/);
});

test('route prefers markdown-first structured output instead of forcing ascii tables', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-diagram',
    prompt: 'Please present the modules as a table or diagram.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /优先标准 Markdown 表格或图示/);
  assert.doesNotMatch(context, /Markdown\/ASCII/);
});

test('route keeps native task-board guidance for explicit task-tracking requests', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-task-board',
    tools: ['TaskCreate', 'TaskList', 'TaskUpdate', 'TaskGet'],
    prompt: 'Create a task board checklist to research, implement, and verify this change.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TaskCreate/);
  assert.match(context, /TaskList/);
  assert.match(context, /TaskUpdate/);
  assert.match(context, /TaskGet/);
});
