<!-- 首页组件：第一个 Vue 页面（第 5 个读）
     功能：页面加载时调用后端 /api/health，把结果显示出来
     作用：验证"前端 <-> Vite代理 <-> 后端"整条链路通了
     阅读顺序：main.js -> App.vue -> router/index.js -> 本文件 -->
<script setup>
import { onMounted, ref } from 'vue'

// 响应式数据：后端返回的状态信息（初始显示"检查中..."）
const health = ref('检查中...')

// onMounted：组件挂载到页面后自动执行的钩子函数
onMounted(async () => {
  try {
    // 注意：这里写的是相对路径 /api/health（没有写 localhost:8000）
    // 开发时 Vite 自动转发给后端 8000 端口（见 vite.config.js 的 proxy）
    const res = await fetch('/api/health')
    const data = await res.json()
    health.value = JSON.stringify(data)   // 把 JSON 转成字符串显示
  } catch (e) {
    health.value = '连接后端失败：' + e.message + '（后端启动了吗？）'
  }
})
</script>

<template>
  <section>
    <h1>欢迎来到小站 🎉</h1>
    <p>这是 Week 2 的第一个页面。下面这行字是从后端实时拿到的：</p>
    <!-- 双花括号：Vue 插值语法，显示 ref 变量的值 -->
    <p class="health-box">后端状态：{{ health }}</p>
    <ul class="tips">
      <li>✅ 看到「后端状态：{"status":"ok","service":"blog-api"}」= 前后端链路打通</li>
      <li>📖 阅读顺序：index.html → vite.config.js → src/main.js → src/App.vue → src/router/index.js → 本文件</li>
      <li>✏️ 你的第一个任务：把导航栏 menu 数组里的「文章」菜单解注释，并在路由表加一篇文章列表页</li>
    </ul>
  </section>
</template>

<style scoped>
.health-box {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 12px 16px;
  border-radius: 8px;
  font-family: monospace;
}
.tips li { margin: 6px 0; }
</style>
