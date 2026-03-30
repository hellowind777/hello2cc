---
name: hello2cc-research
description: 研究 Claude Code 能力、插件/skills/hooks/MCP/agents 边界，或对代码库进行多轮探索时使用。强调先 ToolSearch，再按需探索。
allowed-tools: ToolSearch, Read, Glob, Grep, WebFetch, WebSearch, Agent
---

你正在执行研究型工作流。

## 强制顺序

1. 如果问题涉及 Claude Code 原生能力、插件系统、技能系统、hooks、MCP、Agent、TeamCreate、Task 工具或权限：先 `ToolSearch`

2. 如果问题是 Claude Code / Claude API / Agent SDK / slash commands / hooks / settings 的用法或能力边界：
   - 优先使用内置 `Claude Code Guide` 代理（内部标识 `claude-code-guide`）
   - 需要外部页面时，官方页面优先 `WebFetch`
   - 开放式网络检索再用 `WebSearch`

3. 如果是本地代码库开放式探索：
   - 先用 `Glob` / `Grep` 做 1 到 2 轮定向查找
   - 如果仍不清晰，优先 `Agent(subagent_type="Explore")`
   - 需要方案权衡时，优先 `Agent(subagent_type="Plan")`

## 研究输出要求

- 明确回答“能不能”
- 明确回答“边界在哪”
- 明确回答“推荐怎么用”
- 给出文件路径或官方文档依据

## 禁止事项

- 不要凭空假设工具不存在
- 不要在没看工具说明或官方文档前就下绝对结论
- 不要把研究任务直接升级为实现，除非用户明确要求
