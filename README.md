# Learn Everything

bailixisu 的个人数字花园，使用 [Astro](https://astro.build/)、AstroPaper 和 Markdown 构建。

## 本地运行

```bash
npm install
npm run dev
```

访问 <http://localhost:4321>。

## 写一篇文章

在 `src/content/posts/` 新建 `.md` 或 `.mdx` 文件：

```md
---
title: "文章标题"
description: "一句话摘要"
pubDatetime: 2026-09-11T12:00:00+08:00
featured: false
draft: false
tags:
  - 学习笔记
---

从这里开始写正文。
```

- `featured: true`：显示在首页精选区域
- `draft: true`：构建时不发布
- 图片建议放在文章旁边，使用相对路径引用
- 文件夹名前加 `_` 可以只用于整理，不进入文章 URL

## 常用命令

| 命令              | 用途                   |
| ----------------- | ---------------------- |
| `npm run dev`     | 启动开发服务器         |
| `npm run build`   | 类型检查并构建生产版本 |
| `npm run preview` | 本地预览生产版本       |
| `npm run format`  | 格式化代码和文章       |
| `npm run lint`    | 检查代码               |

## 发布到 Vercel

1. 将仓库推送到 GitHub
2. 在 Vercel 选择 **Add New → Project**
3. 导入 `bailixisu/learn-everything`
4. Framework Preset 选择 **Astro**，其余保持默认
5. 部署完成后，把 `astro-paper.config.ts` 中的 `site.url` 改成实际地址

## 绑定 Cloudflare 域名

在 Vercel 项目的 **Settings → Domains** 添加域名，再按照提示到 Cloudflare DNS 增加记录。若 Cloudflare 开启了代理（橙色云朵）后验证失败，可以先切换为 **DNS only**，绑定成功后再决定是否开启代理。

## 内容位置

- 文章：`src/content/posts/`
- 关于：`src/content/pages/about.md`
- 项目：`src/pages/projects.astro`
- 网站配置：`astro-paper.config.ts`
- 主题颜色：`src/styles/theme.css`
- 中文文案：`src/i18n/lang/zh-cn.ts`

后续可以接入 TinaCMS 或 Decap CMS，实现浏览器中编辑和发布文章。
