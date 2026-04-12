# 更新日志

## 0.5.2 - 2026-04-12

- 修复普通 `Agent` 把 `none` / `__omit__` 一类省略占位误当成真实 `team_name`，避免在非 team 路径上触发 `spawnTeam` missing-team 报错
- 当会话里已存在真实 team + task board 连续体时，把这类占位安全回填为已验证的真实 `team_name`，恢复 teammate 路由
- 忽略 transcript / team attachment 中的伪 team 名，避免污染后续 Agent 路由、team model 选择与团队状态推断

## 0.5.1 - 2026-04-10

- 修复 `TaskCreated` 误用任务完成态“完成证据”门槛的问题，降低建任务阶段被红字拦截的概率
- 允许创建阶段通过“短但明确的动作描述”，例如“先定位安装/引用位置，再做降级”
- 调整 `task-lifecycle` 失败提示文案，创建阶段改为引导先完善任务描述，不再误导成“marking it done”

## 0.5.0 - 2026-04-08

- 新增 workflow owner 仲裁：当会话里已经 surfaced 更高优先级的 skill / workflow 时，hello2cc 不再强行覆盖主流程
- 保留常驻的原生输出风格、工具语义、协议适配与失败防抖，让第三方模型继续贴近 Claude Code / Opus 使用方式
- 补充对 SessionStart 注入 bootstrap skill 文档的识别，使 `using-superpowers` 一类宿主技能面能被正确感知与续用

## 0.4.9 - 2026-04-08

- 统一稳定版 `v...` tag 与 beta tag 的 release-notes 查找路径，避免因 tag 风格不同导致说明生成失败
- 补齐 `0.4.5` 到 `0.4.7` 的 changelog 节，恢复最近版本的连续更新记录
- 让仓库版本说明、发布脚本与当前插件版本重新保持一致

## 0.4.8 - 2026-04-08

- 统一稳定版 `v...` tag 与 beta tag 的 release-notes 查找路径，避免因 tag 风格不同导致说明生成失败
- 补齐 `0.4.5` 到 `0.4.7` 的 changelog 节，恢复最近版本的连续更新记录
- 让仓库版本说明、发布脚本与当前插件版本重新保持一致

## 0.4.7 - 2026-04-08

- 去掉 missing-team 场景下对显式 teammate 重试的插件侧前置 deny，不再先出现 hello2cc 红字拦截
- 当 team 缺失或已删除时，显式 teammate 重试回到 Claude Code 原生的 TeamCreate / spawnTeam 报错路径
- 保留 continuity 记忆用于恢复与提示，但不再仅凭旧失败记录把后续显式 team 重试直接短路

## 0.4.6 - 2026-04-07

- 收紧 current-info / 对比题的 WebSearch 查询整形，更接近原生 Claude Code 的短 query 与拆分搜索路径
- 把 `Did 0 searches` 明确视为空搜索而不是成功结果，减少代理链路下的误判与机械重试
- 进一步解耦 task tracking 与 team 路由，让复杂多步骤任务优先停留在 task-first 路径
- 增强语言无关的结构化意图判断，减少对固定关键词命中的依赖

## 0.4.5 - 2026-04-06

- 移除插件随包 `settings.json` 的默认 agent 注入，安装后不再向 Claude Code settings 写入 `agent=hello2cc:native`
- 让插件启用 / 禁用状态回到 Claude Code 自己的 marketplace 与 enabledPlugins 机制管理
- 清理缓存安装形态，避免插件缓存目录继续携带默认 agent 设置文件
- 同步更新文档与真实会话回归校验，补齐“无默认 agent 注入”的发布契约
## 0.4.4 - 2026-04-06

- 进一步把 hello2cc 对齐到原生 Claude Code 的能力策略流：由宿主先定义能力边界与优先级，再让模型在受约束空间内做语义选择，而不是靠关键词硬路由
- 强化 language-agnostic 的意图分析与已暴露能力优先级，在 skills / workflows / MCP / ToolSearch / Agent / TeamCreate 之间更接近原生 Opus 的选择方式
- 下沉 team follow-up、idle、plan approval、shutdown rejection 等团队连续体状态，让第三方模型在持续协作场景下更容易维持真实 task board 与 teammate 流程
- 压缩 subagent / teammate 注入上下文，缓解 team/subagent 场景下 Claude Code 顶部内容过快重绘的问题

## 0.4.3 - 2026-04-04

- 围绕 #10 调整插件配置项顺序，将 `compatibility_mode` 前移到表单首位，减少“字段不存在”的误判
- 补充中英文 README 排错说明，明确旧版本配置分页与升级/重装路径
- 保持 `compatibility_mode` 语义与 `sanitize-only` 共存模式不变，仅修复配置可发现性问题

## 0.4.2 - 2026-04-04

- 将 hello2cc 落地为 Claude Code 风格的三层结构：宿主能力策略、提示词规则编译、调用后 fail-closed 校验
- 新增 capability policy registry，统一约束 skills / ToolSearch / MCP / Agent / TeamCreate / EnterWorktree / task tracking 的适用边界
- 将 `TeamCreate` 与 `EnterWorktree` 纳入前置校验链，并清理旧版 route/session 意图路由辅助模块

## 0.4.1 - 2026-04-04

- 恢复宿主侧意图持久化与 pre-tool 参数纠偏，减少普通并行任务误入 team / worktree 路径的问题
- 补强面向比较题、能力题与子代理场景的原生输出骨架，让第三方模型更接近 Claude Code 原生习惯
- 扩展相关回归测试与真实链路校验，确保新版路由、team 语义与 subagent 上下文保持一致

## 0.4.0 - 2026-04-04

- 将 hello2cc 从“语义路由器”收敛为“宿主状态提供者 + 协议适配器 + 失败防抖器”，把 plan / team / swarm / tool 选择权彻底还给主模型
- SessionStart / UserPromptSubmit / SubagentStart 改为输出紧凑的结构化宿主状态，而不再注入大段硬编码路由文本，显著降低多语言误触发与 UI 重绘压力
- `Agent` / `SendMessage` / `WebSearch` / worktree / team 相关兼容逻辑只保留确定性的协议修正和失败记忆，不再基于关键词猜测意图
- 删除旧的 prompt 分类器与大量硬编码模式表，测试同步改为围绕结构化状态与失败恢复行为验证

## 0.3.6 - 2026-04-04

- 收紧 plan / swarm / team 的误触发条件，减少只输入一段需求就被过度路由到计划或并行代理的问题
- 为代理链路下的 `WebSearch` 增加失败记忆与智能恢复，避免同一失败条件下机械重试，同时在链路恢复后自动重新放行探测
- 继续保持主线程更接近 Claude Code 原生习惯，降低无谓干预

## 0.3.5 - 2026-04-03

- 按职责拆分过大的核心脚本与专题测试，降低后续修改时的遗漏和回归风险
- 保持现有路由、会话记忆、校验与回归行为不变，继续维持当前使用方式
- 修正文档中的配置数量与重装说明，使 README 与实际情况保持一致

## 0.3.4 - 2026-04-03

- 修复 worktree 失败记忆相关回归测试在 Linux 发布环境下的路径兼容问题，恢复发版校验稳定性
- 保持 0.3.3 的功能修复不变，确保自动解封与 fail-closed 行为可以稳定通过跨平台验证

## 0.3.3 - 2026-04-03

- 修复 worktree 前提失败后在同一 session 中拦截过于保守的问题，避免环境已恢复后仍持续 deny
- 当当前 cwd 已进入 git 仓库，或已补上 `WorktreeCreate` hooks 时，自动解除陈旧的 worktree 失败记忆，恢复原生 `EnterWorktree` / `Agent(isolation=worktree)` 路径
- 继续保持只对宿主已明确证明不成立的确定性前提错误执行 fail-closed，减少机械重试，同时不影响正常原生工具与 agent 使用

## 0.3.2 - 2026-04-03

- 强化持续协作型多 agent 任务的原生 team 路径，先建团队、再建 task board、再派 teammate，减少团队刚启动就跑偏
- 明确区分只读 teammate 与可写 teammate 的适用场景，减少把实现任务误派给只读 agent 导致的空转
- 增强 team 内任务认领、交接、恢复引导，降低 idle、`0 tool uses`、task 失配后直接卡住的概率

## 0.3.1 - 2026-04-03

- 调整多 agent 路由，让一次性并行任务与持续协作任务更容易走到合适的原生路径
- 让持续协作型任务更容易主动进入团队流程，减少“该用 team 却没用”的情况
- 为纯文本 `SendMessage` 增加兼容处理，减少 `summary is required when message is a string` 错误
- 更新 README，补充安装、使用、升级与排错说明

## 0.3.0 - 2026-04-02

- 提升第三方模型对当前会话可用能力的识别，减少明明已有 skill / workflow 却没接着用的问题
- 修复在已知 MCP resource、已可直接调用工具或已加载流程时仍反复泛搜的问题
- 优化不同内建 agent 的分工，减少研究、规划、实现混用造成的低效

## 0.2.10 - 2026-04-02

- 修复第三方模型即使已经看到 surfaced skill，仍重复发现或重写流程的问题
- 增强对已加载 skill / workflow 连续体的识别，减少同一流程被反复重新加载
- 进一步区分 surfaced skill、`DiscoverSkills` 与 `ToolSearch` 的适用场景，减少绕路

## 0.2.9 - 2026-04-02

- 修复第三方模型过度偏向少数原生工具、忽视宿主已暴露 skill / workflow 的问题
- 让已有流程更容易被继续使用，而不是每次从头摸索
- 明确 `Skill`、`DiscoverSkills`、`ToolSearch` 各自负责的场景，减少误用

## 0.2.8 - 2026-04-02

- 修复代理链路下对 `WebSearch` 过度悲观的问题，仍优先尝试宿主原生 WebSearch
- 避免在 `Did 0 searches` 等情况下把记忆误当成真实联网结果

## 0.2.7 - 2026-04-02

- 围绕 #7 新增统一的默认 Agent 模型配置，减少每个 Agent 单独设置后仍不生效的问题
- 围绕 #7 兼容 Opus 默认模型的常见写法，保证默认配置更稳可用
- 围绕 #8 修复普通并行 worker 意外继承 worktree 隔离的问题，减少 subagent 创建失败和 0 tool uses
- 围绕 #9 增加共存兼容模式，减少与 OMC 等同类插件同时启用时的提示冲突

## 0.2.6 - 2026-04-01

- 围绕 #6 修复普通 subagent 被误当成 team teammate 的问题
- 阻止 `main` / `default` 这类占位团队名造成误路由
- 优化中文会话下的原生表达风格

## 0.2.5 - 2026-04-01

- 围绕 #4 修复新版本 Claude Code 对 `Agent.model` 校验更严格后，第三方别名容易报错的问题
- 将模型 override 收敛到宿主安全槽位，减少 `Invalid tool parameters`
- 围绕 #3 提高本地安装与升级路径的稳定性

## 0.2.4 - 2026-04-01

- 修复在不同 Claude CLI 调用形式与 Windows 环境下本地验证容易失效的问题
- 避免检查后残留用户插件启用状态
- 改进失败信息，减少排障成本

## 0.2.3 - 2026-04-01

- 移除遗留兼容包袱，减少对当前会话的多余干扰
- 收紧路由与输出提示，避免向模型注入无关的代理或兼容性评论
- 让主会话更接近安静的 native-first 行为

## 0.2.2 - 2026-04-01

- 修复普通多 worker 任务过度走 `TeamCreate` 的问题
- 改进 worker 续派与收尾方式，避免误把 `TaskOutput` 当默认轮询入口
- 保留显式任务盘需求时的原生 `Task*` 路径

## 0.2.1 - 2026-04-01

- 降低 hello2cc 对已有项目规则和输出格式的干扰
- 恢复 Markdown 优先展示，减少不必要的 ASCII 倾向
- 让主线程和 subagent 行为更接近宿主原生

## 0.2.0 - 2026-04-01

- 让路由优先依据实际暴露能力，而不是宽泛关键词
- 扩展对更多原生能力的引导，减少“有能力却不会用”的情况
- 减少过宽的意图识别和模型注入

## 0.1.3 - 2026-03-31

- 减少 npm 发布时的手工错误和空跑
- 修复工作流条件判断问题，提高发布稳定性

## 0.1.2 - 2026-03-31

- 新增自动化发布能力，减少版本发包和插件版本不一致问题

## 0.1.1 - 2026-03-31

- 增强强制 output style 下的原生工作习惯保持能力
- 兼容旧本地通知路径，避免历史安装升级后直接报错
- 改进 `ToolSearch` 可用性判断与失败提示

## 0.1.0 - 2026-03-31

- 核心插件路径趋于稳定，默认使用方式更接近原生
- 稳定主线程默认行为，减少启用后偏离原生 Claude Code 习惯的情况

## 0.0.10 - 2026-03-31

- 默认启用后更接近原生会话，不再需要额外切换主线程入口
- 减少对用户既有 output style 和会话设置的侵入
- 缩小 `Agent.model` 注入范围，降低对原生行为的破坏

## 0.0.9 - 2026-03-31

- 稳定首批 native-first 默认行为，减少首次安装后的不确定性
- 收紧会话状态处理，减少真实使用中的不稳定

## 0.0.7 - 2026-03-31

- 默认启用主线程 agent，让插件开箱更接近原生使用
- 支持从 transcript 恢复当前会话模型，减少缺少 model 时的误注入

## 0.0.6 - 2026-03-31

- 支持镜像当前会话模型，减少硬编码默认模型带来的偏差
- 自动管理 output style，降低首次启用门槛
- 改善表格型输出场景的表达

## 0.0.5 - 2026-03-30

- 细化常见原生路径的使用建议，减少任务走错入口
- 收紧 subagent 的开始与收尾行为，减少结果不稳定
- 降低修改后只在真实 Claude Code 会话里才暴露问题的风险

## 0.0.2 - 2026-03-30

- 移除内嵌 skills，避免插件自身技能体系干扰宿主原生路径
- 简化提示与输出风格，走更干净的 native-first 基线

## 0.0.1 - 2026-03-30

- 切换为 native-first 路由
- 修复 `Agent.model` 注入字段
- 新增原生输出风格和基础自动化校验
