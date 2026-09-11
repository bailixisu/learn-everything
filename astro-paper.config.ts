import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    // 部署到 Vercel 后，将这里替换为实际域名。
    url: "https://learn-everything-bailixisu.vercel.app/",
    title: "Learn Everything",
    description: "bailixisu 的个人数字花园：记录学习、项目实践与持续思考。",
    author: "bailixisu",
    profile: "https://github.com/bailixisu",
    ogImage: "default-og.jpg",
    lang: "zh-cn",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    // 使用统一封面，避免构建时依赖 Google Fonts；以后可换成本地中文字体生成动态封面。
    dynamicOgImage: false,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/bailixisu/learn-everything/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/bailixisu" },
    { name: "mail", url: "mailto:1430344692@qq.com" },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "mail", url: "mailto:?subject=推荐阅读&body=" },
  ],
});