<script setup>
import { ref, onMounted} from "vue"
const projects = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try{
    const res = await fetch('/api/projects')
    projects.value = await res.json()
  }catch (e){
    error.value = '加载失败' + e.message + '后端启动了吗？'
  }finally {
    loading.value = false
  }
})
</script>

<template>
  <h2>项目列表</h2>

  <p v-if="loading">加载中...</p>
  <p v-else-if="error">{{error}}</p>
  <p v-else-if="projects.length == 0">暂无项目</p>

  <div v-else class="project-grid">
    <div v-for="project in projects" :key ="project.id" class="project-card">
      <div class="project-header">
        <span class="project-name">{{ project.name}}</span>
        <span class="project-stars">⭐ {{ project.stars}}</span>
      </div>
      <div class="project-desc">{{ project.description}}</div>
      <div class="project-tags">
        <span v-for="tag in project.tech_tags.split(',')" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <a v-if="project.repo" :href="project.repo" target="_blank" class="project-link">GitHub 仓库 ➡</a>
    </div>
  </div>
</template>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.project-card { padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
.project-header { display: flex; justify-content: space-between; align-items: center; }
.project-name { font-size: 18px; font-weight: bold; }
.project-stars { color: #d97706; }
.project-desc { color: #6b7280; margin: 8px 0; line-height: 1.6; }
.tag {
  display: inline-block; font-size: 12px; color: #2563eb;
  background: #eff6ff; padding: 2px 8px; border-radius: 999px; margin-right: 6px;
}
.project-link { display: inline-block; margin-top: 8px; color: #2563eb; text-decoration: none; }
</style>