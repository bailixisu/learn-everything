---
name: blog-workflow
description: "Manage the Learn Everything blog writing workflow: turn a topic or Markdown source into a categorized draft, review its quality, prepare local preview, and publish only after explicit user approval. Use when the user asks to organize notes, generate a blog Markdown article, preview a draft, or publish to bailixisu.com."
compatibility: Requires Node.js, npm, git, and the Learn Everything repository.
---

# Learn Everything Blog Workflow

Operate from the repository root. Resolve it with `git rev-parse --show-toplevel`; verify `package.json` has name `learn-everything-blog` before changing anything.

This skill is versioned in the repository at `.agents/skills/blog-workflow/SKILL.md`. Edit it there, not through a global copy.

## Safety gate

The workflow has four separate phases: **draft**, **review**, **preview**, and **publish**.

- Never publish during draft, review, or preview.
- Never infer publishing approval from praise such as “looks good” if the user did not ask to publish.
- Publishing means setting `draft: false`, committing, and pushing. Do it only when the user explicitly invokes the publish phase or clearly says “发布这篇文章”.
- A request that asks to write and publish in one go (for example “整理成博客并发布”) is explicit approval for that one article only. Run draft, then the full review checklist, then publish. You may skip waiting for a local preview, but never skip a publish gate.
- Never commit or push unrelated working-tree changes. Never force-push.
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

Reuse an existing topic directory whenever one fits. List them first:

```bash
find src/content/posts -type d ! -name '*-assets' ! -path '*/.obsidian*' ! -path '*/_*'
```

Create a new topic directory only when nothing fits, and never start a parallel hierarchy for a topic that already has one. Agent articles currently exist under both `knowledge/agents/` and `knowledge/artificial-intelligence/agents/`; put new Agent articles in `knowledge/agents/<subtopic>/`, where most of them live. Directory paths become URLs, so never move a published article without the user's approval.

Store article images next to the Markdown file in `<article-slug>-assets/` and reference them with portable relative Markdown syntax, for example `![说明](./<article-slug>-assets/diagram.webp)`. Do not use site-root `/images/...` paths or raw HTML `<img>` tags: the same source must render in Obsidian, GitHub Markdown, and Astro.

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

## Visual storytelling

For substantial technical articles, design visuals as part of the explanation rather than decoration:

- Start from the reader's core question, then choose diagrams that expose mechanism, contrast, boundaries, examples, and evaluation.
- Prefer original architecture diagrams, comparison matrices, decision trees, experiment charts, and data visualizations.
- Paper figures may be reused only after checking their license or permission; preserve attribution and link the original source. Otherwise redraw the concept in an original visual language and cite the source that informed it.
- Every image needs useful alt text and, when appropriate, a caption that explains what the reader should notice.
- Do not add a fixed number of images mechanically; each visual must reduce explanation cost or reveal a relationship more clearly than prose.

### Choosing image generation or SVG

Both methods are allowed for technical diagrams. Pick per figure, by which one reads better:

- **Image model** suits flowcharts, layered architectures, pipelines, and conceptual illustrations whose labels are short (a few words per box).
- **Hand-authored SVG** suits formulas, tensor shapes, numbers and measurements, code, dense labels, and anything that needs exact alignment or scale.
- If an image-model diagram still has errors after two targeted corrections, redraw it as SVG.

Image tools by agent: Codex uses its built-in `imagegen` skill; Claude Code uses the `codex-imagegen` skill (it drives the same model through the local Codex CLI); an agent without an image tool draws SVG.

Style references (clean layout, light zones, readable labels, explicit connections):

- SVG: `src/content/posts/knowledge/llm-foundations/transformer/01-transformer-foundations-assets/01-architecture.svg`
- Image model: `src/content/posts/knowledge/agents/memory/claude-code-memory-mechanism-assets/02-loading.webp`

After generating any technical figure, open it and check every label (especially Chinese characters), formula, module order, arrow direction, and connection against the article text. Fix errors with targeted edits and check again.

Commit raster images as WebP, not PNG. Convert from the repository root (sharp is already a dependency), aim for under 300 KB, and keep the PNG source out of the repository:

```bash
node -e "require('sharp')(process.argv[1]).webp({quality:85}).toFile(process.argv[2])" source.png ./<article-slug>-assets/diagram.webp
```

## Phase: draft

Input may be a topic, pasted material, one Markdown file, or several files.

1. Read all supplied sources. Distinguish source facts, user experience, quotations, and model inference.
2. Decide whether the material should be one article or multiple articles. Explain the proposed classification briefly.
3. Preserve correct code, commands, measured values, links, and attribution. Never invent experiments, outputs, citations, or personal experience.
4. Mark unresolved claims with an explicit `> 待核实：...` blockquote or ask the user; do not silently fill gaps.
5. Write for comprehension, normally using: motivation, core concepts, options, practice, result, pitfalls, summary, follow-up. Remove sections that add no value.
6. Create the destination Markdown with `draft: true`.
7. Run `npm run format:check` and `npm run check:post -- <file>`; fix formatting and any errors. Do not commit or push.
8. Report the file path, classification, uncertainties, and the preview command.

## Phase: review

Review the requested draft without publishing it. Start with `npm run check:post -- <file>` and include its errors and warnings in the findings. Then evaluate:

- Is the central question clear?
- Are factual claims supported by supplied material or credible references?
- Are fact, experience, and opinion distinguishable?
- Does the structure remove repetition and preserve useful detail?
- Are title, description, tags, and directory appropriate?
- Are code samples complete and free of secrets?
- Does the article contain private or internal information?
- Do the figures pass the check in “Choosing image generation or SVG”, and are raster images WebP?
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

1. Sync with the remote first. Articles are also published from other machines, so local `main` may be behind:

   ```bash
   git fetch origin
   git status -sb
   ```

   If behind, run `git pull --ff-only`. If local and remote have diverged, stop and report instead of rebasing or merging on your own.

2. Re-run the review checklist and `npm run check:post -- <file>`. Stop on any error it reports: secrets, lines starting with `> 待核实`, missing images or alt text, broken local links, or a `type` that does not match the directory. The words “待核实” inside prose or code blocks are not a blocker.
3. Confirm only the intended files will be included using `git status --short` and `git diff`.
4. Set the approved article's `draft` to `false` and set `pubDatetime` to the actual publish time in `+08:00`, unless the user asks to keep the original date. The time must not be in the future, or the production build hides the post. Set `modDatetime` only when updating an already-published article.
5. Run `npm run check:post -- <file> --publish`, `npm run format:check`, `npm run lint`, and `npm run build`.
6. Commit only intended article/assets with a descriptive Chinese commit message, for example `发布博客：<标题>`.
7. Push to `main`; Vercel deploys automatically. If the push is rejected, run `git pull --rebase`, rebuild, and push again; stop and report on any conflict.
8. Verify the deployment with `npm run verify:deploy -- <file>`. Within five minutes it waits for the pushed commit's Vercel status to become `success` (read through `gh`), then for the page to serve the article title, and finally checks for `katex-error` and that every same-site image returns 200. Do not write one-off verification scripts for this.
9. Return the production URL and commit hash. If deployment cannot be verified, state that clearly rather than claiming success.

## URL mapping

For a file:

```text
src/content/posts/projects/fire-detection/model-comparison.md
```

the URL is:

```text
https://bailixisu.com/posts/projects/fire-detection/model-comparison
```

Directories whose names start with `_` are omitted from the URL, and files whose names start with `_` are not published.
