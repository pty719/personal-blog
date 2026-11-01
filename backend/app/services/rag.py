# RAG 知识库：embedding 版（fastembed + bge-small-zh-v1.5）
# 检索：文本 → 向量 → 余弦相似度（语义匹配，替代 TF-IDF 字面匹配）
# 结构：build_index（文章→切块→嵌入） / search（问题→嵌入→余弦 top_k）
# 说明：数据量小用 numpy 全量余弦；量大了换 FAISS/Chroma（接口不变）
import numpy as np
from fastembed import TextEmbedding

from ..db import SessionLocal
from ..models import Article

# 全局模型：只加载一次（模块导入时加载）
_model = TextEmbedding("BAAI/bge-small-zh-v1.5")


def chunk_text(content: str, size: int = 200) -> list[str]:
    """按固定长度切块"""
    chunks = []
    start = 0
    while start < len(content):
        end = min(len(content), start + size)
        chunks.append(content[start:end])
        start = end
    return chunks


def _embed(texts: list[str]) -> list[list[float]]:
    """文本列表 → 向量列表"""
    return list(_model.embed(texts))


# 全局索引：[(id, title, chunk, vector), ...]
INDEX = []


def build_index():
    """文章 → 切块 → 每块 embedding → 存 INDEX（启动时调用一次）"""
    global INDEX
    db = SessionLocal()
    try:
        articles = db.query(Article).all()
        INDEX = []
        for article in articles:
            chunks = chunk_text(article.content)   # 切块
            vectors = _embed(chunks)               # 一批文本一次嵌入
            for chunk, vec in zip(chunks, vectors):
                INDEX.append((article.id, article.title, chunk, vec))
        print(f"[RAG] 索引构建完成：{len(INDEX)} 个块（embedding 版）")
    finally:
        db.close()


def _search_results(query: str, top_k: int = 3) -> list[dict]:
    """问题 embedding → 与所有块余弦相似度 → top_k 结果（含文章 id/title/chunk）"""
    q_vec = np.array(_embed([query])[0])                       # (dim,)
    vectors = np.array([item[3] for item in INDEX])            # (N, dim)
    # 余弦相似度：cos = 点积 / (模1 × 模2)
    scores = vectors @ q_vec / (
        np.linalg.norm(vectors, axis=1) * np.linalg.norm(q_vec) + 1e-9
    )
    top_idx = scores.argsort()[::-1][:top_k]                   # 分数降序前 k
    results = []
    for i in top_idx:
        article_id, title, chunk, _vec = INDEX[i]
        results.append({"id": article_id, "title": title, "chunk": chunk})
    return results


def search_with_sources(query: str, top_k: int = 3) -> tuple[str, list[dict]]:
    """返回（拼好的上下文, 去重后的来源文章），供 AI 助手回答后渲染来源链接"""
    results = _search_results(query, top_k)
    context = "\n\n".join(f"【文章《{r['title']}》】：{r['chunk']}" for r in results)
    sources = []
    seen = set()
    for r in results:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        sources.append({"id": r["id"], "title": r["title"]})
    return context, sources


def search(query: str, top_k: int = 3) -> str:
    """兼容旧调用：只返回拼好的上下文"""
    context, _sources = search_with_sources(query, top_k)
    return context
