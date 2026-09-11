---
title: "这个博客是如何搭建的"
description: "Astro、Markdown、GitHub 与 Vercel 组成的轻量写作工作流。"
pubDatetime: 2026-09-11T13:05:00+08:00
featured: false
draft: false
tags:
  - Astro
  - 项目实践
  - Markdown
---

这个博客使用 **Astro + AstroPaper + Markdown** 构建，代码和文章由 Git 管理，并计划通过 GitHub 与 Vercel 自动发布。

## 为什么选择静态博客

静态网站没有数据库和长期运行的后端服务。每次发布时，Astro 会把 Markdown 文章生成普通 HTML，因此访问速度快、维护成本低，也更容易迁移。

内容始终保存在 Markdown 文件中。即使将来更换主题或托管平台，文章本身仍然属于我。

## 发布流程

```text
写 Markdown
    ↓
提交到 GitHub
    ↓
Vercel 自动构建
    ↓
网站更新
```

这种流程同时获得了 Git 的版本历史与在线备份。以后如果希望直接在浏览器里写作，还可以接入 TinaCMS 或 Decap CMS，而不必改变已有的内容格式。

## 下一步

- 绑定自己的域名
- 接入 Giscus 评论
- 增加更多真实项目
- 根据写作习惯优化文章模板
- 评估浏览器 CMS

技术只是容器，真正重要的是让记录逐渐成为习惯。
