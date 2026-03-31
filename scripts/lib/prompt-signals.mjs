function normalizePrompt(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function hasQuestionIntent(text) {
  return hasAny(text, [
    /\?/,
    /^(can|does|do|how|why|what|which|when|where)\b/,
    /\b(can|does|do|how|why|what|which|when|where)\b/,
    /能不能/,
    /如何/,
    /怎么/,
    /为什么/,
    /是什么/,
    /是否/,
    /区别/,
    /边界/,
    /支持哪些/,
  ]);
}

const DIAGRAM_PATTERNS = [
  /ascii/,
  /diagram/,
  /draw/,
  /visuali[sz]e/,
  /flowchart/,
  /sequence/,
  /state machine/,
  /workflow/,
  /topology/,
  /architecture/,
  /table/,
  /matrix/,
  /架构图/,
  /流程图/,
  /时序图/,
  /状态图/,
  /拓扑图/,
  /关系图/,
  /示意图/,
  /图表/,
  /表格/,
  /矩阵/,
];

const RESEARCH_PATTERNS = [
  /research/,
  /investigate/,
  /compare/,
  /explore/,
  /docs?/,
  /documentation/,
  /how does/,
  /why does/,
  /what is/,
  /can i/,
  /support/,
  /评估/,
  /研究/,
  /调研/,
  /对比/,
  /分析/,
  /原理/,
  /文档/,
  /边界/,
  /区别/,
  /支持/,
];

const SWARM_PATTERNS = [
  /parallel/,
  /in parallel/,
  /subagent/,
  /多个模块/,
  /并行/,
  /同时推进/,
  /多条线/,
  /协作/,
  /分工/,
  /任务编排/,
];

const TEAM_WORKFLOW_PATTERNS = [
  /swarm/,
  /teamcreate/,
  /teamdelete/,
  /sendmessage/,
  /teammate/,
  /multi-agent team/,
  /agent team/,
  /agents team/,
  /persistent team/,
  /团队代理/,
  /团队编排/,
  /子代理编排/,
  /持久团队/,
];

const VERIFY_PATTERNS = [
  /test/,
  /verify/,
  /review/,
  /check/,
  /lint/,
  /build/,
  /smoke/,
  /sanity/,
  /regression/,
  /修复后验证/,
  /验证/,
  /测试/,
  /审查/,
  /检查/,
  /回归/,
  /验收/,
];

const COMPLEX_PATTERNS = [
  /implement/,
  /build/,
  /create/,
  /add /,
  /refactor/,
  /rewrite/,
  /migrate/,
  /integrate/,
  /plugin/,
  /feature/,
  /workflow/,
  /编写/,
  /实现/,
  /新增/,
  /重构/,
  /迁移/,
  /接入/,
  /插件/,
  /功能/,
  /工作流/,
];

const IMPLEMENT_PATTERNS = [
  /implement/,
  /build/,
  /create/,
  /add /,
  /fix/,
  /update/,
  /rewrite/,
  /refactor/,
  /integrate/,
  /ship/,
  /patch/,
  /实现/,
  /编写/,
  /新增/,
  /修复/,
  /更新/,
  /重构/,
  /接入/,
  /落地/,
];

const REVIEW_PATTERNS = [
  /review/,
  /audit/,
  /inspect/,
  /check/,
  /sanity/,
  /regression/,
  /code review/,
  /pull request/,
  /pr comments?/,
  /审查/,
  /审核/,
  /复核/,
  /检查/,
  /验收/,
  /回归/,
];

const MCP_PATTERNS = [
  /\bmcp\b/,
  /github/,
  /jira/,
  /slack/,
  /figma/,
  /sentry/,
  /statsig/,
  /postgres/,
  /database/,
  /external tool/,
  /external system/,
  /connected tool/,
  /外部系统/,
  /外部工具/,
  /数据源/,
  /数据库/,
  /工单/,
];

const FRONTEND_PATTERNS = [
  /frontend/,
  /\bui\b/,
  /client/,
  /web app/,
  /页面/,
  /前端/,
  /界面/,
  /客户端/,
];

const BACKEND_PATTERNS = [
  /backend/,
  /\bapi\b/,
  /server/,
  /database/,
  /service/,
  /worker/,
  /后端/,
  /接口/,
  /服务端/,
  /数据库/,
];

const HOST_FEATURE_PATTERNS = [
  /toolsearch/,
  /enterplanmode/,
  /teamcreate/,
  /teamdelete/,
  /sendmessage/,
  /askuserquestion/,
  /enterworktree/,
  /task(create|update|list|get)/,
  /taskoutput/,
  /taskstop/,
  /todowrite/,
  /listmcpresources/,
  /readmcpresource/,
  /claude code guide/,
  /general-purpose/,
  /\bexplore\b/,
  /\bplan\b/,
];

const GUIDE_PATTERNS = [
  /claude code/,
  /claude api/,
  /anthropic api/,
  /agent sdk/,
  /slash command/,
  /hooks?/,
  /\bmcp\b/,
  /settings/,
  /permissions?/,
  /anthropic/,
  /命令/,
  /hook/,
  /配置/,
  /权限/,
  /设置/,
];

const HOST_TOPIC_PATTERNS = [
  ...HOST_FEATURE_PATTERNS,
  ...GUIDE_PATTERNS,
  /工具/,
  /插件/,
  /子代理/,
  /任务工具/,
];

const PLAN_PATTERNS = [
  /plan/,
  /design/,
  /architecture/,
  /roadmap/,
  /trade[\s-]?off/,
  /multi[\s-]?file/,
  /cross[\s-]?file/,
  /方案/,
  /设计/,
  /架构/,
  /计划/,
  /路线图/,
  /取舍/,
  /多文件/,
  /跨文件/,
  /任务拆分/,
];

const TASK_LIST_PATTERNS = [
  /task list/,
  /checklist/,
  /todo/,
  /kanban/,
  /task board/,
  /任务清单/,
  /待办/,
  /看板/,
  /拆任务/,
  /分派/,
];

const DECISION_PATTERNS = [
  /choose between/,
  /which option/,
  /which approach/,
  /which should/i,
  /what(?:'s| is) better/,
  /trade[\s-]?off/,
  /tradeoff/,
  /recommend (?:one|an approach|a path|a direction)/,
  /which one/,
  /选哪个/,
  /怎么选/,
  /哪个更好/,
  /取舍/,
  /如何取舍/,
  /权衡/,
  /推荐哪/,
  /推荐哪个/,
  /方案对比/,
];

const WORKTREE_PATTERNS = [
  /enterworktree/,
  /git worktree/,
  /worktree/,
  /separate worktree/,
  /isolated worktree/,
  /parallel worktree/,
  /独立工作树/,
  /单独工作树/,
  /并行工作树/,
  /隔离工作树/,
  /工作树/,
];

export function startsWithExplicitCommand(prompt) {
  return /^(~|\/)/.test(String(prompt || '').trim());
}

export function isSubagentPrompt(prompt) {
  return /^\[(?:子代理任务|subagent task|agent task|teammate task)\]/i.test(String(prompt || '').trim());
}

export function classifyPrompt(prompt) {
  const text = normalizePrompt(prompt);
  const research = hasAny(text, RESEARCH_PATTERNS);
  const explicitHostFeature = hasAny(text, HOST_FEATURE_PATTERNS);
  const claudeGuide = hasQuestionIntent(text) && hasAny(text, GUIDE_PATTERNS);
  const implement = hasAny(text, IMPLEMENT_PATTERNS);
  const review = hasAny(text, REVIEW_PATTERNS);
  const mcp = hasAny(text, MCP_PATTERNS);
  const frontend = hasAny(text, FRONTEND_PATTERNS);
  const backend = hasAny(text, BACKEND_PATTERNS);
  const complex = hasAny(text, COMPLEX_PATTERNS);
  const verify = hasAny(text, VERIFY_PATTERNS);
  const multiTrackByStructure =
    (research && implement) ||
    (research && verify) ||
    (implement && verify) ||
    (frontend && backend);
  const plan = complex || multiTrackByStructure || hasAny(text, PLAN_PATTERNS);
  const swarm = hasAny(text, SWARM_PATTERNS) || multiTrackByStructure;
  const teamWorkflow = hasAny(text, TEAM_WORKFLOW_PATTERNS);
  const decisionHeavy = hasQuestionIntent(text) && hasAny(text, DECISION_PATTERNS);
  const capabilityQuery = explicitHostFeature || (hasQuestionIntent(text) && hasAny(text, HOST_TOPIC_PATTERNS)) || mcp;
  const codeResearch = research && !capabilityQuery;

  const tracks = [];
  if (frontend) tracks.push('frontend');
  if (backend) tracks.push('backend');
  if (research && (implement || review || verify) && !tracks.includes('research')) {
    tracks.unshift('research');
  }
  if (!tracks.includes('implementation') && implement && (research || verify || review)) {
    tracks.push('implementation');
  }
  if (!tracks.includes('review') && review && !verify) {
    tracks.push('review');
  }
  if (!tracks.includes('verification') && verify) {
    tracks.push('verification');
  }

  const boundedImplementation = implement && !research && !swarm && tracks.length <= 1 && !frontend && !backend;

  return {
    diagram: hasAny(text, DIAGRAM_PATTERNS),
    research,
    swarm,
    teamWorkflow,
    verify,
    complex,
    tools: explicitHostFeature,
    claudeGuide,
    plan,
    taskList: plan || hasAny(text, TASK_LIST_PATTERNS),
    implement,
    review,
    mcp,
    frontend,
    backend,
    decisionHeavy,
    capabilityQuery,
    codeResearch,
    tracks,
    boundedImplementation,
    toolSearchFirst: capabilityQuery,
    wantsWorktree: hasAny(text, WORKTREE_PATTERNS),
  };
}
