---
title: Transformer 中的位置编码：原理、公式与 PyTorch 实现
description: 从自注意力的置换等变性出发，推导正弦/余弦位置编码，比较可学习位置嵌入、相对位置、RoPE 与 ALiBi，并给出带形状说明的 PyTorch 实现。
pubDatetime: 2026-09-17T03:00:54.847Z
featured: false
draft: false
type: knowledge
tags:
  - Transformer
  - 位置编码
  - 自注意力
  - PyTorch
  - 深度学习
---

如果只把一组词元嵌入（token embedding）交给自注意力层，模型能比较“哪些词元相关”，却不会从注意力公式本身得知“谁在前、谁在后”。位置编码（positional encoding）就是为序列表示补上顺序或距离信息。

本文面向刚开始学习 Transformer 的读者。读完后，你将能够：

- 解释普通自注意力为什么不编码顺序；
- 看懂经典正弦/余弦位置编码的公式与维度；
- 区分固定位置编码和可学习位置嵌入；
- 理解相对位置编码、RoPE 与 ALiBi 把位置信息放在哪里；
- 在 PyTorch 中实现一个带形状检查的位置编码模块。

前置知识包括词元嵌入、点积、softmax、基本矩阵运算和 PyTorch 张量操作。

## 自注意力为什么不知道顺序

先看一个直观例子：“猫追狗”和“狗追猫”包含同一组词元，却有不同顺序。如果输入只含各词元自身的嵌入，那么交换两行输入只会交换对应的输出；注意力计算没有额外依据判断哪一种排列是原来的词序。

下面用矩阵把这个性质写清楚。设一段序列表示为：

$$
X\in\mathbb{R}^{L\times d_{\text{model}}},
$$

其中 $L$ 是序列长度，$d_{\text{model}}$ 是每个词元的表示维度。单头自注意力先做线性投影：

$$
Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V.
$$

$W_Q,W_K\in\mathbb{R}^{d_{\text{model}}\times d_k}$ 和 $W_V\in\mathbb{R}^{d_{\text{model}}\times d_v}$ 是投影矩阵；$d_k$ 是每个注意力头中查询（query）和键（key）的维度，$d_v$ 是值（value）的维度。于是：

$$
\operatorname{Attention}(Q,K,V)
=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V.
$$

这里的 softmax 按每个查询对应的一行执行。公式比较的是表示之间的点积，没有使用位置编号。

令 $P$ 表示一个**只负责重排行的矩阵**，例如把第 1、2 行互换。用同一个 $P$ 重排输入，即 $X'=PX$。在没有位置特征和位置相关掩码时，可以得到：

$$
\operatorname{Attention}(PX)=P\operatorname{Attention}(X).
$$

这称为**置换等变性**：输入怎样重排，输出就对应地重排；计算规则不会把某一种排列识别为“正确词序”。原始 Transformer 不使用循环或卷积，因此需要显式注入相对或绝对位置；论文把位置编码加在编码器和解码器底部的输入嵌入上。[《Attention Is All You Need》](https://arxiv.org/html/1706.03762)给出了这一设计。

> 因果语言模型的 causal mask 会限制当前位置只能关注过去，因而带来方向性约束；但“裸自注意力公式本身不编码位置”仍然成立。

## 正弦/余弦绝对位置编码

经典 Transformer 用固定的正弦和余弦函数，为每个绝对位置 $pos$ 生成一个 $d_{\text{model}}$ 维向量。对维度对 $2i$ 和 $2i+1$：

$$
PE(pos,2i)=\sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right),
$$

$$
PE(pos,2i+1)=\cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right).
$$

符号含义如下：

- $pos\in\{0,1,\ldots,L-1\}$：词元的绝对位置；
- $i$：正弦/余弦维度对的编号；
- $d_{\text{model}}$：模型隐藏维度；
- $PE\in\mathbb{R}^{L\times d_{\text{model}}}$：整段序列的位置编码矩阵。

偶数维使用正弦，紧邻的奇数维使用同频率余弦。随着 $i$ 增大，分母增大，角度变化变慢。因此不同维度覆盖多种位置尺度：变化快的维度对相邻位置更敏感，变化慢的维度描述更长范围的变化。

### 一个四维示例

令 $d_{\text{model}}=4$，两组角度分别为：

$$
\theta_0(pos)=pos,\qquad \theta_1(pos)=\frac{pos}{100}.
$$

前三个位置的编码近似为：

| 位置 $pos$ | $PE(pos)$                              |
| ---------: | -------------------------------------- |
|          0 | $[0,\ 1,\ 0,\ 1]$                      |
|          1 | $[0.8415,\ 0.5403,\ 0.0100,\ 0.99995]$ |
|          2 | $[0.9093,\ -0.4161,\ 0.0200,\ 0.9998]$ |

这些数值是按公式计算的教学示例，不是训练结果。每个位置获得一个确定向量，而各维度对位置变化的响应速度不同。

### 为什么正弦和余弦成对出现

一对维度可以看成二维平面上的点：

$$
[\sin(\theta),\cos(\theta)].
$$

位置前进 $k$ 步，相当于在各个二维平面中旋转固定角度。根据三角恒等式，$pos+k$ 的同频率分量可以由 $pos$ 处的正弦和余弦线性表示。原论文据此提出，这种形式可能让模型更容易学习固定相对偏移。[原论文第 3.5 节](https://arxiv.org/html/1706.03762#S3.SS5)同时说明，作者选择固定版本是因为它**可能**有助于处理训练中未见的长度，而不是把外推能力作为保证。

因此要区分：公式能够为更大的 $pos$ **计算**向量，不代表模型会在远超训练长度时可靠**泛化**。后文会集中说明工程中的几种长度上限。

### 如何与词元嵌入结合

常见做法是逐元素相加：

$$
H_0=E+PE,
$$

其中 $E,H_0\in\mathbb{R}^{B\times L\times d_{\text{model}}}$，$B$ 是批大小。实现时，位置表可以保存为 $[1,L,d_{\text{model}}]$，再沿批维广播。

相加不会改变后续层期望的隐藏维度，也不会引入拼接后的额外投影；前提是词元嵌入与位置编码的最后一维相同。

## 固定编码与可学习位置嵌入

可学习绝对位置嵌入维护一个参数表：

$$
P\in\mathbb{R}^{L_{\max}\times d_{\text{model}}}.
$$

位置 $pos$ 直接查表取得 $P_{pos}$，再与词元嵌入相加；这个表随模型训练更新。

| 比较项         | 固定正弦/余弦编码              | 可学习绝对位置嵌入               |
| -------------- | ------------------------------ | -------------------------------- |
| 额外可训练参数 | 无                             | 约 $L_{\max}d_{\text{model}}$ 个 |
| 表示来源       | 预定义函数                     | 从训练数据学习                   |
| 实现长度       | 可按公式继续生成，缓存可能有限 | 查表范围受 $L_{\max}$ 限制       |
| 主要特点       | 简单、固定的归纳偏置           | 可针对训练分布调整               |
| 表外位置       | 可计算对应向量                 | 原始查表方式没有对应条目         |

可学习嵌入并不天然差，固定编码也不天然更好。输入长度稳定时，可学习查表很直接；希望减少位置参数或动态生成位置时，固定编码更方便。选择应服从模型定义和目标任务验证。

## 从绝对位置转向相对位置

绝对位置方案回答“这个词元位于第几个位置”，相对位置方案更关注“当前查询与某个键相隔多远”。一种便于理解的概括写法是：

$$
e_{ij}=\frac{q_i^\top k_j}{\sqrt{d_k}}+b(i-j),
$$

其中 $b(i-j)$ 是由相对距离决定的偏置。

这只是相对位置方法的一种形式。Shaw 等人的方案会把相对位置向量加入键和值相关的计算，并把过远距离裁剪到有限区间，而不只是增加一个标量偏置。相同距离的模式可以在序列不同区域复用；代价是实现与资源开销取决于具体变体，显式保存每对位置的关系可能需要与 $L^2$ 成正比的空间。详见[《Self-Attention with Relative Position Representations》](https://arxiv.org/html/1803.02155)。

## RoPE：旋转查询和键

RoPE（Rotary Position Embedding，旋转位置嵌入）不把位置向量加到词元嵌入上，而是把查询和键的维度两两分组，并按位置旋转。记位置 $m$ 对应的分块旋转矩阵为 $R_m$：

$$
\tilde q_m=R_mq_m,\qquad \tilde k_n=R_nk_n.
$$

旋转后的点积为：

$$
\tilde q_m^\top\tilde k_n
=q_m^\top R_m^\top R_nk_n
=q_m^\top R_{n-m}k_n.
$$

点积中的位置项因此依赖相对位移 $n-m$。这是 [RoFormer 论文](https://arxiv.org/html/2104.09864)推导的核心性质。

**优点：**不改变查询和键的维度；相对位移直接进入查询—键内积；可以在每个注意力层应用。

**限制与适用场景：**被旋转的维度需要能够两两分组；长上下文模型还可能调整频率基数或位置尺度，因此训练与推理必须采用匹配的 RoPE 配置。它常用于自回归语言模型，但不因此成为所有任务的默认最优解。

## ALiBi：直接偏置注意力分数

ALiBi（Attention with Linear Biases，带线性偏置的注意力）不创建位置嵌入，而是向每个注意力头的查询—键分数加入与距离成正比的惩罚。对因果注意力中的 $j\le i$，可写成：

$$
e_{ij}^{(h)}=
\frac{(q_i^{(h)})^\top k_j^{(h)}}{\sqrt{d_k}}
-m_h(i-j),
$$

其中 $m_h>0$ 是第 $h$ 个头预先设定的斜率。距离越远，负偏置越大；不同头采用不同斜率，从而形成不同的距离偏好。[ALiBi 论文](https://arxiv.org/html/2108.12409)在其语言模型实验中报告了“短序列训练、较长序列测试”的结果。

**优点：**形式简单，不需要位置嵌入参数；偏置可并入注意力 mask 的构造。

**限制与适用场景：**线性惩罚带有偏好较近上下文的归纳偏置，适合需要这种距离倾向且希望简化位置机制的场景，但未必匹配所有数据。论文中的结果也只直接支持其具体模型、数据和长度设置。

## 几种方案如何选择

| 方案              | 注入位置             | 核心特点             | 主要限制或注意点           |
| ----------------- | -------------------- | -------------------- | -------------------------- |
| 固定正弦/余弦     | 与词元嵌入相加       | 无位置参数，易实现   | 缓存长度与训练长度仍需管理 |
| 可学习绝对位置    | 与词元嵌入相加       | 能适配训练分布       | 参数表存在索引上限         |
| 相对位置表示/偏置 | 注意力分数或值       | 直接描述词元间距离   | 变体多，成本依实现而异     |
| RoPE              | 旋转查询和键         | 内积显式依赖相对位移 | 频率与缩放配置必须匹配     |
| ALiBi             | 注意力分数加线性偏置 | 简洁，具有距离惩罚   | 近邻偏置未必适合所有任务   |

学习原始 Transformer 时，先掌握正弦/余弦编码最合适；复现已有模型时，应沿用其位置方案和位置编号约定；设计新模型时，再结合任务、目标上下文长度、计算成本和验证指标选择。

## 可运行的 PyTorch 实现

下面实现固定正弦/余弦绝对位置编码，输入和输出形状都是 `[B, L, D]`，分别表示批大小、序列长度和隐藏维度。

传入的 `x` 应是**已经按上游架构约定处理好的词元嵌入**。例如，原始 Transformer 在嵌入层将词元嵌入按 $\sqrt{d_{\text{model}}}$ 缩放，再与位置编码相加，并对两者之和使用 dropout；因此若复现该架构，缩放应在调用下面模块之前完成。[原论文第 3.4、3.5 与 5.4 节](https://arxiv.org/html/1706.03762)分别说明了这些约定。其他模型可能采用不同缩放或归一化方式。

```python
import math

import torch
from torch import nn


class SinusoidalPositionalEncoding(nn.Module):
    """为 [batch, seq_len, d_model] 输入添加固定位置编码。"""

    def __init__(
        self,
        d_model: int,
        max_len: int = 512,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        if d_model <= 0:
            raise ValueError("d_model must be positive")
        if max_len <= 0:
            raise ValueError("max_len must be positive")

        # position: [max_len, 1]
        position = torch.arange(max_len, dtype=torch.float32).unsqueeze(1)

        # div_term: [ceil(d_model / 2)]
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32)
            * (-math.log(10000.0) / d_model)
        )

        # pe: [max_len, d_model]
        pe = torch.zeros(max_len, d_model, dtype=torch.float32)
        pe[:, 0::2] = torch.sin(position * div_term)

        # d_model 为奇数时，余弦槽位比正弦槽位少一个。
        cos_dims = pe[:, 1::2].shape[1]
        pe[:, 1::2] = torch.cos(position * div_term[:cos_dims])

        # 保存为 [1, max_len, d_model]，供批维广播。
        self.register_buffer("pe", pe.unsqueeze(0))
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [batch_size, seq_len, d_model]
        Returns:
            [batch_size, seq_len, d_model]
        """
        if x.ndim != 3:
            raise ValueError("x must have shape [batch_size, seq_len, d_model]")

        seq_len = x.size(1)
        if seq_len > self.pe.size(1):
            raise ValueError(
                f"seq_len={seq_len} exceeds max_len={self.pe.size(1)}"
            )
        if x.size(2) != self.pe.size(2):
            raise ValueError(
                f"input d_model={x.size(2)} does not match {self.pe.size(2)}"
            )

        # [1, seq_len, d_model]，在批维广播并匹配输入 dtype。
        position = self.pe[:, :seq_len].to(dtype=x.dtype)
        return self.dropout(x + position)


if __name__ == "__main__":
    batch_size, seq_len, d_model = 2, 6, 8
    token_embeddings = torch.randn(batch_size, seq_len, d_model)

    positional_encoding = SinusoidalPositionalEncoding(
        d_model=d_model,
        max_len=128,
        dropout=0.0,
    )
    output = positional_encoding(token_embeddings)

    print(output.shape)  # torch.Size([2, 6, 8])
    assert output.shape == token_embeddings.shape
```

`max_len` 是这份预计算位置表的长度，而不是正弦公式的数学上限。若输入超过它，应增大缓存，或改成按需扩展位置表。

## 实践中的常见问题

### 1. 最大序列长度不是一个概念

至少要区分：

1. **训练长度**：训练样本实际出现的长度；
2. **实现或配置上限**：预计算缓存、可学习位置表及模型配置支持的长度；
3. **推理长度**：部署时真正送入模型的长度。

“实现允许输入”只表示张量和位置机制能完成计算，不代表模型在该长度上仍有可接受的质量。长度外推需要在目标数据和目标长度上验证。ALiBi、RoPE 或其他相对位置方法可能在特定设置下改善外推表现，但不能代替验证。

### 2. 可学习位置表不能直接越界

若参数表大小为 $L_{\max}$，合法索引只有 $0$ 到 $L_{\max}-1$。扩展参数表、插值或替换位置方案都会改变模型行为；修改已训练模型后应重新评估，必要时继续训练。

### 3. 相加前必须对齐形状

词元嵌入为 `[B, L, D]` 时，位置编码应为 `[1, L, D]` 或 `[B, L, D]`。如果模型使用 `[L, B, D]`，切片与广播维度也要相应调整。不要混用 `batch_first` 约定。

### 4. padding 与位置编号要保持训练约定

padding 通常由 attention mask 屏蔽。位置编号是按张量槽位递增，还是只让有效词元连续编号，需要与训练时保持一致。左 padding 尤其容易造成位置偏移；加载预训练模型时不要擅自改变规则。

### 5. 缩放和 dropout 属于架构约定

“词元嵌入加位置编码”不是孤立模块的全部定义。输入是否先乘 $\sqrt{d_{\text{model}}}$、相加后是否 dropout、附近是否有归一化层，都取决于具体架构。复现模型时应遵循其原始实现，而不是只复制位置公式。

### 6. 缓存的 dtype 与设备要匹配输入

上面的实现先用 `float32` 构造位置表，前向传播时再转换为输入 dtype。实际使用时还应确保模块与输入位于同一设备；若自行保存普通张量而非使用模块注册机制，需要额外处理设备迁移。

## 小结

位置编码的核心作用，是让注意力计算能够利用顺序与距离：

- 正弦/余弦编码和可学习位置嵌入把绝对位置加入输入；
- 相对位置方案直接描述词元对之间的距离；
- RoPE 旋转查询和键，使内积依赖相对位移；
- ALiBi 用线性距离偏置调整注意力分数。

没有一种方案在所有任务、长度和算力约束下都始终最好。先确认位置信息在哪里进入模型，再在目标长度分布上验证，是比脱离场景寻找“最佳位置编码”更可靠的做法。

## 参考资料

- Vaswani et al., [Attention Is All You Need](https://arxiv.org/html/1706.03762)
- Shaw et al., [Self-Attention with Relative Position Representations](https://arxiv.org/html/1803.02155)
- Su et al., [RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/html/2104.09864)
- Press et al., [Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/html/2108.12409)
