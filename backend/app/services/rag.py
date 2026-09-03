from ..db import SessionLocal
from ..models import Article
import jieba
import math
from collections import Counter


INDEX = []

def chunk_text(content: str, size: int = 200) -> list[str]:
    """按固定长度切块(简单版: 生产用语义切块)"""
    chunks = []
    start = 0
    content_len = len(content)
    while start < content_len:
        end = min(content_len, start + size)
        chunks.append(content[start:end])
        start = end
    return chunks

def build_index():
    """遍历articles->切块->存全局列表[(id, title, chunk), ...]
    启动时调用一次(文章少,内存够)"""
    global INDEX
    db = SessionLocal()
    try:
        articles = db.query(Article).all()
        for article in articles:
            for chunk in chunk_text(article.content):
                INDEX.append((article.id, article.title, chunk, jieba.lcut(chunk)))
        print(f"[RAG]索引已经建成:共有{len(INDEX)}个块")
    finally:
        db.close()

def search(query: str, top_k: int = 3) -> str:
    """jieba分词 算每块的TF-IDF相似度 返回top_k块拼接的文本"""
    q_words = jieba.lcut(query)
    q_Counter = Counter(q_words)
    N = len(INDEX)
    #计算idf,之前我还以为idf是jieba的一个方法呢,结果要自己算
    words_chunk = Counter()
    for _id, title, chunk, chunk_words in INDEX:
        words_chunk.update(set(chunk_words))
    idf = {w: math.log(N / ( 1 + cnt ) ) for w, cnt in words_chunk.items()}
    #算得分
    scored = []
    for item in INDEX:
        _id, title, chunk, chunk_words = item
        chunk_counter = Counter(chunk_words)
        score = 0.0
        for w, q_tf in q_Counter.items():
            if w in chunk_counter:
                score += q_tf * chunk_counter[w] * idf.get(w, 0)
        scored.append((score, title, chunk))

    #取top_k
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    # ④ 拼成给 LLM 的文本（带标题 = 回答能引用来源）
    result = []
    for score, title, chunk in top:
        result.append(f"【文章《{title}》】：{chunk}")
    return "\n\n".join(result)

