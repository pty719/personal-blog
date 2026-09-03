# -*- coding: utf-8 -*-
"""friends + projects 一键验收脚本：自动登录、测 18 条用例、自动清理。
保存到 backend/ 目录后运行： ./.venv/Scripts/python test_friends_projects.py
"""
import sys
import httpx

BASE = "http://127.0.0.1:8000"
PASS = 0
FAIL = 0


def report(name: str, ok: bool, extra: str = ""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"[PASS] {name}")
    else:
        FAIL += 1
        print(f"[FAIL] {name}   {extra}")


def main():
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        assert r.json().get("status") == "ok"
    except Exception as e:
        print("[服务未启动] 先运行: ./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000")
        print(f"  检测: {e}")
        sys.exit(1)

    r = httpx.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "admin123"})
    report("登录 -> 200", r.status_code == 200, f"实际 {r.status_code}")
    if r.status_code != 200:
        sys.exit(1)
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}

    # ---------- friends ----------
    r = httpx.get(f"{BASE}/api/friends")
    report("F1 GET /api/friends -> 200 且返回数组",
           r.status_code == 200 and isinstance(r.json(), list), f"实际 {r.status_code}")
    report("F2 未登录新增 -> 401",
           httpx.post(f"{BASE}/api/friends", json={"name": "x", "url": "https://x.com"}).status_code == 401, "")

    r = httpx.post(f"{BASE}/api/friends", headers=H,
                   json={"name": "小明", "url": "https://xiaoming.blog", "description": "前端大佬"})
    report("F3 登录后新增 -> 201", r.status_code == 201, f"实际 {r.status_code} {r.text[:80]}")
    fid = r.json().get("id") if r.status_code == 201 else None
    report("F4 name 为空 -> 422",
           httpx.post(f"{BASE}/api/friends", headers=H, json={"name": "", "url": "https://x.com"}).status_code == 422, "")
    report("F5 url 为空 -> 422",
           httpx.post(f"{BASE}/api/friends", headers=H, json={"name": "x", "url": ""}).status_code == 422, "")
    report("F6 name 超长(51字) -> 422",
           httpx.post(f"{BASE}/api/friends", headers=H, json={"name": "长" * 51, "url": "https://x.com"}).status_code == 422, "")

    if fid:
        report("F7 删除 -> 204",
               httpx.delete(f"{BASE}/api/friends/{fid}", headers=H).status_code == 204, "")
        report("F8 删不存在 -> 404",
               httpx.delete(f"{BASE}/api/friends/{fid}", headers=H).status_code == 404, "")
        report("F9 未登录删除 -> 401",
               httpx.delete(f"{BASE}/api/friends/{fid}").status_code == 401, "")

    # ---------- projects ----------
    r = httpx.get(f"{BASE}/api/projects")
    report("P1 GET /api/projects -> 200 且返回数组",
           r.status_code == 200 and isinstance(r.json(), list), f"实际 {r.status_code}")
    report("P2 未登录新增 -> 401",
           httpx.post(f"{BASE}/api/projects", json={"name": "x"}).status_code == 401, "")

    r = httpx.post(f"{BASE}/api/projects", headers=H,
                   json={"name": "小站", "description": "全栈博客", "repo": "https://github.com/me/blog",
                         "stars": 12, "tech_tags": "fastapi,vue3"})
    report("P3 登录后新增 -> 201", r.status_code == 201, f"实际 {r.status_code} {r.text[:80]}")
    pid = r.json().get("id") if r.status_code == 201 else None
    report("P4 name 为空 -> 422",
           httpx.post(f"{BASE}/api/projects", headers=H, json={"name": ""}).status_code == 422, "")
    report("P5 stars 为负数 -> 422",
           httpx.post(f"{BASE}/api/projects", headers=H, json={"name": "x", "stars": -1}).status_code == 422, "")
    report("P6 stars 非数字 -> 422",
           httpx.post(f"{BASE}/api/projects", headers=H, json={"name": "x", "stars": "abc"}).status_code == 422, "")

    if pid:
        report("P7 删除 -> 204",
               httpx.delete(f"{BASE}/api/projects/{pid}", headers=H).status_code == 204, "")
        report("P8 删不存在 -> 404",
               httpx.delete(f"{BASE}/api/projects/{pid}", headers=H).status_code == 404, "")
        report("P9 未登录删除 -> 401",
               httpx.delete(f"{BASE}/api/projects/{pid}").status_code == 401, "")

    print(f"\n结果: {PASS} 通过 / {FAIL} 失败 / 共 {PASS + FAIL} 项")
    if FAIL == 0:
        print("🎉 全部通过！friends + projects 开发完成，Week 1 后端全部收工")
    else:
        print("有失败项 → 把 [FAIL] 行截图发给助手")


if __name__ == "__main__":
    main()