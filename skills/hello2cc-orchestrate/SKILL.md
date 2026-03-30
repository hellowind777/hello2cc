---
name: hello2cc-orchestrate
description: 非 trivial 编码任务的 Opus 风格编排指南。用于多步骤实现、跨文件修改、工具选择、计划模式、任务拆分与自主推进。
allowed-tools: ToolSearch, Agent, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, TaskGet, EnterPlanMode, ExitPlanMode, AskUserQuestion, Read, Glob, Grep, WebFetch, WebSearch, Bash, Edit, Write
---

你正在使用 `hello2cc` 插件提供的独立编排规则。

目标不是替代 Claude Code 原生能力，而是让通过 Claude Code API 接入的 GPT 与其他第三方模型，都更稳定地主动使用这些原生能力。

## 核心规则

1. 先判断任务是否 trivial。
   - 单文件、低风险、需求清晰的小改动：可直接做。
   - 其余情况：优先 `EnterPlanMode()` 或至少创建任务清单。

2. 遇到工具或能力边界不确定时：
   - 先 `ToolSearch`
   - 不要仅凭记忆说“做不到”或“没有这个工具”
   - 若问题本质上是 Claude Code / Claude API / Agent SDK / hooks / MCP / settings 文档问题，优先内置 `Claude Code Guide` 代理（内部标识 `claude-code-guide`）

3. 任务清单与计划：
   - 多文件修改、架构决策、存在多种实现路径：优先 `EnterPlanMode()`
   - 当任务有 3 个及以上明确步骤时，优先 `TaskCreate` / `TaskUpdate` / `TaskList`
   - 若不需要正式 plan mode，也至少使用任务清单工具跟踪步骤

4. 搜索策略：
   - 定向查找：直接 `Glob` / `Grep`
   - 开放式探索、超过 3 轮搜索、需要理解架构：优先 `Agent(subagent_type="Explore")`
   - 需要方案权衡：优先 `Agent(subagent_type="Plan")`

5. 原生并行策略：
   - 2 到 4 个独立子任务：在同一条消息中并行发起多个 Claude Code 原生 `Agent`
   - 需要持续协作、共享任务状态、研究/实现/验证长期并行：使用原生 `TeamCreate` + `TaskCreate` + `TaskUpdate` + `TaskList`
   - 只使用 Claude Code 原生 `Agent`、`TeamCreate`、`TaskCreate`、`TaskUpdate`、`TaskList`
   - 优先内置原生 agent 类型：`Explore`、`Plan`、`General-Purpose`（内部标识 `general-purpose`）、`Claude Code Guide`（内部标识 `claude-code-guide`）
   - 不要在正文里伪造“子代理已完成”之类的文本编排

6. 执行策略：
   - 先读后改
   - 改动尽量最小、贴近现有风格
   - 不要为了“更优雅”做未被请求的重构
   - 使用 `Bash` 前先判断是否已有更合适的内置工具

7. 收尾策略：
   - 不能未验证就说完成
   - 先按 `hello2cc:hello2cc-verify` 的思路做最贴近改动范围的验证
   - 测试失败时如实汇报，不要把任务描述成“已修复”

## 任务拆分启发式

满足任一条件时，考虑拆任务：
- 2 个以上独立子问题
- 不同目录或模块几乎无耦合
- 需要同时做“研究 + 实现”或“实现 + 验证”
- 需要长时间搜索而主线程还要继续推进

## 输出偏好

- 默认短、准、结构化
- 方案描述聚焦“下一步怎么做”
- 涉及流程、架构、状态迁移时，优先补 ASCII 图
