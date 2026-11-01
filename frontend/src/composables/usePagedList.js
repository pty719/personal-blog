import { ref, computed, onMounted } from 'vue'
import { apiGet } from '../lib/publicApi'

// 分页列表：page / pageSize / total / loading / error，并处理请求竞态。
export function usePagedList(path, { pageSize = 10, params = () => ({}) } = {}) {
  const items = ref([])
  const page = ref(1)
  const total = ref(0)
  const loading = ref(true)
  const error = ref('')
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  let sequence = 0

  async function load() {
    const current = ++sequence
    loading.value = true
    error.value = ''
    try {
      const query = new URLSearchParams({
        page: String(page.value),
        page_size: String(pageSize),
        ...params(),
      })
      const data = await apiGet(`${path}?${query.toString()}`)
      if (current !== sequence) return
      items.value = data.items || []
      total.value = data.total || 0
    } catch (e) {
      if (current !== sequence) return
      error.value = e.message || '加载失败'
      items.value = []
      total.value = 0
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  function goTo(target) {
    if (target < 1 || target > totalPages.value || target === page.value) return
    page.value = target
    load()
  }

  onMounted(load)

  return { items, page, total, totalPages, loading, error, load, goTo }
}
