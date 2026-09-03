# 后端镜像：python + 依赖 + 启动
# 注意：build context 是 deploy/backend，但代码在项目根 backend/
# 所以在 compose 里 build 时要指定 context（见 docker-compose.yml 下方注释）
FROM python:3.13-slim

WORKDIR /app

# ① 先复制 requirements 并安装（Docker 层缓存：依赖没变就不重装，构建快）
COPY requirements.txt .
RUN pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# ② 再复制代码（代码变了只会重新复制，不重装依赖）
COPY app ./app
COPY init_db.py .

# ③ 启动：先建表+管理员（幂等，跑过会跳过），再起 uvicorn
# 0.0.0.0：容器内必须监听所有网卡（localhost 只对容器自身可见）
CMD ["sh", "-c", "python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
