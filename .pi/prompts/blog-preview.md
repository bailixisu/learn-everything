---
description: 检查博客草稿并给出本地预览地址，不发布
argument-hint: "<草稿文件路径>"
---
请加载并严格执行 `blog-workflow` skill 的 **preview** 阶段。

待预览草稿：$ARGUMENTS

检查项目和草稿，运行必要验证，返回准确的本地启动命令与文章 URL。保持 `draft: true`，不要提交、不要推送、不要发布。
