import type { CollectionEntry } from "astro:content";
import config from "@/config";

/**
 * Determines whether a post is eligible to be listed/rendered.
 *
 * - In development, includes drafts so they can be reviewed locally
 * - In production, excludes drafts and scheduled posts until `pubDatetime` minus the configured margin
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  const isLocalPreview = import.meta.env.MODE === "development";
  return isLocalPreview || (!data.draft && isPublishTimePassed);
}
