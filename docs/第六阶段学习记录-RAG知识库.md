# 第六阶段学习记录：RAG 知识库"问博主"

> 项目：小站 ｜ 周期：Week 3-4 ｜ 状态：✅ 完成并上线
> 公网演示：http://***REMOVED-ROTATED***/ai-assistant 问"微积分讲了什么？"

---

## 1. 阶段总览

| 任务 | 内容 | 状态 |
|---|---|---|
| 切块 | chunk_text（200 字固定长度） | ✅ |
| 索引 | build_index（jieba 分词 + 4 元组缓存） | ✅ |
| 检索 | search（TF-IDF + 余弦相似度） | ✅ |
| 集成 | search_knowledge 工具 + 合并 search_articles | ✅ |
| 前端 | 工具名友好映射（📚 检索知识库） | ✅ |
| 部署 | jieba 进镜像 + 公网验证 | ✅ |

**能力变化**：AI 助手从"能搜标题"升级为"能读全文内容回答"——语义检索增强生成。

---

## 2. RAG 概念（30 秒讲清）

```
问题：LLM 不知道你博客写了什么（训练数据之外）
解决：检索（Retrieval）→ 增强（Augmentation）→ 生成（Generation）
```

**五步流程**：
```
① 切块：文章按 200 字切块（chunk）
② 索引：每块 jieba 分词 + 存 (id, title, chunk, 词列表)
③ 检索：用户问题分词 → TF-IDF 相似度打分 → top 3 块
④ 增强：top 块拼进提示词（带标题 = 可引用来源）
⑤ 生成：DeepSeek 基于检索内容回答
```

---

## 3. TF-IDF 核心（自己实现的，面试重点）

### 概念
| 概念 | 意思 | 直觉 |
|---|---|---|
| TF | 词在块里出现多频繁 | "微积分"在微积分文章里出现 10 次 → 重要 |
| IDF | 词在多少块里出现（稀罕度） | "的"到处都是 → 没用；"微积分"只 1 篇有 → 值钱 |
| 相似度 | TF × IDF 打分，取 top-k | 问题像哪块就返回哪块 |

### 关键实现（踩坑后的正确版）
```python
# IDF：先统计"词在几块出现"（去重！），再 log 转换
words_chunk = Counter()
for _id, title, chunk, chunk_words in INDEX:
    words_chunk.update(set(chunk_words))
idf = {w: math.log(N / (1 + cnt)) for w, cnt in words_chunk.items()}

# 打分：遍历块，每块重置 score，词循环累加，块末尾 append
scored = []
for _id, title, chunk, chunk_words in INDEX:
    chunk_counter = Counter(chunk_words)
    score = 0.0                                  # ← 每块重置！
    for w, q_tf in q_Counter.items():
        if w in chunk_counter:
            score += q_tf * chunk_counter[w] * idf.get(w, 0)
    scored.append((score, title, chunk))         # ← 块末尾 append score！
```

### 取舍话术（面试）
> "MVP 用手写 TF-IDF 验证 RAG 全流程（纯 Python 零依赖），生产换 embedding 模型（如 bge-m3）+ 向量库（Chroma/Milvus）——架构不变，只换检索实现。"

---

## 4. 本阶段踩坑（全部实测）

| # | 坑 | 症状 | 解决 |
|---|---|---|---|
| 1 | **scored/score 变量名太像** | `scored.append((scored, ...))` 递归引用 | append 的是分数 score，不是列表 scored——变量名别用兄弟名 |
| 2 | score 未初始化 | UnboundLocalError | 每块循环开头 `score = 0.0` |
| 3 | scored 在循环内初始化 | 只剩最后一块 | 初始化在循环外、append 在块末尾 |
| 4 | Counter 从 typing 导入 | ImportError | Counter 在 collections |
| 5 | **LLM 不调 RAG 工具** | 只调 search_articles | 功能相近的工具会摇摆 → **合并工具**（删 search_articles，一个 search_knowledge 全包） |
| 6 | jieba 忘加 requirements | 容器 ModuleNotFoundError | 依赖必须进 requirements（httpx 教训重现） |
| 7 | --reload 不生效 | 改代码后还是旧行为 | reloader watch 可能失灵 → 重启后端确认 |
| 8 | 8000 被守护进程持续拉起 | 杀不死、PID 变 | 用户环境有 reloader 守护 → 换端口验证（8001） |

### 最有价值的坑：工具合并（第 5 个）

**现象**：search_articles（标题）和 search_knowledge（全文）功能相近 → LLM 随机摇摆，倾向选第一个 → RAG 永远不被调。

**解决**：删除 search_articles，search_knowledge 一个工具覆盖（标题+正文都在索引里）→ LLM 没得选 → 稳定调用。

**工具设计原则（面试点）**：
> "工具职责要单一且不重叠——两个工具做同一件事，LLM 就会选错。合并功能相近的工具，减少 LLM 的决策空间。工具 description 就是 LLM 的'使用说明书'，要写清使用边界。"

---

## 5. 面试速记（30 秒讲清 RAG）

> "我给 AI 助手做了 RAG 知识库：文章切块后用 TF-IDF 建立索引，用户提问时语义检索最相关的 top-3 块，拼进提示词让 DeepSeek 基于真实内容回答（带来源引用）。MVP 用手写 TF-IDF 验证流程，生产会换 embedding + 向量库。工具设计上我把搜索类工具合并成一个，避免 LLM 工具选择摇摆。"

**加分细节**：
- IDF 用 log(N/(1+cnt)) 平滑，词频去重统计
- 工具合并的决策过程（实测 LLM 摇摆 → 分析 → 合并）——体现工程思维
- 演进路线清晰：TF-IDF → embedding → 向量库

---

## 6. 升级：TF-IDF → Embedding（2026-09，已完成）

### 为什么升级
TF-IDF 只能**字面匹配**（问"导数"，文章没这词就找不到）；embedding 理解**语义**（"变化率"≈"导数"）。

### 技术选型（2G 服务器约束）
- sentence-transformers + torch（800MB）→ 太重 ❌
- **fastembed + onnxruntime + bge-small-zh-v1.5**（~150MB）✅
- 向量库：块少用 numpy 全量余弦（毫秒级）；量大换 FAISS/Chroma（接口不变）

### 核心代码（检索 3 行）
```python
q_vec = np.array(_embed([query])[0])                        # 问题向量
vectors = np.array([item[3] for item in INDEX])             # 所有块向量
scores = vectors @ q_vec / (np.linalg.norm(vectors, axis=1) * np.linalg.norm(q_vec) + 1e-9)
```

### 国内模型下载两个坑（实测）
1. HuggingFace 直连被墙 → `HF_ENDPOINT=https://hf-mirror.com`
2. 新版 huggingface_hub 默认 Xet 协议（cas-server.xethub.hf.co 401）→ `HF_HUB_DISABLE_XET=1`
（compose backend environment 已配好）

### 验证
问"微积分里研究变化率的概念是什么" → 命中讲**导数**的块（语义！TF-IDF 做不到）

### 面试话术
> "RAG 从 TF-IDF 升级到 embedding：对比了 torch 方案（800MB）对 2G 服务器太重，选 fastembed + bge-small-zh（轻量）。数据量小用 numpy 余弦检索，架构解耦随时换 FAISS。踩了国内模型下载的坑：HF 镜像 + 禁用 Xet 协议。"

---

## 7. 待办（后续增强）

- [ ] embedding 模型（bge-m3）+ 向量库（Chroma）替换 TF-IDF
- [ ] 语义切块（按段落/标题切，代替固定长度）
- [ ] 知识库覆盖说说/项目（现在只有文章）
- [ ] 回答引用链接化（点击跳到原文）