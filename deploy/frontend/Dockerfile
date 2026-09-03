# 前端镜像：两阶段构建（多阶段 = 构建环境与运行环境分离，镜像小）
# 阶段 1：node 环境里 npm 构建出 dist/
FROM node:20-alpine AS build
WORKDIR /app
# 先复制 package.json 装依赖（层缓存优化）
COPY package.json ./
RUN npm install --registry=https://registry.npmmirror.com
# 再复制源码构建
COPY . .
RUN npm run build

# 阶段 2：nginx 托管 dist/ + 反代 /api（最终镜像只有 nginx，几十 MB）
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
