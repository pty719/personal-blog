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
def call_tool(name: str, args: dict) -> tuple[str, list[dict]]:
    if name == "search_moments":
        return search_moments(), []
    elif name == "search_knowledge":
        from ..services.rag import search_with_sources
        return search_with_sources(args.get("query", ""))
    return "未知工具", []


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
                result, sources = call_tool(name, json.loads(call["function"]["arguments"]))
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})
                if sources:
                    yield {"type": "sources", "sources": sources}
            continue
        else:
            yield {"type": "answer", "content": msg["content"]}
            return


def event_stream(conv_id, is_new, history):
    if is_new:
        yield f'data: {json.dumps({"type": "conversation_id", "id": conv_id})} \n\n'
    #重要！summary要加在前面
    history.sort(key=lambda x: 0 if x.role == "summary" else 1)
    messages = [{"role": m.role, "content": m.content} for m in history]
    try:
        for event in run_agent(messages):
            if event["type"] == "tool":
                yield f'data: {json.dumps({"type": "tool", "content": event["content"]}, ensure_ascii=False)} \n\n'
            elif event["type"] == "sources":
                yield f'data: {json.dumps({"type": "sources", "sources": event["sources"]}, ensure_ascii=False)} \n\n'
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

COMPRESS_PROMPT = "把下面的对话压缩成一段 120 字以内的摘要，保留：用户问过什么、助手回答的要点、涉及的主题。不要遗漏用户还没解决的问题：\n{要压缩的对话}"
#定义记忆压缩函数
def compress_history(history) -> list:
    summary_messages = None
    normal_messages = []
    for m in history:
        if m.role == "summary":
            summary_messages = m
        else:
            normal_messages.append(m)
    to_compress = []
    if summary_messages:
        to_compress.append({"role": "user", "content": f"[之前的会话摘要]:{summary_messages.content}"})
    old_messages = normal_messages[:-5]
    for m in old_messages:
        to_compress.append({"role": m.role, "content": m.content})
    messages = [{"role" : "system", "content" : COMPRESS_PROMPT}] + to_compress
    msg = chat_completion(messages)
    return [old_messages, msg["content"]]

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

    if len(history) > 20:
        old_messages, new_messages = compress_history(history)
        for m in old_messages:
            db.delete(m)
        exist_summary = db.query(Assistant).filter(Assistant.conversation_id == conv_id, Assistant.role == "summary").first()
        if exist_summary:
            exist_summary.content = new_messages
        else:
            db.add(Assistant(conversation_id=conv_id, role='summary', content=new_messages))
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


