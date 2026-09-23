// Confirms a published post is live on the production site: waits for the
// Vercel deployment of the pushed commit, then until the page serves the
// article title, and finally checks formulas and images. Usage:
//   npm run verify:deploy -- <post.md> [--timeout=300] [--commit=<sha>]
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  SITE_URL,
  postUrl,
  print,
  readPost,
  relativePostPath,
} from "./post-meta.mjs";

const POLL_INTERVAL = 15_000;

const escapeHtml = text =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Latest state of the "Vercel" commit status: success, pending, failure,
 * error, or "" when Vercel has not reported yet. `null` means `gh` is
 * unavailable, so the caller falls back to page polling alone.
 */
function vercelState(sha) {
  try {
    return execFileSync(
      "gh",
      [
        "api",
        `repos/{owner}/{repo}/commits/${sha}/statuses`,
        "--jq",
        '[.[] | select(.context == "Vercel")][0].state // ""',
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    return null;
  }
}

/** Returns a problem message, or null once Vercel reports success. */
async function waitForVercel(sha, deadline) {
  for (;;) {
    const state = vercelState(sha);
    if (state === null) {
      print("  ! 无法通过 gh 读取 Vercel 状态，只按页面内容判断");
      return null;
    }
    if (state === "success") {
      print(`  Vercel：${sha.slice(0, 7)} 已部署`);
      return null;
    }
    if (state === "failure" || state === "error") {
      return `Vercel 部署 ${sha.slice(0, 7)} 失败（${state}）`;
    }
    if (Date.now() + POLL_INTERVAL > deadline) {
      return `等待超时，Vercel 状态仍为 ${state || "未上报"}`;
    }
    print(`  等待 Vercel：${state || "未上报"}`);
    await sleep(POLL_INTERVAL);
  }
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return { status: response.status, html: await response.text() };
  } catch (err) {
    return { status: 0, html: "", error: err.message };
  }
}

/** Polls until the page returns 200 and contains the title, or times out. */
async function waitForArticle(url, title, deadline) {
  for (;;) {
    const page = await fetchPage(url);
    const hasTitle =
      page.html.includes(title) || page.html.includes(escapeHtml(title));
    const done = page.status === 200 && hasTitle;
    if (done || Date.now() + POLL_INTERVAL > deadline) {
      return { ...page, hasTitle };
    }
    print(
      `  等待页面：HTTP ${page.status || page.error}，标题${hasTitle ? "已" : "未"}出现`
    );
    await sleep(POLL_INTERVAL);
  }
}

function sameSiteImages(html) {
  const sources = [...html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/gi)].map(
    ([, src]) => src.replaceAll("&amp;", "&")
  );
  const local = sources
    .filter(src => src.startsWith(SITE_URL) || /^\/(?!\/)/.test(src))
    .map(src => new URL(src, SITE_URL).href);
  return [...new Set(local)];
}

async function imageStatus(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.status === 200) return 200;
    return (await fetch(url)).status;
  } catch {
    return 0;
  }
}

function headCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const option = name =>
  args.find(arg => arg.startsWith(`--${name}=`))?.split("=")[1];
const file = args.find(arg => !arg.startsWith("--"));
const timeoutMs = Number(option("timeout") ?? 300) * 1000;
const sha = option("commit") ?? headCommit();
const rel = file && existsSync(file) ? relativePostPath(file) : null;
if (!rel) {
  print(
    "用法：npm run verify:deploy -- <src/content/posts/…/post.md> [--timeout=秒] [--commit=sha]"
  );
  process.exit(2);
}
const post = readPost(file);
if (post.error || !post.data.title) {
  print(`无法读取标题：${post.error ?? "frontmatter 缺少 title"}`);
  process.exit(2);
}

const url = postUrl(rel);
const deadline = Date.now() + timeoutMs;
print(`验证 ${url}`);
const problems = [];
const deployProblem = sha ? await waitForVercel(sha, deadline) : null;
if (deployProblem) {
  problems.push(deployProblem);
} else {
  const page = await waitForArticle(url, post.data.title, deadline);
  if (page.status !== 200) {
    problems.push(`页面返回 HTTP ${page.status || page.error}`);
  } else if (!page.hasTitle) {
    problems.push("页面已返回 200，但没有出现文章标题");
  } else {
    const katexErrors = page.html.match(/katex-error/g)?.length ?? 0;
    if (katexErrors)
      problems.push(`${katexErrors} 处公式渲染失败（katex-error）`);
    const images = sameSiteImages(page.html);
    const statuses = await Promise.all(images.map(imageStatus));
    const broken = images.filter((_, i) => statuses[i] !== 200);
    broken.forEach(src => {
      problems.push(`图片返回 HTTP ${statuses[images.indexOf(src)]}：${src}`);
    });
    print("  标题：已出现");
    print(`  公式错误：${katexErrors}`);
    print(
      `  站内图片：${images.length - broken.length} / ${images.length} 可访问`
    );
  }
}

problems.forEach(msg => print(`  ✗ ${msg}`));
print(problems.length ? "  结果：未通过" : "  结果：通过");
process.exit(problems.length ? 1 : 0);
