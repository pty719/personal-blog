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
