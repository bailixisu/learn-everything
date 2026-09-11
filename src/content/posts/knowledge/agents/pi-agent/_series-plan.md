# Pi Coding Agent 源码导读：系列规划

> 本文件是写作规划，不参与 Astro 内容集合。

## 研究基线

- Pi Coding Agent：`@earendil-works/pi-coding-agent@0.85.1`
- Pi Agent Core：`@earendil-works/pi-agent-core@0.85.1`
- Pi AI：`@earendil-works/pi-ai@0.85.1`
- Pi TUI：`@earendil-works/pi-tui@0.85.1`
- Git tag：`v0.85.1`
- Commit：`d981de1229ef899957bbe968bc8dcda02a21f477`
- 源码仓库：https://github.com/earendil-works/pi
- 本地源码研究副本：`/tmp/pi-source-0.85.1`

所有文章必须区分：

1. 当前稳定 CLI 使用的 `AgentSession + Agent + agentLoop + SessionManager v3`。
2. experimental server/client 使用的新 `AgentHarness` durable runtime。
3. 源码事实、官方设计说明与作者自己的分析。

## 系列目录

| 顺序 | 暂定标题                               | 核心问题                                                             | 状态     |
| ---- | -------------------------------------- | -------------------------------------------------------------------- | -------- |
| 1    | 从输入到工具执行的整体架构             | Pi 由哪些层组成？一次请求怎样流过整个系统？                          | 草稿完成 |
| 2    | 启动、配置与资源发现                   | CLI 参数、项目信任、Settings、ResourceLoader 如何组装运行时？        | 草稿完成 |
| 3    | Agent Loop：Pi 的执行内核              | turn、stream、tool call、steering、follow-up 如何形成循环？          | 草稿完成 |
| 4    | Tool Use：定义、校验、执行与结果回灌   | 内置工具、TypeBox、并行/串行、错误与扩展拦截如何实现？               | 草稿完成 |
| 5    | Memory：Pi 到底记住了什么              | 工作记忆、JSONL 会话树、上下文文件、Skill、压缩分别是什么？          | 草稿完成 |
| 6    | System Prompt、Context 与 Skills       | Prompt 怎样拼装？Skill 为什么是渐进披露而不是直接注入全文？          | 草稿完成 |
| 7    | Model 与 Provider 抽象                 | ModelRuntime、认证、协议适配、流式事件、跨模型切换如何工作？         | 草稿完成 |
| 8    | Extensions：Pi 的真正扩展边界          | 事件、Hook、自定义工具、命令、UI、Provider 如何改变运行时？          | 草稿完成 |
| 9    | TUI 与四种运行模式                     | Interactive、Print、JSON、RPC、SDK 如何复用同一个核心？              | 草稿完成 |
| 10   | 会话树、分支与 Compaction              | `/tree`、fork、branch summary、上下文压缩如何保持连续性？            | 草稿完成 |
| 11   | 可靠性与安全边界                       | retry、abort、项目信任、无内置 sandbox 的真实含义是什么？            | 草稿完成 |
| 12   | AgentHarness：面向持久运行的下一套架构 | durable operation、lane、transaction、recovery 与当前 CLI 有何区别？ | 草稿完成 |
| 13   | 从零实现一个 Mini Pi                   | 用 pi-ai + agent-core + 自定义工具复现最小闭环                       | 草稿完成 |

## 每篇文章统一结构

1. 本篇解决的问题
2. 结论先行
3. 模块在全局架构中的位置
4. 标准流程
5. 关键数据结构
6. 源码调用链
7. 设计原因与边界
8. 最小实验或可运行案例
9. 常见误解
10. 小结与下一篇
11. 官方文档和源码索引

## 视觉规划

- 概念封面、场景图优先制作成 PNG/WebP
- 精确架构、状态机和时序图在确有需要时使用 SVG
- 真实功能优先使用终端、事件流和实验截图
- 总体分层架构图
- 启动流程图
- 单轮 Agent Loop 时序图
- Tool Use 生命周期图
- Memory 分层图
- System Prompt 拼装图
- Provider 适配图
- Extension Hook 时间轴
- Session Tree 与 Compaction 图
- Stable CLI 与 AgentHarness 对照图

图表优先使用原创 SVG，与文章共置，使用相对 Markdown 路径。
