# -*- coding: utf-8 -*-
"""moments 一键验收脚本：自动登录 + 自动测 11 条用例，最后清理测试数据。
【怎么用】PyCharm 底部 Terminal 里执行：
    cd D:/blog_project/backend
    ./.venv/Scripts/python test_moments.py

看到 "全部通过" 就说明你的 moments 功能验收完成。
"""
import sys

import httpx

BASE = "http://127.0.0.1:8000"   # 后端地址（本地开发就是这个）
PASS = 0
FAIL = 0


def report(name: str, ok: bool, extra: str = ""):
    """记录一条测试结果：通过打勾，失败打叉并带上实际返回"""
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"[PASS] {name}")
    else:
        FAIL += 1
        print(f"[FAIL] {name}   {extra}")


def main():
    # 第 0 步：确认服务活着，没活就给启动命令
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        assert r.json().get("status") == "ok"
    except Exception as e:
        print("[服务未启动] 先运行下面的命令启动后端：")
        print("    cd D:\\blog_project\\backend")
        print("    .\\.venv\\Scripts\\python -m uvicorn app.main:app --reload --port 8000")
        print(f"  当前检测: {e}")
        sys.exit(1)
    print("== 服务在线，开始测试 ==")

    # 第 1 步：登录拿 token（脚本自动完成，不用你复制）
    r = httpx.post(f"{BASE}/api/auth/login",
                   json={"username": "admin", "password": "admin123"})
    report("登录 -> 200", r.status_code == 200, f"实际 {r.status_code} {r.text[:80]}")
    if r.status_code != 200:
        print("\n登录失败，后面的测试无法继续。")
        print("可能原因：数据库里没有 admin 账号 → 运行 .\\.venv\\Scripts\\python init_db.py")
        sys.exit(1)
    token = r.json()["access_token"]
    H = {"Authorization": f"Bearer {token}"}   # 脚本自动带上正确的 Bearer 头

    # 第 2 步：空列表结构
    r = httpx.get(f"{BASE}/api/moments?page=1&page_size=5")
    body = r.json()
    report("GET 列表 -> 200 且结构正确",
           r.status_code == 200 and "total" in body and "items" in body,
           f"实际 {r.status_code}")

    # 第 3 步：未登录发布 -> 401
    r = httpx.post(f"{BASE}/api/moments", json={"content": "x"})
    report("未登录发布 -> 401", r.status_code == 401, f"实际 {r.status_code}")

    # 第 4 步：登录后发布 -> 201
    r = httpx.post(f"{BASE}/api/moments", headers=H, json={"content": "一键测试说说"})
    report("登录后发布 -> 201", r.status_code == 201, f"实际 {r.status_code} {r.text[:80]}")
    mid1 = r.json().get("id") if r.status_code == 201 else None

    # 第 5 步：空 content -> 422
    r = httpx.post(f"{BASE}/api/moments", headers=H, json={"content": ""})
    report("空 content -> 422", r.status_code == 422, f"实际 {r.status_code}")

    # 第 6 步：超长 content(501字) -> 422
    r = httpx.post(f"{BASE}/api/moments", headers=H, json={"content": "长" * 501})
    report("超长 content -> 422", r.status_code == 422, f"实际 {r.status_code}")

    # 第 7 步：带 images 发布 -> 201
    r = httpx.post(f"{BASE}/api/moments", headers=H,
                   json={"content": "带图说说", "images": "https://example.com/1.jpg"})
    report("带 images 发布 -> 201", r.status_code == 201, f"实际 {r.status_code}")
    mid2 = r.json().get("id") if r.status_code == 201 else None

    # 第 8 步：列表 total 增加
    r = httpx.get(f"{BASE}/api/moments?page=1&page_size=5")
    report("列表 total 正确(>=2)", r.json()["total"] >= 2, f"实际 total={r.json()['total']}")

    # 第 9 步：删除 -> 204
    if mid1:
        r = httpx.delete(f"{BASE}/api/moments/{mid1}", headers=H)
        report("删除 -> 204", r.status_code == 204, f"实际 {r.status_code}")
    else:
        report("删除 -> 204", False, "上一步发布失败，没有可删的数据")

    # 第 10 步：删不存在 -> 404
    r = httpx.delete(f"{BASE}/api/moments/99999", headers=H)
    report("删除不存在 -> 404", r.status_code == 404, f"实际 {r.status_code}")

    # 第 11 步：未登录删除 -> 401
    if mid2:
        r = httpx.delete(f"{BASE}/api/moments/{mid2}")   # 故意不带 token
        report("未登录删除 -> 401", r.status_code == 401, f"实际 {r.status_code}")
        # 清理自己创建的测试数据（带上 token 再删一次）
        httpx.delete(f"{BASE}/api/moments/{mid2}", headers=H)
    else:
        report("未登录删除 -> 401", False, "上一步发布失败，没有可删的数据")

    # 汇总
    print(f"\n结果: {PASS} 通过 / {FAIL} 失败 / 共 {PASS + FAIL} 项")
    if FAIL == 0:
        print("🎉 全部通过！moments 功能验收完成")
    else:
        print("有失败项 → 把上面 [FAIL] 开头的行截图发给助手")


if __name__ == "__main__":
    main()
