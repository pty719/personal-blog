#!/bin/bash
# 小站服务器端一键部署：装 Docker → 镜像加速 → .env → compose 起服务 → 验证
set -e
cd /opt/blog/deploy

echo "=============================================="
echo "[1/5] Docker 检查/安装"
echo "=============================================="
if ! command -v docker >/dev/null 2>&1; then
  echo "  安装 Docker（阿里云源，get.docker.com 国内连不上）..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "  Docker 已安装: $(docker --version)"
fi

echo "=============================================="
echo "[2/5] 配置镜像加速器（国内拉镜像必备）"
echo "=============================================="
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.m.daocloud.io", "https://dockerproxy.com"]
}
EOF
systemctl daemon-reload && systemctl restart docker
echo "  加速器已配置"

echo "=============================================="
echo "[3/5] 生成 .env（MySQL 密码 + JWT 密钥，随机生成，不打印）"
echo "=============================================="
if [ ! -f .env ]; then
  MYSQL_PW=$(openssl rand -hex 12)
  JWT_SECRET=$(openssl rand -hex 32)
  echo "MYSQL_ROOT_PASSWORD=$MYSQL_PW" > .env
  echo "JWT_SECRET=$JWT_SECRET" >> .env
  echo "  .env 已生成（值已写入服务器 /opt/blog/deploy/.env）"
else
  echo "  .env 已存在，跳过"
fi

echo "=============================================="
echo "[4/5] docker compose 构建并启动（首次拉镜像+构建约 10-20 分钟）"
echo "=============================================="
docker compose up -d --build

echo "=============================================="
echo "[5/5] 验证"
echo "=============================================="
sleep 5
echo "-- 容器状态 --"
docker compose ps
echo "-- 前端页面 --"
curl -s -o /dev/null -w "  http://127.0.0.1:8080/ -> HTTP %{http_code}\n" http://127.0.0.1:8080/
echo "-- API 健康检查 --"
curl -s http://127.0.0.1:8080/api/health && echo ""
echo "-- 登录接口（数据库链路） --"
curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | head -c 200 && echo ""
echo "=============================================="
echo "部署流程结束"
echo "=============================================="
