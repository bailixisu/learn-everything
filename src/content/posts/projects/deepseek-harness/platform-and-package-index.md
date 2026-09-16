---
title: "DeepSeek Harness 项目详解（四）：应用入口、Web UI 与完整包索引"
description: "解释 profile/preset 装配、Web Host 与 Client、Typert RPC、TypeScript/Python SDK、工程验证，并提供 49 组 219 包的中文职责索引。"
pubDatetime: 2026-09-16T14:37:58+08:00
featured: false
draft: false
type: project
project: deepseek-harness
series: "DeepSeek Harness 源码详解"
order: 4
tags:
  - Agent
  - DeepSeek Harness
  - Web
  - SDK
---

前两篇分别讲了[运行与状态](/posts/projects/deepseek-harness/runtime-and-state)、[工具与编排](/posts/projects/deepseek-harness/tools-and-orchestration)。本篇解释这些模块怎样成为可以打开的应用，以及其他程序怎样接入。文末给出本地提交 `47f9438` 的 **49 个模块组、219 个包**完整中文索引；整个系列入口是[整体架构](/posts/projects/deepseek-harness/project-overview)。

## 1. CLI、Boot、Bundle：启动的是一棵插件树

### CLI 只负责入口分派

`apps/cli/src/bin.ts` 读取参数后，分派到 profile 启动、插件管理或配置树导出。它按模式动态导入对应入口，不把所有产品能力写在一个主程序里。

`boot/app-boot` 提供环境加载、配置选择、Loader 启动与等待插件树稳定的公共逻辑；`boot/cmdline` 将启动参数以不可变快照交给应用插件。

### Bundle 决定应用由什么组成

| 组合包            | 内容                                     | 典型使用                              |
| ----------------- | ---------------------------------------- | ------------------------------------- |
| `bundle/base`     | Agent 主干、模型、基础工具、持久化与策略 | 其他产品组合的共同基础                |
| `bundle/headless` | 一次性任务运行器                         | 自动化执行并打印最终答案，无 Web 服务 |
| `bundle/web-app`  | HTTP、浏览器插件、工作区与界面运行胶水   | `dsh web`                             |

Profile 是具名的组合及用户覆盖层。当前覆盖顺序为：

```text
空配置
  → profile 按顺序列出的 bundle patch
  → profile 自己的 cordis.patch.yml
  → Harness home 的 cordis.patch.yml
  → 命令行 --patch
```

Patch 可以按 id 找到一个条目并替换其整个 config，或插入新条目；不能误以为配置对象的每个字段都会自动深合并。

`web` 与 `headless` 是随发行版提供的模板。CLI 文档中的 `tui` 例子明确以“已安装该 profile”为前提，不应把它写成当前仓库自带的第三个默认入口。

来源：[CLI 说明](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/apps/cli/README.md)、[profile 实现](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/boot/app-boot/src/profile.ts)。

## 2. Preset：同一个进程中的不同 Agent 配置

Profile 决定整个运行应用，Preset 决定 Agent 可以看见的提示词、工具与协作能力。两者不处于同一层。

`preset/agent-presets` 发现预置或用户维护的目录，读取 `agent.cordis.yml`。当前实现为每个 preset 建一个进程内常驻挂载，再把 Agent 的 scope 接到该挂载；同一个 preset 可以供多个会话使用。`preset/persona` 提供可覆盖的角色提示词。

Host 需要读取的注册表和服务，例如 Tools、Goals、Jobs、Subagents、Token Meter，仍留在 Host 层。Preset 往这些注册表贡献工具与提示词，而需要私有服务的组合使用 `isolate`。

一个具体例子：standard preset 可以贡献 `tool-goal`，但 `ctx.goals` 仍由 Host 持有，这样 Web 的目标栏与模型工具读取的是同一份会话目标状态。

内置 preset 目录包括 standard、minimal、code、cordis。名字提示它们的用途，但完整能力应阅读各自的组合文件，不按名字猜测。

界面不会把已开始工作的会话任意切换到另一套 preset；新会话或尚未产生内容的空白会话才有相应选择空间。预置组合以只读方式查看，用户通过复制及打开本地文件继续修改，浏览器不直接提交任意 YAML 文本。

依据：[standard 配置](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/apps/cli/config/agent-presets/standard/agent.cordis.yml)、[preset 注册与挂载](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/preset/agent-presets/src/index.ts)。

## 3. Settings 与 Credentials：设置值和秘密值分开

`settings` 负责注册命名空间 schema、按层解析设置并提交变更；`settings-file` 持久化本地设置并监听外部编辑。界面可以根据 schema 提供编辑器，而不为每个插件手写一套字段解析。

`credentials` 处理凭据引用；`credentials-local` 负责从环境与本地文件解析实际秘密值。模型或插件配置携带引用，消费方在具体操作边界解析它，避免配置展示接口直接携带秘密内容。

启动环境由 `util/launch-environment` 保留不可变分层快照，记录某个值来自进程环境、启动目录 `.env` 还是 Harness home `.env`。该层关注来源与优先级；它不意味着后来在 Web 中切换工作区，就再次读取新工作区的环境文件。

本次说明只检查源码中的机制，没有读取用户凭据或 `.env` 内容。

## 4. Web Host 与 Client 怎样配合

### Host：业务对象、路由和系统能力

`host/webserver` 是 HTTP 路由载体，`host/frontend-static` 提供构建后的 SPA 文件，`host/apiproxy` 是与传输无关的 Host API 与仍在使用的业务分派接口。

目录选择单独拆成 `directory-picker` 接口、native/browse 两个实现和 auto 组合器；是否弹系统目录框、是否使用应用内目录浏览由宿主环境和配置决定。`plugin-inventory` 提供已加载插件的只读清单。

### Client：共享运行态与功能插件

`apps/web` 只是 Vite 入口。实际浏览器能力集中在 `packages/client`：

| 层次         | 包                                                                 | 职责                                                 |
| ------------ | ------------------------------------------------------------------ | ---------------------------------------------------- |
| 启动与装载   | `web`、`modules`、`web-react`、`hmr`                               | 装载浏览器插件，连接 React 与运行时，处理开发重载    |
| 传输         | `connection`                                                       | HTTP 请求、两条事件下行、断线重连与握手              |
| 数据与组合   | `runtime`、`ui-slots`、`schema-form`                               | 会话对象、状态投影、扩展槽、表单草稿                 |
| 会话主体     | `ui-conversation`、`ui-tool`、`ui-trajectory`                      | 输入、聊天、工具树和执行轨迹                         |
| 工作区与导航 | `ui-layout`、`ui-sidebar`、`ui-workspace`                          | 布局、导航、工作区管理                               |
| 人机协作     | `ui-goal`、`ui-plan`、`ui-user-questions`、`ui-permission-presets` | 目标、计划评审、提问、权限                           |
| 扩展能力     | 其余 `ui-*`                                                        | 模型、技能、子 Agent、工作流、附件、产物、反馈、设置 |

Slot 是界面扩展位置。功能插件向相应位置注册渲染器，使新能力不需要持续修改一个巨大的聊天组件。Conversation 与 Trajectory 也可以从同一事实流形成不同展示。

### 当前传输：HTTP 上行，两条 WebSocket 下行

```text
用户操作
  → Client 对象/Remote 方法
  → HTTP POST /api
  → Typert Gateway 或 API Proxy
  → Agent / Session / 其他领域服务

服务变化与会话活动
  → events.host / events.mux
  → 两条只负责下行的 WebSocket
  → Client Runtime 更新对象与投影
  → React 功能插件重新展示
```

当前源码有 `websocket-downlink.ts` 与 `client/web-api-client.ts`，浏览器业务事件没有 SSE fallback。配置文件中的个别旧注释仍写“fetch/SSE”，不能据此解释当前实现；开发 HMR 等其他通道也不能与业务事件混同。

`connection` 还检查 Host/Origin 等浏览器访问条件，一些高权限方法限于 loopback。包说明明确当前没有完整身份认证层，因此 Web Host 的访问限制不能描述为多租户账号权限系统。

依据：[连接层说明](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/connection/README.md)、[浏览器传输实现](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/connection/src/client/web-api-client.ts)、[Client 模块](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/README.md)。

## 5. API 与 Typert：让类型信息跨越进程与浏览器

这两组解决“Host 的公开业务方法怎样成为可验证的浏览器 API”。

| 包                 | 工作时机       | 输出或职责                                         |
| ------------------ | -------------- | -------------------------------------------------- |
| `typert/generator` | 构建期         | 从 TypeScript 分析类型图、服务、事件与 Remote 描述 |
| `typert/protocol`  | 构建与运行共享 | 不依赖编译器的元数据与协议类型                     |
| `typert/registry`  | 运行期         | 保存反射信息、schema、查询解析器等                 |
| `typert/loader`    | 插件装载期     | 发现并注册生成的产物                               |
| `api/gateway`      | RPC 调用期     | 定位服务、验证参数、解析对象身份、调用并验证结果   |
| `api/remotes`      | 应用装配期     | 选择对外业务 API，统一 Agent/Session 查找策略      |

TypeScript 的静态类型编译后不能直接验证网络 JSON；Typert 生成的运行描述补上了这层连接。业务方法可以通过 `@Remote` 等标记参与生成，Client 再挂载对应方法。

Gateway 负责通用调用过程，Remotes 决定应用暴露什么以及怎样查找业务对象，Connection 负责传输和响应关联。旧 `apiproxy` 仍为尚未迁移的方法提供 fallback，不应把系统画成已经彻底删除旧 API 的状态。

来源：[Gateway](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/api/gateway/README.md)、[Typert Generator](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/typert/generator/README.md)。

## 6. SDK、Python 与 ACP：让其他程序使用 Harness

`sdk/protocol` 定义线协议，`sdk/server` 在 Harness 侧提供 stdio JSON-RPC 服务，`sdk/client` 提供 TypeScript 客户端。它们负责驱动一个给定可执行程序与配置的运行时，不承担创建或构建任意开发项目的工作。

Python 的 `deepseek_harness` 是这套进程外服务的客户端。`python/sdk` 管 Python API，`python/sdk-runtime` 管配套运行时与平台分发。默认入口可启动同版本捆绑的运行时，并在多次调用间复用子进程。

下面是仓库 SDK 文档中的最小使用形态，本次没有安装或执行它：

```python
from deepseek_harness import DeepSeekHarness

with DeepSeekHarness() as harness:
    result = harness.run("Say hi.")
```

高层 `Session.run()` 管理从输入回执到整个 Agent idle 的活动区间；`final_response` 是区间内根会话最后提交的 Assistant 文本，`finish_reason` 来自相应最后轮次结束。低层 `session_prompt()` 只返回入队身份，不替调用方定义之后何时算结束。

`acp/acp` 是面向自动化的 Agent Client Protocol 服务端。要区分它和 `subagent/subagent-acp`：前者让外部程序驱动当前 Harness，后者让当前 Harness 驱动外部子 Agent。Claude Code/Codex hooks 又是第三种机制，只桥接钩子，不等同于 ACP 或 SDK。

依据：[SDK 组](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/README.md)、[Python API](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/python/sdk/README.md)、[ACP](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/acp/README.md)。

## 7. 工程支持：219 个包如何保持一致

| 机制           | 位置                                                       | 解决的问题                                                      |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| 运行时不变量   | `runtime-diagnostics/invariants` 与包级 `src/invariant.ts` | 检查事件配对、状态转移、请求重建等真实关系                      |
| 测试底座       | `test-support`                                             | 无密钥回放、模型故障模拟、Loader 冒烟、Agent 与 Client 测试环境 |
| 示例组合       | `packages/examples` 与根 `examples`                        | 在真实装配上验证一次完整执行，而不只测孤立函数                  |
| 静态与产物门禁 | `scripts`                                                  | 类型、包导出、依赖边界、许可证、目录与构建产物一致性            |
| 文档生成       | `scripts/gen-*`、`docs`                                    | 工具、服务、配置、事件和持久化目录                              |
| 框架快照       | `vendor`                                                   | 固定 Cordis 等上游源码与本地修改                                |
| 原生能力       | `native/landlock-run`                                      | Linux Landlock 启动器与平台产物                                 |
| 文档站         | `website`                                                  | 将选定双语文档投影成 VitePress 站点                             |

运行不变量用于检查活跃运行中的关系，不是对所有方法是否存在再写一遍检查。部分无合适运行关系的纯工具包可以提供有说明的空 companion。

项目列出了单元测试、snapshot、真实 API e2e、Web 测试、build、hygiene、doc-sync 等不同门禁。仓库要求 CI 对相应源文件执行覆盖率门禁；这只是测试策略说明，**不是本次运行后测得的通过率**。

## 8. 如何查看实际装配

以下命令来自当前源码与 CLI 文档，在目标 `deepseek-harness` 仓库运行。本次只检查了说明和实现，没有安装依赖、启动模型任务或改动目标源码。

```sh
# 查看实际配置，不启动应用
pnpm dsh --profile web --dump-config

# 从源码准备构建后打开 Web
pnpm install
pnpm run build
pnpm dsh web

# 执行一次任务：需要对应模型配置和凭据
pnpm dsh --profile headless "解释当前项目的入口"
```

根 `package.json` 声明 Node.js `^22.19.0 || >=24.0.0`，包管理器为 `pnpm@11.7.0`。Web 默认监听 `127.0.0.1:3080`。已有用户 profile 和 patch 可能改变默认装配，所以本文不推断本机运行实例的所有配置值。

## 9. 219 个包的完整中文索引

以下路径相对于目标源码仓库。每行对应一个实际的 `packages/<group>/<package>/package.json`，共 219 行。链接固定到本次提交中的包 README；目录名与 npm 名称不总是一一相同，例如部分 Client 包带 `dsh-client-` 前缀，应以该包 `package.json` 为准。

正文逐层解释主要机制；本索引用于回答“这个目录归谁负责、应该从哪里继续读”。它不宣称逐行审计了所有包中的每个分支。

### acp（1 个包）

| 包目录                                                                                                                          | 职责                                              |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [acp](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/acp/acp/README.md) | 向自动化客户端暴露 Agent Client Protocol 服务端。 |

### api（2 个包）

| 包目录                                                                                                                                  | 职责                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [gateway](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/api/gateway/README.md) | Host/Client 两侧 Typert RPC 端点；验证与分派远程调用。       |
| [remotes](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/api/remotes/README.md) | 组合应用需要的 Remote API，统一 Agent/Session 身份查找策略。 |

### attachment（2 个包）

| 包目录                                                                                                                                                           | 职责                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [attachment](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/attachment/attachment/README.md)             | 不可变图片引用、格式校验、保存和读取接口。 |
| [attachment-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/attachment/attachment-local/README.md) | 在 Harness home 中按内容寻址保存图片实体。 |

### boot（2 个包）

| 包目录                                                                                                                                     | 职责                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [app-boot](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/boot/app-boot/README.md) | 环境分层、配置解析、Loader 启动及等待组合稳定。 |
| [cmdline](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/boot/cmdline/README.md)   | 把启动器参数快照和退出能力交给应用插件。        |

### bundle（3 个包）

| 包目录                                                                                                                                       | 职责                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [base](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/base/README.md)         | 所有产品 profile 共用的基础插件 patch 层。         |
| [headless](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/headless/README.md) | 无 Web 服务器的一次性 Agent 任务运行器与组合。     |
| [web-app](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/web-app/README.md)   | 浏览器应用 patch 层、静态前端挂载与 Web 运行信息。 |

### client（39 个包）

| 包目录                                                                                                                                                                               | 职责                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [connection](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/connection/README.md)                                     | 浏览器与 Host 的 RPC、HTTP 上行、WebSocket 下行和重连。          |
| [hmr](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/hmr/README.md)                                                   | 开发时发现浏览器插件产物重建并热替换插件。                       |
| [locale](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/locale/README.md)                                             | 中英文语言偏好、字典和本地化快照。                               |
| [modules](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/modules/README.md)                                           | Host 生成客户端入口图，浏览器侧维护模块装载表。                  |
| [runtime](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/runtime/README.md)                                           | 会话与工作区对象层、作用域树、投影和 SlotRegistry。              |
| [schema-form](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/schema-form/README.md)                                   | 根据 schema 校验、修改和维护设置表单草稿。                       |
| [ui-agent-preset](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-agent-preset/README.md)                           | 选择新会话 preset，显示既有会话 preset，管理副本与本地文件入口。 |
| [ui-attachment](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-attachment/README.md)                               | 待发送图片栏、消息图片画廊和原图灯箱组件。                       |
| [ui-commands](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-commands/README.md)                                   | 命令发现、斜杠输入和多种命令交互形式。                           |
| [ui-conversation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-conversation/README.md)                           | 聊天主体、输入框、消息顺序与详情区域。                           |
| [ui-deliverables](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-deliverables/README.md)                           | 在回复尾部展示生成的文件等交付物。                               |
| [ui-directory-picker-browse](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-directory-picker-browse/README.md)     | 应用内目录浏览与创建交互界面。                                   |
| [ui-directory-picker-native](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-directory-picker-native/README.md)     | 与宿主系统目录选择器配套的浏览器界面。                           |
| [ui-goal](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-goal/README.md)                                           | 当前目标的展示与管理入口。                                       |
| [ui-input-trigger](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-input-trigger/README.md)                         | 输入框中斜杠命令和 @ 引用等触发建议。                            |
| [ui-jobs](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-jobs/README.md)                                           | 会话后台任务列表与状态展示。                                     |
| [ui-layout](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-layout/README.md)                                       | 主应用区域和布局组合。                                           |
| [ui-message-feedback](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-message-feedback/README.md)                   | 逐 Assistant 消息的评分与备注界面。                              |
| [ui-model-selection](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-model-selection/README.md)                     | 会话模型选择与提供方目录展示。                                   |
| [ui-permission-presets](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-permission-presets/README.md)               | 默认权限与当前会话权限预设控制。                                 |
| [ui-plan](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-plan/README.md)                                           | 计划模式状态、进入与退出界面。                                   |
| [ui-primitives](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-primitives/README.md)                               | 共享 React 控件、图标与基础内容渲染。                            |
| [ui-settings](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-settings/README.md)                                   | 设置容器与设置扩展位置。                                         |
| [ui-settings-general](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-settings-general/README.md)                   | 通用设置页面。                                                   |
| [ui-settings-models](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-settings-models/README.md)                     | 模型提供方配置与 DeepSeek 配置引导。                             |
| [ui-settings-plugin-inventory](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-settings-plugin-inventory/README.md) | 设置中的 Host Loader 插件清单，只读查看。                        |
| [ui-settings-plugins](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-settings-plugins/README.md)                   | 插件设置分区、标签扩展与可配置插件卡片。                         |
| [ui-sidebar](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-sidebar/README.md)                                     | 工作区和会话导航侧栏。                                           |
| [ui-skill](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-skill/README.md)                                         | 技能引用与输入建议界面。                                         |
| [ui-slots](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-slots/README.md)                                         | 定义界面各扩展槽与功能注册约定。                                 |
| [ui-subagent](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-subagent/README.md)                                   | 子 Agent 导航、会话状态和输入引用。                              |
| [ui-theme](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-theme/README.md)                                         | 应用主题和颜色方案。                                             |
| [ui-tool](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-tool/README.md)                                           | 工具调用树、按工具区分的卡片和默认呈现。                         |
| [ui-trajectory](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-trajectory/README.md)                               | Agent 活动与模型请求的轨迹视图。                                 |
| [ui-user-questions](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-user-questions/README.md)                       | 展示模型发起的问题与对应人类回答。                               |
| [ui-workflow-run](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-workflow-run/README.md)                           | 从持久事件展示嵌套 Workflow 执行及活跃子任务导航。               |
| [ui-workspace](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/ui-workspace/README.md)                                 | 工作区选择、创建与相关操作。                                     |
| [web](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/web/README.md)                                                   | 根据客户端入口图启动浏览器插件环境。                             |
| [web-react](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/web-react/README.md)                                       | 将浏览器 Cordis 运行时与 React 渲染连接。                        |

### code-runtime（2 个包）

| 包目录                                                                                                                                                                                 | 职责                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [code-runtime](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/code-runtime/code-runtime/README.md)                             | 执行模型程序及异步宿主绑定的抽象接口。                   |
| [code-runtime-worker-thread](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/code-runtime/code-runtime-worker-thread/README.md) | 每次运行创建新 TypeScript worker，管理预算、输出和终止。 |

### compaction（4 个包）

| 包目录                                                                                                                                                                                     | 职责                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [command-compact](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/compaction/command-compact/README.md)                             | 人类手动请求压缩的命令入口。                          |
| [compaction](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/compaction/compaction/README.md)                                       | 压缩接口、事件词汇与保持工具调用/结果配对的边界辅助。 |
| [compaction-basic](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/compaction/compaction-basic/README.md)                           | 按上下文压力选择历史区域并调用模型生成摘要。          |
| [compaction-tool-result-pruner](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/compaction/compaction-tool-result-pruner/README.md) | 无需模型调用地缩减已记录的大体积工具结果视图。        |

### context（4 个包）

| 包目录                                                                                                                                                            | 职责                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [agent-instructions](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/context/agent-instructions/README.md) | 读取并注入工作区指令上下文。               |
| [session-reference](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/context/session-reference/README.md)   | 把其他会话有界快照转成带来源的上下文引用。 |
| [time-context](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/context/time-context/README.md)             | 提供当前时间与经过时间上下文。             |
| [tmux-context](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/context/tmux-context/README.md)             | 提供所在 tmux 会话/窗口等位置上下文。      |

### core（8 个包）

| 包目录                                                                                                                                                                   | 职责                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [agent](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent/README.md)                                     | Agent 公开接口、注册表、Inbox 与运行事件。             |
| [agent-default-model](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-default-model/README.md)         | 入口共享的部署默认模型选择。                           |
| [agent-loop](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-loop/README.md)                           | 默认 Agent 工厂、轮次状态机与工具批次调度。            |
| [agent-tool-presentation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-tool-presentation/README.md) | 按 Agent/preset 选择 native、code 或 both 工具呈现。   |
| [scope](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/scope/README.md)                                     | 作用域标识、父子链和按 Agent 过滤注册/事件的基础工具。 |
| [session](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/README.md)                                 | 只追加事件日志、内存存储、模型历史视图与 fork。        |
| [system-prompt](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/system-prompt/README.md)                     | 按作用域收集提示词片段与工具 schema。                  |
| [tools](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/README.md)                                     | 工具注册、校验、审批策略管线、结果规范化与 Code Mode。 |

### credentials（2 个包）

| 包目录                                                                                                                                                              | 职责                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [credentials](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/credentials/credentials/README.md)             | 凭据引用解析及不暴露实际值的描述接口。 |
| [credentials-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/credentials/credentials-local/README.md) | 从环境和本地文件读取或管理凭据实际值。 |

### e2b（3 个包）

| 包目录                                                                                                                                                | 职责                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [e2b](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/e2b/e2b/README.md)                       | 创建、持有与销毁共享 E2B 沙箱。            |
| [fs-e2b](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/e2b/fs-e2b/README.md)                 | E2B 文件系统接口实现。                     |
| [subprocess-e2b](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/e2b/subprocess-e2b/README.md) | E2B 命令、进程组、stdio、输出与 PTY 实现。 |

### examples（3 个包）

| 包目录                                                                                                                                                         | 职责                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [acp-demo](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/examples/acp-demo/README.md)                 | 包含 Agent 主干的 ACP 自动化示例组合。           |
| [agent-spine-demo](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/examples/agent-spine-demo/README.md) | 可复用的 Agent 主干示例装配。                    |
| [jsonrpc-demo](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/examples/jsonrpc-demo/README.md)         | 由外部配置决定插件树的 SDK JSON-RPC 示例运行时。 |

### extensions（4 个包）

| 包目录                                                                                                                                                                   | 职责                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [cordis-client-runner](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/extensions/cordis-client-runner/README.md) | 在浏览器侧运行动态定义的插件并处理运行请求。    |
| [cordis-host-runner](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/extensions/cordis-host-runner/README.md)     | 动态定义注册、Host 侧运行、服务检查与生命周期。 |
| [tool-cordis](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/extensions/tool-cordis/README.md)                   | 向模型提供运行时检查、定义和运行动态包等工具。  |
| [ui-cordis](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/extensions/ui-cordis/README.md)                       | 动态 Cordis 定义和运行结果的浏览器操作面板。    |

### feedback（2 个包）

| 包目录                                                                                                                                                         | 职责                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [command-feedback](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/feedback/command-feedback/README.md) | 用户 /feedback 命令及只记录、不进入模型历史的反馈事件。 |
| [message-feedback](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/feedback/message-feedback/README.md) | 本地逐消息评分/备注、目标校验和业务 Remote 接口。       |

### fs（7 个包）

| 包目录                                                                                                                                                                 | 职责                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [fs](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/fs/README.md)                                           | 文件路径、URI、读取、原子修改与策略事件接口。         |
| [fs-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/fs-local/README.md)                               | 本地文件系统实现。                                    |
| [fs-observation-policy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/fs-observation-policy/README.md)     | 编辑前观察、版本一致性和守护式修改策略。              |
| [fs-sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/fs-sandbox/README.md)                           | 结合会话限制模式和工作区根目录约束文件变更。          |
| [tool-fs](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs/README.md)                                 | 模型 read/write/edit 工具及读取窗口、执行与展示逻辑。 |
| [tool-fs-search](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs-search/README.md)                   | 通过 Subprocess 调用 ripgrep 的 glob/grep 工具。      |
| [tool-str-replace-editor](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-str-replace-editor/README.md) | view/create/str_replace/insert 文本编辑接口。         |

### goal（4 个包）

| 包目录                                                                                                                                                       | 职责                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| [command-goal](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/goal/command-goal/README.md)           | 人类管理目标的命令入口。                         |
| [goal](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/goal/goal/README.md)                           | 从日志折叠目标、修订和状态，管理进程内续跑激活。 |
| [goal-round-driver](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/goal/goal-round-driver/README.md) | 在当前会话按目标状态与轮数约束继续排入自动轮次。 |
| [tool-goal](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/goal/tool-goal/README.md)                 | 模型读取、建立和更新目标状态的工具。             |

### guard（2 个包）

| 包目录                                                                                                                                                              | 职责                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [repeat-tool-reminder](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/guard/repeat-tool-reminder/README.md) | 依据重复调用计数注入建议性提醒。   |
| [timeout-policy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/guard/timeout-policy/README.md)             | 围绕工具执行落实相应截止时间策略。 |

### hooks（3 个包）

| 包目录                                                                                                                                                        | 职责                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [hook-protocol](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/hooks/hook-protocol/README.md)         | 共享钩子进程的线协议与数据词汇。               |
| [hooks-claude-code](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/hooks/hooks-claude-code/README.md) | 将 Claude Code 风格钩子接入 Harness 扩展事件。 |
| [hooks-codex](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/hooks/hooks-codex/README.md)             | 将 Codex 风格钩子接入 Harness 扩展事件。       |

### host（8 个包）

| 包目录                                                                                                                                                                   | 职责                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [apiproxy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/apiproxy/README.md)                               | 与传输无关的 Host API、业务调用与事件流分派。   |
| [directory-picker](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/directory-picker/README.md)               | 宿主目录选择能力接口。                          |
| [directory-picker-auto](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/directory-picker-auto/README.md)     | 按宿主环境选择 native 或 browse 目录交互实现。  |
| [directory-picker-browse](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/directory-picker-browse/README.md) | 为应用内目录浏览提供列举与创建等能力。          |
| [directory-picker-native](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/directory-picker-native/README.md) | 通过宿主系统原生目录选择对话框获取目录。        |
| [frontend-static](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/frontend-static/README.md)                 | 在 HTTP 服务器 fallback 位置提供 SPA 构建产物。 |
| [plugin-inventory](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/plugin-inventory/README.md)               | 已装载插件的只读清单与 Remote 接口。            |
| [webserver](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/webserver/README.md)                             | 基于 node:http 的路由、索引转换和静态回退载体。 |

### identity（1 个包）

| 包目录                                                                                                                                                           | 职责                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [anonymous-user-id](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/identity/anonymous-user-id/README.md) | 共享匿名身份标识；不提供登录认证。 |

### interaction（5 个包）

| 包目录                                                                                                                                                                | 职责                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [commands](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/interaction/commands/README.md)                     | 注册和分派面向人的直接命令。                        |
| [permission-presets](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/interaction/permission-presets/README.md) | 将 sandbox 与 approval 选项组合为用户可选权限预设。 |
| [tool-ask-user](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/interaction/tool-ask-user/README.md)           | 模型提问工具，等待具体界面或交互后端回答。          |
| [user-approval](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/interaction/user-approval/README.md)           | 一次性执行许可请求、决定和审计事实。                |
| [user-questions](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/interaction/user-questions/README.md)         | 界面无关的人类问题/答案能力接口。                   |

### jobs（3 个包）

| 包目录                                                                                                                                         | 职责                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [jobs](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/jobs/jobs/README.md)             | 后台工作、状态、读取与停止的共同接口。 |
| [jobs-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/jobs/jobs-local/README.md) | 进程本地后台工作登记与生命周期管理。   |
| [tool-jobs](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/jobs/tool-jobs/README.md)   | 向模型提供后台工作控制工具。           |

### llm（5 个包）

| 包目录                                                                                                                                            | 职责                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [llm](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/llm/llm/README.md)                   | 模型适配器接口、消息块、流式协议和块组装器。 |
| [llm-deepseek](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/llm/llm-deepseek/README.md) | 直接 DeepSeek 模型 API 适配。                |
| [llm-pi-ai](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/llm/llm-pi-ai/README.md)       | 基于 pi-ai 的多提供方模型适配。              |
| [llm-retry](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/llm/llm-retry/README.md)       | 按模型提供方策略处理请求失败与重试。         |
| [token-meter](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/llm/token-meter/README.md)   | 从日志和 usage 派生可回放的 token 计量。     |

### lsp（3 个包）

| 包目录                                                                                                                                      | 职责                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [lsp](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/lsp/lsp/README.md)             | 定义四种只读代码语义查询及标准化结果。    |
| [lsp-stdio](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/lsp/lsp-stdio/README.md) | 经 stdio 管理语言服务器与协议请求。       |
| [tool-lsp](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/lsp/tool-lsp/README.md)   | 模型 LSP 查询，坐标转换、截断与结果呈现。 |

### mcp（1 个包）

| 包目录                                                                                                                                        | 职责                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [mcp-client](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/README.md) | 连接 MCP 服务器、同步工具目录、执行调用与断线重连。 |

### plan（1 个包）

| 包目录                                                                                                                                       | 职责                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [plan-mode](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/plan/plan-mode/README.md) | 计划协作状态、指导语、用户命令与经评审的退出。 |

### preset（2 个包）

| 包目录                                                                                                                                                 | 职责                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [agent-presets](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/preset/agent-presets/README.md) | 发现和常驻挂载 preset，把 Agent scope 连接到对应组合。 |
| [persona](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/preset/persona/README.md)             | 提供 preset 可覆盖的模型角色提示词。                   |

### runtime-diagnostics（1 个包）

| 包目录                                                                                                                                                        | 职责                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [invariants](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/runtime-diagnostics/invariants/README.md) | 注册和管理包级运行不变量检查与失败归属。 |

### sandbox（4 个包）

| 包目录                                                                                                                                                              | 职责                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sandbox/sandbox/README.md)                         | 进程限制接口、模式与升级执行词汇。                    |
| [sandbox-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sandbox/sandbox-local/README.md)             | 选择 Bubblewrap/Landlock/Seatbelt/Windows 后端。      |
| [sandbox-policy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sandbox/sandbox-policy/README.md)           | 统一会话限制模式、工作区根目录与策略解析。            |
| [sandbox-windows-acl](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sandbox/sandbox-windows-acl/README.md) | Windows 受限令牌和 ACL 写限制机制，报告部分落实程度。 |

### schedule（1 个包）

| 包目录                                                                                                                                         | 职责                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [schedule](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/schedule/schedule/README.md) | 原会话日志中的提醒定义、工具与活跃根 Agent 到期唤醒。 |

### sdk（3 个包）

| 包目录                                                                                                                                    | 职责                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [client](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/client/README.md)     | TypeScript 进程外 Harness 客户端。          |
| [protocol](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/protocol/README.md) | SDK stdio JSON-RPC 的请求、响应与通知类型。 |
| [server](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/server/README.md)     | Harness 侧 SDK JSON-RPC 服务端插件。        |

### session（13 个包）

| 包目录                                                                                                                                                                                    | 职责                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [session-checkpoint-policy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-checkpoint-policy/README.md)           | 把会话语义边界映射到持久化检查点。                          |
| [session-persistence](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-persistence/README.md)                       | 持久化抽象、写入协调、预备恢复和检查接口。                  |
| [session-persistence-jsonl](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-persistence-jsonl/README.md)           | JSONL 会话后端及对应存储/恢复机制。                         |
| [session-persistence-sqlite](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-persistence-sqlite/README.md)         | SQLite 会话持久化后端。                                     |
| [session-projection](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-projection/README.md)                         | 可注册的 Session 领域状态折叠单元。                         |
| [session-projection-cache](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-projection-cache/README.md)             | 持久化投影检查点并从后缀事件恢复。                          |
| [session-stats](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-stats/README.md)                                   | 从日志统计轮次、步骤与时间信息。                            |
| [session-telemetry](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-telemetry/README.md)                           | 捕获、脱敏和交付会话遥测的接口与协调。                      |
| [session-telemetry-otel](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-telemetry-otel/README.md)                 | OpenTelemetry 日志交付及 FULL/FEEDBACK_ONLY/DISABLED 模式。 |
| [session-title](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-title/README.md)                                   | 持久标题、确定性回退与单个可选提供方接口。                  |
| [session-title-all-prompts-llm](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-title-all-prompts-llm/README.md)   | 依据符合条件的全部用户提示生成标题。                        |
| [session-title-first-prompt-llm](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-title-first-prompt-llm/README.md) | 依据首条符合条件的用户提示生成标题。                        |
| [session-title-llm](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-title-llm/README.md)                           | 模型标题提供方共用的生成逻辑。                              |

### session-query（4 个包）

| 包目录                                                                                                                                                                      | 职责                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [session-log-export](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session-query/session-log-export/README.md)     | Web 会话日志导出命令、下载状态与弹窗。           |
| [session-query](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session-query/session-query/README.md)               | 统一逻辑语料、精确读取、过滤、关系和追踪接口。   |
| [session-query-sqlite](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session-query/session-query-sqlite/README.md) | 可重建的 SQLite 全文索引、排序、片段与检索结果。 |
| [tool-session-query](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session-query/tool-session-query/README.md)     | 模型侧有工作区访问约束的会话查询工具。           |

### settings（2 个包）

| 包目录                                                                                                                                                   | 职责                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [settings](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/settings/settings/README.md)           | 设置命名空间、schema、分层值解析与提交接口。 |
| [settings-file](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/settings/settings-file/README.md) | 设置文件持久化、并发控制与外部修改观察。     |

### shell（9 个包）

| 包目录                                                                                                                                                              | 职责                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [bash-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/bash-local/README.md)                     | 通过 Subprocess 执行 Bash 命令。                         |
| [bash-sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/bash-sandbox/README.md)                 | 执行前应用 Sandbox 包装的 Bash 实现。                    |
| [pwsh-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/pwsh-local/README.md)                     | PowerShell 命令执行与 Windows 特定行为。                 |
| [pwsh-sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/pwsh-sandbox/README.md)                 | 带 Sandbox 策略的 PowerShell 执行实现。                  |
| [shell](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/shell/README.md)                               | Shell 请求、执行规格与结果接口。                         |
| [shell-env](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/shell-env/README.md)                       | 收集插件贡献的可信 DSH_* 环境信息。                      |
| [tool-bash](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/tool-bash/README.md)                       | 模型单次 Bash 命令与后台 Job 集成。                      |
| [tool-bash-persistent](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/tool-bash-persistent/README.md) | 基于 Terminal 为每个 Agent 复用持久 Shell 的 bash 工具。 |
| [tool-pwsh](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/tool-pwsh/README.md)                       | 模型 PowerShell 执行工具。                               |

### skill（4 个包）

| 包目录                                                                                                                                                      | 职责                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [skill](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill/README.md)                       | 多提供方技能目录注册、作用域合并与查找。 |
| [skill-badge](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill-badge/README.md)           | 可选内置 dsh badge 技能提供方。          |
| [skill-filesystem](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill-filesystem/README.md) | 按本地目录发现技能。                     |
| [tool-skill](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/skill/tool-skill/README.md)             | 向模型展示技能目录并按需读取正文。       |

### spill（3 个包）

| 包目录                                                                                                                                              | 职责                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [spill](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/spill/spill/README.md)               | 超大工具文本保存接口与定位信息。  |
| [spill-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/spill/spill-local/README.md)   | 在本地会话相关目录保存溢出文本。  |
| [spill-policy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/spill/spill-policy/README.md) | 工具后处理中的预览/正文落盘决策。 |

### storage（4 个包）

| 包目录                                                                                                                                                    | 职责                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [storage](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/storage/storage/README.md)               | 非会话存储后端与类型化数据形式的连接中心。 |
| [storage-domain](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/storage/storage-domain/README.md) | 带 schema 的领域记录和类型化存储操作。     |
| [storage-json](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/storage/storage-json/README.md)     | JSON 文件存储后端。                        |
| [storage-sqlite](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/storage/storage-sqlite/README.md) | SQLite 非会话数据存储后端。                |

### subagent（11 个包）

| 包目录                                                                                                                                                                             | 职责                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [subagent](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent/README.md)                                     | 提供方注册、委派、子任务身份与续跑控制接口。          |
| [subagent-acp](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-acp/README.md)                             | 通过 ACP 驱动进程外子 Agent。                         |
| [subagent-claude-code](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-claude-code/README.md)             | 通过 Claude Agent SDK 驱动真实 Claude Code 子 Agent。 |
| [subagent-codex](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-codex/README.md)                         | 通过 app-server 驱动真实 Codex 子 Agent。             |
| [subagent-dsh-sdk](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-dsh-sdk/README.md)                     | 通过 TypeScript SDK 驱动独立 Harness 子运行时。       |
| [subagent-fork-in-process](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-fork-in-process/README.md)     | 从父会话已完成历史前缀建立进程内子 Agent。            |
| [subagent-in-process-driver](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-in-process-driver/README.md) | 进程内子 Agent 方案共享的运行驱动。                   |
| [subagent-spawn-in-process](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/subagent-spawn-in-process/README.md)   | 在进程内创建全新子 Agent 会话。                       |
| [tool-subagent](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/tool-subagent/README.md)                           | 按指定 provider 向模型提供委派工具。                  |
| [tool-subagent-control](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/tool-subagent-control/README.md)           | 父侧发送下一轮消息、中断目标活动与列举子 Agent。      |
| [tool-subagent-report](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subagent/tool-subagent-report/README.md)             | 可续跑子 Agent 向父 Agent 报告的独立通道。            |

### subprocess（2 个包）

| 包目录                                                                                                                                                           | 职责                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [subprocess](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subprocess/subprocess/README.md)             | 可执行文件查找、托管进程、stdio、PTY 原语与清理接口。 |
| [subprocess-local](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subprocess/subprocess-local/README.md) | 本地进程树、信号、node-pty 和有界输出实现。           |

### terminal（3 个包）

| 包目录                                                                                                                                                   | 职责                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [terminal](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/terminal/terminal/README.md)           | 按 Agent 所有权管理持久终端会话的接口与注册表。    |
| [terminal-bash](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/terminal/terminal-bash/README.md) | 基于 Subprocess 的 Shell PTY、就绪检测与会话操作。 |
| [tool-terminal](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/terminal/tool-terminal/README.md) | 模型终端操作工具及后台发送的 Jobs 集成。           |

### test-support（6 个包）

| 包目录                                                                                                                                                                 | 职责                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [acp-snapshot](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/test-support/acp-snapshot/README.md)             | ACP 场景快照测试工具。                       |
| [agent-loop-testkit](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/test-support/agent-loop-testkit/README.md) | AgentLoop 测试共用前置服务与装配。           |
| [client-runtime](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/test-support/client-runtime/README.md)         | Client 功能包共用的浏览器运行时测试底座。    |
| [llm-mock-server](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/test-support/llm-mock-server/README.md)       | 确定性的模型兼容 HTTP 服务与故障模拟。       |
| [llm-replay](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/test-support/llm-replay/README.md)                 | 回放已记录模型响应，支持无密钥测试。         |
| [loader-smoke](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/test-support/loader-smoke/README.md)             | 通过真实 Loader 启动组合应用的冒烟测试支持。 |

### todo（1 个包）

| 包目录                                                                                                                                       | 职责                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [tool-todo](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/todo/tool-todo/README.md) | 在会话中记录并更新整份 Todo 列表。 |

### typert（4 个包）

| 包目录                                                                                                                                         | 职责                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [generator](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/typert/generator/README.md) | 从 TypeScript 分析类型图和服务/事件，生成运行时产物。 |
| [loader](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/typert/loader/README.md)       | 在 Loader 装载过程中发现并注册 Typert 产物。          |
| [protocol](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/typert/protocol/README.md)   | 编译器无关的 Remote 元数据与提供方协议。              |
| [registry](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/typert/registry/README.md)   | 运行时反射、schema、元数据与解析器注册中心。          |

### util（7 个包）

| 包目录                                                                                                                                                         | 职责                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [atomic-write](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/atomic-write/README.md)             | 原子替换文件的底层辅助。              |
| [brand](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/brand/README.md)                           | 为跨边界 ID 提供名义化 branded 类型。 |
| [home-paths](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/home-paths/README.md)                 | Harness 数据根目录和公共路径解析。    |
| [launch-environment](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/launch-environment/README.md) | 保留来源层级的不可变启动环境快照。    |
| [native-command](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/native-command/README.md)         | 不经过 Shell 的宿主原生命令执行辅助。 |
| [output-retention](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/output-retention/README.md)     | 有界保留文本与集合元素。              |
| [timeout](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/util/timeout/README.md)                       | 截止时间与超时归类的公共原语。        |

### web（6 个包）

| 包目录                                                                                                                                                              | 职责                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [tool-web](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/web/tool-web/README.md)                           | 统一模型侧搜索与抓取工具。            |
| [web](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/web/web/README.md)                                     | 搜索/抓取提供方注册、选择与错误接口。 |
| [web-fetch-http](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/web/web-fetch-http/README.md)               | 公共 HTTP/HTTPS 资源抓取实现。        |
| [web-search-deepseek](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/web/web-search-deepseek/README.md)     | DeepSeek 原生 Web 搜索提供方。        |
| [web-search-exa](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/web/web-search-exa/README.md)               | Exa 搜索提供方。                      |
| [web-search-perplexity](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/web/web-search-perplexity/README.md) | Perplexity 搜索提供方。               |

### workflow（4 个包）

| 包目录                                                                                                                                                                     | 职责                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [tool-ralph](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workflow/tool-ralph/README.md)                         | 固定的全新子 Agent 逐轮迭代与结构化交接策略。     |
| [tool-workflow](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workflow/tool-workflow/README.md)                   | 模型编写动态编排流程的通用工具。                  |
| [workflow](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workflow/workflow/README.md)                             | 工作流运行请求、结果、句柄与生命周期事件。        |
| [workflow-worker-thread](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workflow/workflow-worker-thread/README.md) | 在 worker 中执行流程，并经 Subagents 创建子任务。 |

### workspace（1 个包）

| 包目录                                                                                                                                            | 职责                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [workspace](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/workspace/workspace/README.md) | 持久化工作区记录、规范目录身份与会话成员关系。 |
