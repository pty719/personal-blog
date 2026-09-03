<script setup>
import { ref, onMounted } from 'vue'

// ① 响应式数据：articles 存文章列表，loading 标记加载状态
const moments = ref([])
const loading = ref(true)          // 初始为 true：还没加载完
const error = ref('')              // 加载失败时存错误信息

// ② onMounted：组件挂载后自动执行 → 拉后端数据（每个页面的标准套路）
onMounted(async () => {
  try {
    // 走 Vite 代理：/api 自动转发到后端 8000（vite.config.js 里配的）
    const res = await fetch('/api/moments')
    const data = await res.json()
    moments.value = data.items    // 把后端返回的文章列表存入 ref
  } catch (e) {
    error.value = '加载失败：' + e.message + '（后端启动了吗？）'
  } finally {
    loading.value = false          // 无论成功失败，都结束加载状态
  }
})
</script>

<template>
  <h2>说说列表</h2>

  <!-- ③ 三个状态：加载中 / 出错 / 空列表，用 v-if 逐个判断 -->
  <p v-if="loading">加载中...</p>
  <p v-else-if="error">{{ error }}</p>
  <p v-else-if="moments.length === 0">暂无说说</p>

  <!-- ④ v-for 遍历真实数据，:key 用 article.id（后端返回的唯一 id） -->
  <ul v-else>
    <li v-for="moment in moments" :key="moment.id" class="moment-item">
        <div class="moment-content">{{ moment.content }}</div>
        <div v-if="moment.images" class="moment-images">
          <img
              :src="moment.images.split(',')[0]"
              loading="lazy"
              class="moment-images"
              alt="说说配图"
          >
        </div>
        <div class="moment-meta">
          {{ moment.created_at.slice(0,10) }}
      </div>
    </li>
  </ul>
</template>

<style scoped>
.moment-item {
  list-style: none;
  padding: 16px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.moment-content { font-size: 18px; font-weight: bold; }
.moment-images {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
  margin-top: 8px;
}
.moment-meta { color: #9ca3af; font-size: 13px; }
</style>
