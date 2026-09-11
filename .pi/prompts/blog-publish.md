---
description: 经明确确认后发布指定博客文章
argument-hint: "<草稿文件路径>"
---
这是明确的发布指令。请加载并严格执行 `blog-workflow` skill 的 **publish** 阶段。

只发布这一篇草稿：$ARGUMENTS

发布前执行事实、隐私、格式、构建和 Git 变更检查。发现阻断问题就停止并报告；不要把无关改动加入提交。成功后返回文章网址和 commit hash。
