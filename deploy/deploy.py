# -*- coding: utf-8 -*-
"""小站一键部署脚本（paramiko 编排）
流程：连接 SSH → 上传 backend/frontend/deploy → 远程执行 install.sh
     （装 Docker → 镜像加速 → 生成 .env → compose 起服务 → 验证）
运行：cd D:/blog_project/deploy && ../backend/.venv/Scripts/python deploy.py
"""
import os
import stat
import sys
import time

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

# ⚠️ 服务器连接信息一律从环境变量读取，禁止硬编码（2026-10-13 开源前清理）
# 用法：在 deploy/.env 或 shell 里设 DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASSWORD
HOST = os.getenv("DEPLOY_HOST", "")
USER = os.getenv("DEPLOY_USER", "root")
PASSWORD = os.getenv("DEPLOY_PASSWORD", "")
REMOTE_BASE = "/opt/blog"
LOCAL_BASE = r"D:\blog_project"

# 上传时排除的目录/文件（大文件、敏感、不需要的）
EXCLUDE_DIRS = {".venv", "node_modules", "dist", "__pycache__", ".git"}
EXCLUDE_FILES = {"blog.db", ".bak", "check_auth.py", "auth_prove.py"}


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mkdir_p(sftp, path):
    """递归建目录（paramiko sftp.mkdir 一次只建一级）"""
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def upload_dir(sftp, local, remote):
    """递归上传目录（排除大目录和敏感文件）"""
    for name in os.listdir(local):
        if name in EXCLUDE_DIRS or name.endswith(".bak"):
            continue
        lp = os.path.join(local, name)
        rp = remote + "/" + name
        if os.path.isdir(lp):
            mkdir_p(sftp, rp)
            upload_dir(sftp, lp, rp)
        else:
            # 排除：敏感文件 + test_* 测试脚本（init_db.py 必须上传，容器启动要建表）
            if name in EXCLUDE_FILES or name.startswith("test_"):
                continue
            sftp.put(lp, rp)
            print(f"  ↑ {rp}", flush=True)


def run(ssh, cmd, timeout=3600):
    """远程执行命令，打印输出"""
    log(f"执行: {cmd[:100]}{'...' if len(cmd) > 100 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out.strip(), flush=True)
    if err.strip():
        print("[stderr] " + err.strip()[-2000:], flush=True)
    return stdout.channel.recv_exit_status()


def main():
    # 1. 连接
    log(f"连接 {HOST} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = ssh.open_sftp()
    log("SSH 连接成功")

    # 2. 建目录 + 上传
    mkdir_p(sftp, REMOTE_BASE)
    for sub in ("backend", "frontend", "deploy"):
        mkdir_p(sftp, f"{REMOTE_BASE}/{sub}")
    log("上传 backend/ ...")
    upload_dir(sftp, os.path.join(LOCAL_BASE, "backend"), f"{REMOTE_BASE}/backend")
    log("上传 frontend/ ...")
    upload_dir(sftp, os.path.join(LOCAL_BASE, "frontend"), f"{REMOTE_BASE}/frontend")
    log("上传 deploy/ ...")
    upload_dir(sftp, os.path.join(LOCAL_BASE, "deploy"), f"{REMOTE_BASE}/deploy")
    sftp.close()
    log("上传完成")

    # 3. 远程安装部署（install.sh 随 deploy 一起传上去了）
    code = run(ssh, f"chmod +x {REMOTE_BASE}/deploy/install.sh && bash {REMOTE_BASE}/deploy/install.sh")
    ssh.close()
    log(f"部署脚本退出码: {code}")
    if code == 0:
        log(f"✅ 部署完成！访问 http://{HOST}:8080")
    else:
        log("❌ 部署脚本有报错，查看上面输出定位")


if __name__ == "__main__":
    main()
