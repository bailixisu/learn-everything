# 项目文档与博客发布

- 本项目的文章、学习笔记、方案及其他内容型交付默认使用仓库内的 Markdown 文件，不创建飞书文档。只有用户明确要求飞书时才使用飞书。
- 博客文章按主题放入 `src/content/posts/`；配图放在文章旁的 `<article-slug>-assets/` 目录，并使用相对路径引用。
- 写作、检查和发布遵循 `blog-workflow` 技能，技能文件在仓库内 `.agents/skills/blog-workflow/SKILL.md`。用户明确要求发布时，完成必要验证后提交并推送；未授权发布时保持草稿。
- 发布前先 `git fetch` 同步远端：文章也会从其他机器发布，本地 `main` 可能落后。
- 提交仅包含当前请求涉及的文章、配图和明确要求的项目约定；不要提交临时研究记录、认证信息或无关改动。

## 配图生成

- 技术架构图、流程图、原理图既可以用生图模型，也可以手写 SVG，按单张图的效果选择：标签简短的流程和分层结构适合生图，公式、张量形状、数值、代码和密集标签适合 SVG。生图定向修正两次仍有错误时，改用 SVG。用户明确指定制作方式时，按用户要求执行。
- 生图工具：Codex 用内置 `imagegen` 技能，Claude Code 用 `codex-imagegen` 技能；没有生图工具的 Agent 手写 SVG。
- 风格参考：清晰排版、浅色分区、可读标签和明确连线。SVG 参考 `src/content/posts/knowledge/llm-foundations/transformer/01-transformer-foundations-assets/01-architecture.svg`，生图参考 `src/content/posts/knowledge/agents/memory/claude-code-memory-mechanism-assets/02-loading.webp`。
- 无论哪种方式，生成后都必须检查文字、公式、模块顺序、箭头方向与连接关系；发现错误时定向修正，并再次检查。
- 用于文章的最终图片保存到对应的 `<article-slug>-assets/` 目录，并以相对路径引用。位图提交前转成 WebP（命令见技能），PNG 原图不进仓库。
