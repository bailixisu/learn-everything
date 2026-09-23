import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

export const POSTS_DIR = "src/content/posts";
export const SITE_URL = "https://bailixisu.com";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const print = (line = "") => process.stdout.write(`${line}\n`);

/**
 * Returns the post path relative to the posts collection, using `/`,
 * or `null` when the file lives outside it.
 */
export function relativePostPath(file) {
  const rel = path.relative(path.resolve(POSTS_DIR), path.resolve(file));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

/**
 * Reads a post and splits it into frontmatter data and body.
 * `bodyLine` is the 1-based line number where the body starts.
 */
export function readPost(file) {
  const source = readFileSync(file, "utf8");
  const match = FRONTMATTER.exec(source);
  if (!match) {
    return {
      data: null,
      error: "missing frontmatter",
      body: source,
      bodyLine: 1,
    };
  }
  const bodyLine = match[0].split("\n").length;
  const body = source.slice(match[0].length);
  try {
    return { data: parse(match[1]) ?? {}, error: null, body, bodyLine };
  } catch (err) {
    return {
      data: null,
      error: `invalid YAML: ${err.message}`,
      body,
      bodyLine,
    };
  }
}

/**
 * Mirrors src/utils/getPostPaths.ts: directories starting with `_` are
 * dropped from the URL. Filenames are required to be kebab-case already.
 */
export function postUrl(rel) {
  const parts = rel.split("/");
  const slug = parts.pop().replace(/\.mdx?$/, "");
  const dirs = parts.filter(dir => !dir.startsWith("_"));
  return `${SITE_URL}/posts/${[...dirs, slug].join("/")}`;
}
