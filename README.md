# hello2cc

`hello2cc` 是一个面向 Claude Code 的 **skill-free、native-first** 插件。

它不负责接管 provider、网关或模型映射；它只负责在你已经用 `ccswitch`、provider profile、模型网关或原生槽位映射把第三方模型接进 Claude Code 之后，让这些模型在 Claude Code 里更接近原生 `Opus / Sonnet` 的使用体验。

当前版本：`0.1.2`

---

## 这个插件解决什么问题

`hello2cc` 不解决“第三方模型如何接入 Claude Code”。

那一层应该继续交给：

- `ccswitch`
- provider profile / gateway
- 原生模型槽位映射
- 你自己的第三方 API 代理

`hello2cc` 解决的是下一层：

> 当第三方模型已经能被 Claude Code 正常调用后，如何让它们更像 Claude Code 原生模型一样：
>
> - 主动先用原生工具
> - 更自然地走 `ToolSearch`
> - 更自然地走 `Plan` / `Task*`
> - 更自然地调用原生 `Agent` / `TeamCreate`
> - 输出更接近原生 Claude Code 的简洁、结构化、行动优先风格

---

## 0.1.2 的核心方向

这次版本直接对齐了 Claude Code 最新插件机制里的两条官方路径：

1. **插件默认主线程 agent**
2. **插件 `force-for-plugin` output style**

同时保留最小必要的 hook 增强：

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse(Agent)`
- `SubagentStart`
- `SubagentStop`
- `TaskCompleted`
- `ConfigChange`
- 兼容旧 `notify.mjs` 路径

目标是：

- 不靠 skills
- 不靠每次手动加载
- 不靠写用户 `~/.claude/settings.json`
- 尽量复用 Claude Code 已有原生能力

---

## 当前架构

```text
第三方模型 API
        │
        ▼
ccswitch / provider profile / gateway / 原生槽位映射
        │
        ▼
Claude Code 当前主模型槽位（如 opus / sonnet）
        │
        ▼
hello2cc
├─ settings.json                    -> 默认主线程 agent（插件级，最低优先级）
├─ agents/native.md                 -> model: inherit
├─ output-styles/hello2cc-native.md -> force-for-plugin: true
├─ SessionStart                     -> 建立 native-first 行为基线
├─ UserPromptSubmit                 -> 注入轻量原生路由提示
├─ PreToolUse(Agent)                -> 仅修正必要的原生 agent 模型路径
├─ transcript/session cache         -> 恢复当前真实会话模型
├─ ConfigChange                     -> 配置变化后清空陈旧 session 镜像
├─ SubagentStart                    -> Explore / Plan / General-Purpose 职责增强
├─ SubagentStop                     -> 子代理输出质量护栏
└─ TaskCompleted                    -> 任务完成证据护栏
```

---

## 关键设计

### 1）默认主线程 agent：走官方支持路径

插件根目录内置了：

```json
{
  "agent": "hello2cc:native"
}
```

这不是随便写的字符串，而是 Claude Code 插件 agent 在运行时的**真实命名空间名称**。

主线程 agent 文件本身仍然是：

- `agents/native.md`

但 Claude Code 在加载插件 agent 时会自动命名空间化，所以最终 agent id 是：

- `hello2cc:native`

它的模型设置是：

- `model: inherit`

这意味着：

- 如果你当前主会话是 `opus`，它继续 inherit `opus`
- 如果你把 `opus` 映射到了第三方模型，它继续 inherit 那个映射后的槽位
- 插件不会把主线程硬锁到某个固定第三方模型名

### 2）output style：改为 `force-for-plugin`

`0.1.0` 不再自动写用户级 `~/.claude/settings.json`。

现在使用的是 Claude Code 插件 output style 的官方机制：

```yaml
force-for-plugin: true
```

这带来几个变化：

- 启用插件后，宿主支持该机制时会直接应用 hello2cc 的 output style
- 不需要手动去 `/config` 里选择
- 不需要在首次启动时偷偷改用户 settings
- 插件卸载或禁用后，也不会留下持久化的 outputStyle 污染

hello2cc 的 output style 被设计成**很薄的一层覆盖**：

- 保持 Claude Code 原生工作流
- 强调 concise / structured / action-first
- 强调表格优先展示 inventories / matrices / validation summaries
- 不把主线程强行改造成“插件自定义流程”

### 3）Agent 模型注入：缩到最小必要范围

`0.1.0` 不再对所有原生 `Agent` 调用大面积硬注入模型。

现在只在这些场景优先修正：

- `Claude Code Guide`
- `Explore`
- 你显式配置了 `plan_model`
- 你显式配置了 `general_model`
- 你显式配置了 `team_model`
- 你显式配置了 `subagent_model`

这样做的目的，是尽量保留 Claude Code 原生行为：

- `Plan` 默认本来就是 `inherit`，那就不改
- `general-purpose` 默认本来就更接近 native inherit，那就不乱改
- 自定义 agent 默认本来就能 inherit，那就不乱改

只在源码里已知会偏向轻量模型的路径上做修正，避免“插件过度接管”

### 4）配置变更后不保留陈旧 session 镜像

增加了 `ConfigChange` hook。

当 Claude Code 的相关 settings 变化时，hello2cc 会清空缓存的 session model snapshot，避免：

- 之前会话里的旧模型别名
- 在配置切换后继续被误复用

这让切换模型映射、切换默认模型、替换配置文件时更稳。

### 5）ToolSearch：hello2cc 会主动用，但不能越过宿主门控

Claude Code 最新源码已经明确表明：

- `ToolSearch` 是否真正可用，不是插件单方面决定的
- 它受宿主门控影响，核心条件包括：
  - 当前会话是否真的暴露了 `ToolSearch`
  - 当前模型是否支持 `tool_reference`
  - 你的网关 / provider / `ANTHROPIC_BASE_URL` 是否透传 beta headers 与 `tool_reference` blocks
  - `ENABLE_TOOL_SEARCH` 是否开启

所以 `hello2cc` 在这一层做了两件事：

- **行为层**：在会话中优先引导第三方模型先用原生 `ToolSearch`
- **诊断层**：如果当前会话没有暴露 `ToolSearch`，会明确提示这是宿主 / 网关门控问题，并给出修复方向，而不是假装插件可以强行开启

如果你通过第三方网关接入 Claude Code，推荐至少满足：

- `ENABLE_TOOL_SEARCH=true`
- 网关支持并透传 `tool_reference`
- 网关支持并透传 Claude Code 所需 beta headers

否则即使界面里偶尔看得到 `ToolSearch` 相关词汇，也不代表真实 defer-loading / tool-reference 路径一定能工作。

### 6）兼容旧 `notify.mjs` 引用，降低历史残留配置报错

部分早期环境里，用户可能残留过旧的通知脚本或 stop hook 引用，例如：

- `scripts/notify.mjs inject`
- `scripts/notify.mjs route`
- `scripts/notify.mjs stop`
- `notify = ["node", ".../scripts/notify.mjs", "codex-notify"]`

当前版本继续保留一个轻量兼容脚本：

- `scripts/notify.mjs`

它的作用不是恢复旧架构，而是：

- 把旧的 `inject / route` 调用兼容转发到当前 `orchestrator.mjs`
- 把旧的 `stop / pre-compact / codex-notify` 调用安全降为 no-op

这样可以显著降低历史残留路径导致的报错概率。

但要注意：

- 如果你的 Claude Code 配置里仍然把脚本路径硬编码成一个**已经被删除的临时目录**（例如 `npm-cache/_cacache/tmp/git-clone.../scripts/notify.mjs`），那不是 hello2cc 运行时能在插件层修复的
- 那种情况说明你还有一条**外部旧配置**在调用一个已经不存在的绝对路径，需要手动改回稳定路径或删除旧配置

---

## 为什么这样更接近原生体验

因为 Claude Code 最新源码已经表明：

- 插件可以官方式设置默认 `agent`
- 插件 output style 可以官方式 `force-for-plugin`
- 插件 settings 只允许安全的少量字段进入 settings cascade
- `PreToolUse` hook 可以把 `updatedInput` 真正送进工具执行
- `transcript_path` 是官方稳定 hook 输入字段

也就是说，`hello2cc` 现在尽量走的都是：

- 宿主本来就支持的入口
- 宿主本来就支持的能力
- 宿主本来就支持的优先级体系

而不是再造一套 skills-first 的旁路工作流。

---

## 插件会不会影响 Claude 原生模型或别的模型

### 主线程 agent 不会把你锁死

Claude Code 最新源码里，插件 settings 是 settings cascade 的**最低优先级 base layer**。

这意味着：

- 插件默认 agent 只是一个底层默认值
- 用户 settings / 项目 settings / local settings / CLI 参数 都能覆盖它

所以：

- 你手动切换 agent
- 你改更高优先级 settings
- 你切换回原生模型

都不会被这个插件永久锁死。

### output style 会跟随插件启用状态

`force-for-plugin` 的含义是：

- 插件启用时，该 output style 生效
- 插件禁用/卸载时，不再生效

它不会像旧方案那样改写用户持久化 settings。

如果你希望完全回到宿主默认 output style：

- 直接禁用插件即可

---

## 安装

### 1）添加本地 marketplace

```text
/plugin marketplace add /absolute/path/to/hello2cc
```

### 2）安装或升级插件

```text
/plugin install hello2cc@hello2cc-local
```

### 3）新开会话后直接使用

安装后不需要再加载 skills。

默认会发生：

- 主线程默认走 `hello2cc:native`
- output style 通过 `force-for-plugin` 自动应用
- 原生 `Agent` / `TeamCreate` / `Task*` / `ToolSearch` 路由被轻量增强
- 当前会话模型会优先用于必要的原生 agent 修正

---

## 配置项

| 配置键 | 默认行为 | 说明 |
|---|---|---|
| `routing_policy` | `native-inject` | `native-inject` 会对必要路径静默补 `Agent.model`；`prompt-only` 只注入提示，不改工具输入 |
| `mirror_session_model` | `true` | 优先镜像当前会话模型别名 |
| `primary_model` | 空 | 高能力原生 agent 的显式模型；为空时优先用当前会话模型 |
| `subagent_model` | 空 | 为未显式设模的原生 agent / teammate 强制指定统一模型；为空时尽量保留宿主 inherit |
| `guide_model` | 空 | `claude-code-guide` 的显式模型 |
| `explore_model` | 空 | `Explore` 的显式模型 |
| `plan_model` | 空 | 仅当你想强制覆盖 `Plan` 时填写 |
| `general_model` | 空 | 仅当你想强制覆盖 `general-purpose` 时填写 |
| `team_model` | 空 | 仅当你想强制覆盖带 `team_name` 的 teammate 时填写 |

---

## 推荐配置

### 配置 A：最接近原生槽位体验

适合已经用 `ccswitch` 或网关把第三方模型映射到了 Claude Code 原生槽位。

- `mirror_session_model = true`
- 其他模型配置全部留空

效果：

- 主线程 inherit 当前槽位
- `Claude Code Guide` / `Explore` 优先跟随当前会话模型
- `Plan` / `general-purpose` / 自定义 agent 默认保留宿主 inherit

### 配置 B：只修正 Guide / Explore

- `mirror_session_model = true`
- `subagent_model` 留空
- `plan_model` / `general_model` / `team_model` 留空

这是当前默认思路，侵入性最低。

### 配置 D：第三方网关下尽量保住 ToolSearch

适合：

- 你通过 `ANTHROPIC_BASE_URL`
- provider profile / gateway
- `ccswitch` 外接第三方模型

推荐同时满足：

- Claude Code 环境里设置 `ENABLE_TOOL_SEARCH=true`
- 网关支持 `tool_reference`
- 网关支持 beta headers 透传

这不是 hello2cc 的偏好项，而是 Claude Code 宿主本身对 ToolSearch 的真实门控条件。

### 配置 C：你明确要强制某些子代理走固定模型

例如：

- `guide_model = cc-gpt-5.4`
- `explore_model = cc-gpt-5.3-codex-medium`

或：

- `general_model = opus`
- `team_model = opus`

只有在你明确想覆盖宿主 native inherit 时再这样配。

---

## 本地验证

```bash
npm run validate
npm test
npm run check
npm run test:real
```

说明：

- `npm run validate`：校验 manifest、hooks、settings、output style 和核心脚本结构
- `npm test`：运行单元测试，覆盖 session model mirror、namespaced default agent、ConfigChange 清理、最小必要模型注入等
- `npm run check`：组合执行 `validate + test`
- `npm run test:real`：调用本机 Claude Code CLI 做真实会话回归

如果 `npm run test:real` 提示：

- 当前模型别名无效
- 你没有对应模型访问权限

这说明是**Claude Code 当前模型映射本身**有问题，不是 hello2cc 核心逻辑失败。  
此时请先修复当前会话模型映射，或通过环境变量显式指定一个可用别名再跑：

```bash
HELLO2CC_REAL_MODEL=opus npm run test:real
```

Windows PowerShell 例如：

```powershell
$env:HELLO2CC_REAL_MODEL = "opus"
npm run test:real
```

### ToolSearch 自检

安装 hello2cc 后，如果你要确认第三方模型是否真的已经具备 Claude Code 原生 `ToolSearch` 能力，重点看三件事：

1. Claude Code 会话初始化里是否真的暴露了 `ToolSearch`
2. hello2cc 注入的上下文里是否把 `ToolSearch` 作为优先发现路径
3. 如果没有暴露，hello2cc 是否明确提示你检查：
   - `ENABLE_TOOL_SEARCH`
   - `ANTHROPIC_BASE_URL`
   - 网关对 beta headers / `tool_reference` 的透传

也就是说，hello2cc 现在会尽量做到：

- **可用时主动用**
- **不可用时明确报因**
- **不再假装插件能越过 Claude Code 宿主门控**

---

## npm 自动发布

hello2cc 现在已经补齐了和 `helloloop` 同类的 GitHub Actions 自动发布链路：

- 工作流文件：`.github/workflows/publish.yml`
- 触发方式：
  - 推送 `v*` tag 时自动发布
  - 也支持手动 `workflow_dispatch`，直接指定 tag
- 发布通道：
  - `vX.Y.Z` → `latest`
  - `vX.Y.Z-beta.N` → `beta`
- 发布前检查：
  - `package.json` 版本必须和 tag 基础版本一致
  - `.claude-plugin/plugin.json` 版本必须和 tag 基础版本一致
  - `repository.url` 必须和当前 GitHub 仓库一致
  - 自动执行 `npm run check`
  - 自动执行 `npm pack --dry-run`
- 发布后动作：
  - 自动创建或更新同名 GitHub Release

### 认证方式

工作流同时支持两种 npm 发布认证路径：

1. `NPM_TOKEN` 仓库 secret  
   适合首发阶段，最直接。

2. npm Trusted Publishing（GitHub OIDC）  
   适合后续长期自动发布，不需要长期保存 npm token。

### 首次发布注意事项

由于当前 `hello2cc` 这个 npm 包还没有发布记录，**首次发布通常需要先完成一次 npm 侧的认证/bootstrap**。常见做法有两种：

- 先在 GitHub 仓库里配置 `NPM_TOKEN` secret，再通过 workflow 发首个版本
- 或者先完成一次首发，再把该仓库接到 npm 的 trusted publishing，后续改为无 token 自动发布

如果仓库里既没有 `NPM_TOKEN`，npm 侧又还没配好 trusted publishing，那么 workflow 会进入发布步骤，但 npm 会拒绝真正发布。

### 推荐发布流程

1. 确认 `package.json` 与 `.claude-plugin/plugin.json` 版本一致
2. 提交并推送主分支
3. 创建 tag，例如：

```bash
git tag v0.1.2
git push origin v0.1.2
```

4. 等待 GitHub Actions 自动发布到 npm

如果你要补发旧版本，也可以在 Actions 里手动运行 `Publish to npm`，输入已有 tag，例如 `v0.1.2`

---

## 当前边界

`hello2cc` 能显著把第三方模型体验拉近 Claude Code 原生模型，但它不是字节级复刻。

当前边界包括：

- 无法拿到 Claude Code 内部未公开的完整 system prompt
- 无法复制 Claude 官方模型内部的隐藏策略和 provider 侧特性
- 无法保证所有内部未公开路径都可被插件 hook 拦截
- 无法在插件层强行绕过 Claude Code 对 `ToolSearch` / `tool_reference` 的宿主门控
- `force-for-plugin` output style 会在插件启用时统一生效；如果你想完全关闭这层覆盖，需要禁用插件

所以它的目标不是：

- “完全复制 Opus 的每一个内部行为”

而是：

- **在不依赖 skills、不依赖手动加载、不破坏 Claude Code 原生工作流的前提下，让第三方模型尽可能接近原生体验。**

---

## 许可证

Apache-2.0
