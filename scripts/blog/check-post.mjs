// Pre-publish checks that `astro build` does not cover: unresolved review
// markers, image hygiene, leaked secrets, and frontmatter that must agree with
// the file's location. Usage:
//   npm run check:post -- <post.md> [more posts] [--publish]
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import {
  POSTS_DIR,
  postUrl,
  print,
  readPost,
  relativePostPath,
} from "./post-meta.mjs";

const TYPE_BY_DIR = {
  knowledge: "knowledge",
  projects: "project",
  thoughts: "thought",
};
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RASTER = /\.(png|jpe?g)$/i;
const IMAGE_LIMIT = 500 * 1024;
// Must match `posts.scheduledPostMargin` in astro-paper.config.ts.
const SCHEDULE_MARGIN = 15 * 60 * 1000;
const STALE_DATE = 2 * 24 * 60 * 60 * 1000;

const SECRETS = [
  [/sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, "API key（sk-…）"],
  [/gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{40,}/, "GitHub token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "私钥"],
];
// The lookbehind skips URLs such as https://example.edu/home/user/.
const LOCAL_PATH = /(?<![\w.-])(?:\/Users|\/home)\/[A-Za-z0-9._-]+\//;
const REVIEW_MARKER = /^\s*>\s*待核实/;
const IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const LOCAL_LINK =
  /(?<!!)\[[^\]]*\]\(\s*(\.{1,2}\/[^)\s#]+\.mdx?)(?:#[^)\s]*)?/g;
const FENCE = /^\s*(```|~~~)/;

/** True when origin/main already has this file with `draft` not set to true. */
function publishedOnRemote(rel) {
  try {
    const source = execFileSync(
      "git",
      ["show", `origin/main:${POSTS_DIR}/${rel}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
    return Boolean(match) && parse(match[1])?.draft !== true;
  } catch {
    return false;
  }
}

function checkLocation(rel, data, issues) {
  const parts = rel.split("/");
  const slug = parts[parts.length - 1].replace(/\.mdx?$/, "");
  if (!KEBAB.test(slug)) issues.warn(0, `文件名应为英文 kebab-case：${slug}`);
  for (const dir of parts.slice(0, -1)) {
    if (!dir.startsWith("_") && !KEBAB.test(dir)) {
      issues.warn(0, `目录名应为英文 kebab-case：${dir}`);
    }
  }
  const expected = TYPE_BY_DIR[parts[0]];
  const type = data.type ?? "knowledge";
  if (!expected) {
    issues.warn(0, "文章应放在 knowledge/、projects/ 或 thoughts/ 下");
  } else if (type !== expected) {
    issues.error(0, `type 为 ${type}，但所在目录要求 ${expected}`);
  }
}

function checkFrontmatter(rel, data, publish, issues) {
  for (const key of ["title", "description", "pubDatetime"]) {
    if (!data[key]) issues.error(0, `frontmatter 缺少 ${key}`);
  }
  if (!publish) return;
  if (data.draft !== false) issues.error(0, "发布检查要求 draft: false");
  const pub = new Date(data.pubDatetime).getTime();
  if (Number.isNaN(pub)) return;
  const now = Date.now();
  if (pub - SCHEDULE_MARGIN > now) {
    issues.error(0, "pubDatetime 在未来，生产构建会隐藏这篇文章");
  } else if (now - pub > STALE_DATE && !publishedOnRemote(rel)) {
    const days = Math.floor((now - pub) / 86_400_000);
    issues.warn(
      0,
      `首次发布但 pubDatetime 是 ${days} 天前，应改为实际发布时间`
    );
  }
}

function checkImage(file, slug, lineNo, alt, target, issues) {
  if (!alt.trim()) issues.error(lineNo, `图片缺少 alt 文本：${target}`);
  if (/^https?:\/\//.test(target)) {
    issues.warn(lineNo, `外链图片，确认授权与来源：${target}`);
    return;
  }
  if (target.startsWith("/")) {
    issues.error(lineNo, `图片应使用相对路径：${target}`);
    return;
  }
  const resolved = path.resolve(path.dirname(file), decodeURI(target));
  if (!existsSync(resolved)) {
    issues.error(lineNo, `图片不存在：${target}`);
    return;
  }
  if (!target.replace(/^\.\//, "").startsWith(`${slug}-assets/`)) {
    issues.warn(lineNo, `图片应放在 ./${slug}-assets/：${target}`);
  }
  if (RASTER.test(target)) issues.warn(lineNo, `位图应转为 WebP：${target}`);
  const size = statSync(resolved).size;
  if (size > IMAGE_LIMIT) {
    issues.warn(
      lineNo,
      `图片 ${Math.round(size / 1024)} KB，超过 500 KB：${target}`
    );
  }
}

function checkBody(file, post, issues) {
  const slug = path.basename(file).replace(/\.mdx?$/, "");
  let inFence = false;
  post.body.split("\n").forEach((line, index) => {
    const lineNo = post.bodyLine + index;
    for (const [pattern, label] of SECRETS) {
      if (pattern.test(line)) issues.error(lineNo, `疑似泄露${label}`);
    }
    if (LOCAL_PATH.test(line)) issues.warn(lineNo, "包含本机用户路径");
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) return;

    const prose = line.replace(/`[^`]*`/g, "");
    if (REVIEW_MARKER.test(prose)) issues.error(lineNo, "存在未解决的“待核实”");
    if (/<img\b/i.test(prose))
      issues.error(lineNo, "不要用 <img>，改用 Markdown 图片语法");
    for (const [, alt, target] of prose.matchAll(IMAGE)) {
      checkImage(file, slug, lineNo, alt, target, issues);
    }
    for (const [, target] of prose.matchAll(LOCAL_LINK)) {
      if (!existsSync(path.resolve(path.dirname(file), decodeURI(target)))) {
        issues.error(lineNo, `站内链接指向不存在的文件：${target}`);
      }
    }
  });
}

function checkPost(file, publish) {
  const errors = [];
  const warnings = [];
  const where = lineNo => (lineNo ? `第 ${lineNo} 行：` : "");
  const issues = {
    error: (lineNo, msg) => errors.push(`${where(lineNo)}${msg}`),
    warn: (lineNo, msg) => warnings.push(`${where(lineNo)}${msg}`),
  };

  print(`检查 ${file}`);
  const rel = existsSync(file) ? relativePostPath(file) : null;
  if (!rel || !/\.mdx?$/.test(rel)) {
    issues.error(0, `不是 ${POSTS_DIR}/ 下存在的 Markdown 文件`);
  } else {
    const post = readPost(file);
    if (post.error) {
      issues.error(0, post.error);
    } else {
      print(`  网址：${postUrl(rel)}`);
      print(`  draft：${post.data.draft ?? "未设置"}`);
      checkLocation(rel, post.data, issues);
      checkFrontmatter(rel, post.data, publish, issues);
    }
    checkBody(file, post, issues);
  }

  errors.forEach(msg => print(`  ✗ ${msg}`));
  warnings.forEach(msg => print(`  ! ${msg}`));
  print(`  结果：${errors.length} 个错误，${warnings.length} 个警告`);
  return errors.length === 0;
}

const args = process.argv.slice(2);
const publish = args.includes("--publish");
const files = args.filter(arg => !arg.startsWith("--"));
if (files.length === 0) {
  print("用法：npm run check:post -- <post.md> [更多文章] [--publish]");
  process.exit(2);
}
const results = files.map(file => checkPost(file, publish));
process.exit(results.every(Boolean) ? 0 : 1);
