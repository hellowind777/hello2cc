---
name: hello2cc-swarm
description: 需要并行推进、使用子代理、Agent Teams、任务分派和结果汇总时使用。适合多模块独立任务或研究/实现/验证并行。
allowed-tools: Agent, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage
---

你正在执行并行编排工作流。

## 原生性铁律

- 只使用 Claude Code 原生 `Agent`、`TeamCreate`、`TaskCreate`、`TaskUpdate`、`TaskList`
- 原生内置 agent 类型优先：`Explore`、`Plan`、`General-Purpose`（内部标识 `general-purpose`）、`Claude Code Guide`（内部标识 `claude-code-guide`）
- 不要在正文里模拟子代理
- 不要伪造 team 状态、伪造成员回复、伪造任务看板
- 只有真实调用过工具，才可以汇报对应的编排结果
- 用户显式要求“并行”时，必须在同一条消息中并行发起多个 `Agent`，不要串行假装并行

## 何时只用 Agent

满足以下条件时，直接并行 `Agent` 即可：
- 子任务数量少（通常 2 到 4 个）
- 不需要共享任务状态
- 结果回收后由主线程统一整合

做法：
1. 在同一条消息中并行发起多个 `Agent`
2. 每个子代理给出清晰边界、期望产出、是否允许写代码
3. 子代理之间避免修改同一文件
4. 结果回收后由主线程统一审查和整合

## 何时用 Agent Teams

满足以下条件时，优先 `TeamCreate`：
- 子任务较多或持续时间较长
- 需要共享任务列表与负责人
- 需要“研究 / 实现 / 验证”多角色持续协作

做法：
1. `TeamCreate`
2. `TaskCreate` 拆任务
3. `TaskUpdate` 分配 owner 与状态
4. 通过 `TaskList` 查看可领取任务与依赖
5. 子代理完成后回收结果并继续分派
6. 结束时显式清理 team 资源

## 分工建议

- 研究类 → `Explore`、`Plan` 或 `Claude Code Guide`（内部标识 `claude-code-guide`）
- 写代码类 → `General-Purpose`（内部标识 `general-purpose`）
- 测试/验证类 → `General-Purpose`（内部标识 `general-purpose`）或单独验证代理

## 约束

- 不同子代理不要改同一文件
- 提示里明确是否“只研究，不写代码”
- 主线程必须汇总并审查子代理输出
- 如果只是 1 个任务拆成多个顺序步骤，不要滥用 swarm
