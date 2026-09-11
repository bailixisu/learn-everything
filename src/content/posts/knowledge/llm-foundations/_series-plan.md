# 大模型基础系列规划

> 工作目录：`src/content/posts/knowledge/llm-foundations/`
>
> 系列名称：`大模型基础：Transformer 与现代 LLM`
>
> 当前状态：规划完成，前两篇已发布；其余文章仍需完成草稿、评审与人工发布确认。

## 系列要回答的问题

这组文章不把大模型讲成一串术语，而是沿着“表示 → 架构 → 训练 → 推理 → 扩展”的顺序回答：

1. Transformer 为什么能够取代大量循环网络架构？
2. Attention 到底计算了什么，为什么有二次复杂度？
3. Encoder、Decoder 和 Encoder–Decoder 为什么演化出 BERT、GPT、T5 三条路线？
4. 现代 LLM 为什么使用 RoPE、RMSNorm、SwiGLU、GQA 和 Pre-Norm？
5. Linear Transformer、Sparse Attention、FlashAttention 分别优化了什么，它们是不是一回事？
6. 大模型怎样预训练、对齐、推理和压缩？

## 文章规划

| 序号 | 文章                              | 核心问题                                                             | 关键视觉                                  |
| ---- | --------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| 1    | Transformer 到底改变了什么        | 原始架构、数据流、Attention 与变体地图                               | 总体架构、一次注意力计算、家族地图        |
| 2    | Self-Attention 从公式到直觉       | Q/K/V、缩放、Mask、多头机制                                          | 向量计算分解、Attention 热力图、Mask 对比 |
| 3    | 位置从哪里来                      | 正弦位置编码、相对位置、RoPE、ALiBi                                  | 旋转几何、相对距离对比                    |
| 4    | Encoder、Decoder 与三大家族       | BERT、GPT、T5 的结构与训练目标                                       | 三路数据流、可见性矩阵                    |
| 5    | 现代 LLM 的 Transformer 积木      | Pre-Norm、RMSNorm、SwiGLU、RoPE、MQA/GQA                             | 2017 与现代 Decoder 对照剖面              |
| 6    | 高效 Attention 全景               | 局部、稀疏、低秩、哈希、递归、IO 优化                                | 方法坐标系、复杂度与信息路径              |
| 7    | Linear Transformer                | 核技巧、计算顺序、因果前缀状态、局限                                 | 二次矩阵与线性状态流对照                  |
| 8    | 长上下文工程                      | Transformer-XL、Longformer、Reformer、FlashAttention、PagedAttention | 长上下文技术栈与显存账本                  |
| 9    | MoE 与模型容量扩展                | Router、专家并行、负载均衡、容量与计算量                             | Token 路由和容量/成本曲线                 |
| 10   | 从预训练到对齐                    | Next-token、SFT、偏好优化、评测边界                                  | 数据与目标函数流水线                      |
| 11   | 推理时发生了什么                  | Prefill、Decode、KV Cache、采样、量化                                | 请求生命周期、KV Cache 增长图             |
| 12   | 手写一个可验证的 Mini Transformer | 最小实现、形状检查、训练实验、注意力可视化                           | 实验输出与参数流追踪                      |

## 视觉标准

- 不用装饰性方框凑图；每张图必须解释一个仅靠文字不容易看清的问题。
- 精确结构图采用原创重绘，明确标注“概念重绘”与依据来源。
- 论文原图只有在许可明确时才直接使用，并保留论文标题、作者、链接与许可证信息。
- 图中必须有层级、阅读方向、图例和结论，不能只有模块名称。
- 默认输出高分辨率 WebP，兼顾 Obsidian、GitHub、Astro 与 Vercel。
- 数值示意必须明确标注“示意”，不能伪装成实验结果。
- 每篇完成后检查桌面端、移动端、浅色主题与深色主题下的可读性。

## 第一阶段

先完成第 1～7 篇 Transformer 主线，再扩展训练、推理和实验文章。第 1 篇负责建立全系列概念地图，不提前塞入过多数学证明。
