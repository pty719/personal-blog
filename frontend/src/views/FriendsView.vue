<script setup>
import { ref, onMounted } from "vue"
const friends = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async ()=>{
  try{
    const res = await fetch('/api/friends')
    friends.value = await res.json()
  }catch (e){
    error.value = '加载失败' + e.message + '后端启动了吗？'
  }finally {
    loading.value = false
  }
})
</script>

<template>
  <h2>友链列表</h2>

  <p v-if="loading">加载中...</p>
  <p v-else-if="error">{{error}}</p>
  <p v-else-if="friends.length == 0">暂无友链</p>

  <div v-else class="friend-grid">
    <a v-for="friend in friends" :key="friend.id" :href="friend.url" target="_blank"
       :class="['friend-card', { 'friend-inactive': !friend.is_active }]">
      <img v-if="friend.avatar" :src="friend.avatar" loading="lazy" class="friend-avatar">
      <span v-else class="friend-avatar friend-fallback">{{ friend.name[0]}}</span>
      <div class="friend-info">
        <div class="friend-name">
          {{ friend.name }}
          <span v-if="!friend.is_active" class="friend-badge">⚠️ 可能失效</span>
        </div>
        <div class="friend-desc">{{ friend.description}}</div>
      </div>
    </a>
  </div>
</template>

<style scoped>
.friend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));  /* 自适应列数 */
  gap: 16px;
}
.friend-card {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  text-decoration: none; color: inherit;
}
.friend-card:hover { border-color: #2563eb; }
.friend-inactive { opacity: 0.55; }                     /* 失效友链整体灰暗 */
.friend-badge {
  font-size: 11px; color: #dc2626; background: #fef2f2;
  padding: 1px 6px; border-radius: 999px; margin-left: 6px;
}
.friend-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
.friend-fallback {
  display: flex; align-items: center; justify-content: center;
  background: #e0e7ff; color: #4338ca; font-weight: bold;
}
.friend-name { font-weight: bold; }
.friend-desc { color: #6b7280; font-size: 13px; }
</style>