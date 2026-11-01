import json

import httpx

from ..config import settings


def chat_completion(messages, tools=None)->dict:
    headers = {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "stream": False,
    }
    if tools:
        payload["tools"] = tools
    with httpx.Client(timeout=60) as client:
        response = client.post(
            "https://api.deepseek.com/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        # 返回整个 message 对象（含 tool_calls）——调用方按需取 content
        return data["choices"][0]["message"]


def chat_completion_stream(messages, tools=None):
    """流式版：逐块产出 DeepSeek/OpenAI 的 delta 对象。

    delta 里可能有 content（文本增量），也可能有 tool_calls（工具调用片段）。
    调用方负责把 content 立刻转发给浏览器、把 tool_calls 累积成完整调用。
    """
    headers = {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "stream": True,
    }
    if tools:
        payload["tools"] = tools
    timeout = httpx.Timeout(120.0, read=120.0)
    with httpx.Client(timeout=timeout) as client:
        with client.stream(
            "POST",
            "https://api.deepseek.com/chat/completions",
            headers=headers,
            json=payload,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if choices:
                    yield choices[0].get("delta") or {}
