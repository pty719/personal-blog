import json
import uuid

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..schemas import AssistantCreate, AssistantOut
from ..models import Assistant, Article, Moment
from ..utils.ratelimit import check_rate_limit
from ..utils.llm import chat_completion
from ..db import get_db, SessionLocal

router = APIRouter(prefix='/api/assistants', tags=['Assistant'])


# 定义两个工具
# 定义查询文章工具
def search_articles(keyword: str) -> str:
    """按照标题模糊查文章列表"""
    db = SessionLocal()
    try:
        query = db.query(Article)
        if keyword:
            query = query.filter(Article.title.contains(keyword))
        items = query.order_by(Article.created_at.desc()).limit(5).all()
        return json.dumps(
            [{"id": a.id, "title": a.title, "created_at": str(a.created_at)[:10]} for a in items],
            ensure_ascii=False
        )
    finally:
        db.close()


# 定义查询说说工具
def search_moments():
    """查最近10条说说"""
    db = SessionLocal()
    try:
        query = db.query(Moment)
        query = query.order_by(Moment.created_at.desc()).limit(10).all()
        return json.dumps(
            [{"id": a.id, "content": a.content, "created_at": str(a.created_at)[:10]} for a in query],
        )
    finally:
        db.close()


# 定义工具参数
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge",
            "description": "检索文章正文内容片段（语义搜索），用于回答'某篇文章讲了什么/具体内容是什么'这类问题——需要文章内容时必须用这个",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词或问题"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_moments",
            "description": "查最近十条说说",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]


# React循环

# 定义call_tool
def call_tool(name: str, args: dict) -> str:
    if name == "search_articles":
        return search_articles(args.get("keyword", ""))
    elif name == "search_moments":
        return search_moments()
    elif name == "search_knowledge":
        from ..services.rag import search
        return search(args.get("query", ""))
    return "未知工具"


# 系统提示词
SYSTEMPROMPT = "你是小站站长的AI助手，回答简洁友好，基于站内数据回答。"


# 把react循环跑起来！
def run_agent(messages):
    messages = [{"role": "system", "content": SYSTEMPROMPT}] + messages
    for _ in range(5):
        msg = chat_completion(messages, TOOLS)
        if msg.get("tool_calls"):
            messages.append(msg)
            for call in msg["tool_calls"]:
                name = call["function"]["name"]
                yield {"type": "tool", "content": f"正在调用：{name}"}
                result = call_tool(name, json.loads(call["function"]["arguments"]))
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})
            continue
        else:
            yield {"type": "answer", "content": msg["content"]}
            return


def event_stream(conv_id, is_new, history):
    if is_new:
        yield f'data: {json.dumps({"type": "conversation_id", "id": conv_id})} \n\n'
    messages = [{"role": m.role, "content": m.content} for m in history]
    try:
        for event in run_agent(messages):
            if event["type"] == "tool":
                yield f'data: {json.dumps({"type": "tool", "content": event["content"]}, ensure_ascii=False)} \n\n'
            elif event["type"] == "answer":
                db = SessionLocal()
                try:
                    db.add(Assistant(conversation_id=conv_id, role="assistant", content=event["content"]))
                    db.commit()
                finally:
                    db.close()
                yield f'data: {json.dumps({"type": "text", "content": event["content"]}, ensure_ascii=False)} \n\n'
    except Exception:
        yield f'data: {json.dumps({"type": "text", "content": "AI 服务暂时不可用，请稍后再试"}, ensure_ascii=False)} \n\n'
    yield f"data: {json.dumps({"type": "done"})} \n\n"


# =========================================
# API 路由：POST /api/assistants/chat
# =========================================
@router.post("/chat")
def chat(
        data: AssistantCreate,
        request: Request,
        db: Session = Depends(get_db)
):
    ip = request.client.host
    if not check_rate_limit(ip):
        raise HTTPException(status_code=429, detail="请求太频繁,请稍后再试!")
    conv_id = data.conversation_id or str(uuid.uuid4())
    db.add(Assistant(conversation_id=conv_id, role='user', content=data.content))
    db.commit()
    history = db.query(Assistant).filter(Assistant.conversation_id == conv_id).order_by(Assistant.created_at).all()
    if data.conversation_id:
        msg_count = db.query(Assistant).filter(Assistant.conversation_id == data.conversation_id).count()
        if msg_count >= 100:
            raise HTTPException(status_code=429, detail="会话已达上限，请新开对话")
    return StreamingResponse(
        event_stream(conv_id, is_new=(data.conversation_id is None), history=history),
        media_type="text/event-stream",
    )


