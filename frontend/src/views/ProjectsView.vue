<script setup>
import { onMounted, ref } from 'vue'
import { apiGet } from '../lib/publicApi'
import SectionHeader from '../components/editorial/SectionHeader.vue'
import StateBlock from '../components/editorial/StateBlock.vue'
import ProjectRow from '../components/editorial/ProjectRow.vue'

const projects = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    projects.value = await apiGet('/api/projects')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section>
    <SectionHeader title="项目列表" />

    <StateBlock
      v-if="loading || error || projects.length === 0"
      :state="loading ? 'loading' : error ? 'error' : 'empty'"
      :message="error || '暂无项目'"
    />

    <div v-else class="mt-2">
      <ProjectRow v-for="project in projects" :key="project.id" :project="project" />
    </div>
  </section>
</template>
