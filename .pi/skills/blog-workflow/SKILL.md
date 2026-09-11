---
name: blog-workflow
description: Manage the Learn Everything blog writing workflow: turn a topic or Markdown source into a categorized draft, review its quality, prepare local preview, and publish only after explicit user approval. Use when the user asks to organize notes, generate a blog Markdown article, preview a draft, or publish to bailixisu.com.
compatibility: Requires Node.js, npm, git, and the Learn Everything repository.
---

# Learn Everything Blog Workflow

Operate from the repository root. Resolve it with `git rev-parse --show-toplevel`; verify `package.json` has name `learn-everything-blog` before changing anything.

## Safety gate

The workflow has four separate phases: **draft**, **review**, **preview**, and **publish**.

- Never publish during draft, review, or preview.
- Never infer publishing approval from praise such as “looks good” if the user did not ask to publish.
- Publishing means setting `draft: false`, committing, and pushing. Do it only when the user explicitly invokes the publish phase or clearly says “发布这篇文章”.
- Never commit or push unrelated working-tree changes.
- Never include secrets, access tokens, private company data, personal contact details, or unlicensed copied text.
- Treat files in a public GitHub repository as public even when `draft: true`.
- Do not delete or modify source notes outside this repository unless explicitly requested.

## Content destinations

Choose the narrowest fitting destination:

```text
src/content/posts/knowledge/<topic>/<english-kebab-slug>.md
src/content/posts/projects/<project>/<english-kebab-slug>.md
src/content/posts/thoughts/<english-kebab-slug>.md
```

Use stable English kebab-case for directories and filenames. Chinese titles and tags are encouraged.

- `knowledge`: reusable concepts, tutorials, learning notes
- `project`: implementation logs, experiments, decisions, retrospectives
- `thought`: personal reflections and arguments

Store article images under `public/images/<article-slug>/` and reference them as `/images/<article-slug>/<file>`.

## Required frontmatter

```yaml
---
title: "清晰、具体的中文标题"
description: "一句话说明文章解决的问题或提供的价值。"
pubDatetime: 2026-09-11T12:00:00+08:00
featured: false
draft: true
type: knowledge
project: optional-project-slug
series: optional-series-name
order: 1
tags:
  - 标签一
  - 标签二
---
```

Omit optional `project`, `series`, and `order` rather than filling meaningless values. New content must start with `draft: true`.

## Phase: draft

Input may be a topic, pasted material, one Markdown file, or several files.

1. Read all supplied sources. Distinguish source facts, user experience, quotations, and model inference.
2. Decide whether the material should be one article or multiple articles. Explain the proposed classification briefly.
3. Preserve correct code, commands, measured values, links, and attribution. Never invent experiments, outputs, citations, or personal experience.
4. Mark unresolved claims with an explicit `> 待核实：...` note or ask the user; do not silently fill gaps.
5. Write for comprehension, normally using: motivation, core concepts, options, practice, result, pitfalls, summary, follow-up. Remove sections that add no value.
6. Create the destination Markdown with `draft: true`.
7. Run `npm run format:check` and fix formatting if needed. Do not commit or push.
8. Report the file path, classification, uncertainties, and the preview command.

## Phase: review

Review the requested draft without publishing it. Evaluate:

- Is the central question clear?
- Are factual claims supported by supplied material or credible references?
- Are fact, experience, and opinion distinguishable?
- Does the structure remove repetition and preserve useful detail?
- Are title, description, tags, and directory appropriate?
- Are code samples complete and free of secrets?
- Does the article contain private or internal information?
- What must be fixed before publication?

Give findings first. Apply edits only if requested. Keep `draft: true`.

## Phase: preview

1. Verify the article exists and remains `draft: true`.
2. Run `npm run lint` and `npm run build`. Production build intentionally excludes drafts.
3. Explain that drafts are visible only under Astro development mode.
4. Give the exact command `npm run dev` and expected local article URL derived from its path.
5. Do not commit, push, or set `draft: false`.

If the user asks for a remotely accessible preview, use a dedicated preview branch and Vercel Preview Deployment only after explaining that the source will be visible on public GitHub. Do not merge it into `main`.

## Phase: publish

Require a specific article path or an unambiguous single draft.

1. Re-run the review checklist and stop for blockers such as secrets, `待核实`, broken links, or invalid frontmatter.
2. Confirm only the intended files will be included using `git status --short` and `git diff`.
3. Set the approved article's `draft` to `false` and update `modDatetime` when appropriate.
4. Run `npm run format:check`, `npm run lint`, and `npm run build`.
5. Commit only intended article/assets with a descriptive Chinese commit message.
6. Push to `main`; Vercel deploys automatically.
7. Return the production URL and commit hash. If deployment cannot be verified, state that clearly rather than claiming success.

## URL mapping

For a file:

```text
src/content/posts/projects/fire-detection/model-comparison.md
```

the URL is:

```text
https://bailixisu.com/posts/projects/fire-detection/model-comparison
```
