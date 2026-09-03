<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../api/request'

const router = useRouter()

// =====================================================================
// 通用模式：每个资源 = 一组表单字段 + 一个列表 + 增删函数
// 文章 / 说说 / 友链 / 项目 都是同一套套路，只是字段不同
// =====================================================================

// ---------- 发布文章 ----------
const title = ref('')
const category = ref('默认')
const content = ref('')
const msg = ref('')           // 文章区反馈
const submitting = ref(false)
const articles = ref([])

async function publishArticle() {
  if (!title.value.trim() || !content.value.trim()) {
    msg.value = '标题和正文不能为空'
    return
  }
  submitting.value = true
  msg.value = ''
  try {
    const res = await request.post('/articles', {
      title: title.value, content: content.value, category: category.value || '默认',
    })
    msg.value = '✅ 发布成功，摘要：' + (res.summary || '（未生成）')
    title.value = ''
    content.value = ''
    fetchArticles()
  } catch (e) {
    msg.value = '发布失败：' + (e.response?.data?.detail || e.message)
  } finally {
    submitting.value = false
  }
}

// ---------- 文章列表：搜索 + 分页 + 批量删除 ----------
const keyword = ref('')          // 搜索关键词
const page = ref(1)              // 当前页
const pageSize = 10              // 每页条数（和后端默认一致）
const total = ref(0)             // 总条数（后端返回）
const selectedIds = ref([])      // 批量删除选中的 id 数组

// 计算属性：总页数（total=23, pageSize=10 → 3 页）
const totalPages = computed(() => Math.ceil(total.value / pageSize))

async function fetchArticles() {
  // 用 params 传参（axios 自动拼 ?page=1&page_size=10&keyword=xxx）
  const data = await request.get('/articles', {
    params: { page: page.value, page_size: pageSize, keyword: keyword.value },
  })
  articles.value = data.items
  total.value = data.total
  // 当前页被删空且不是第一页 → 回退一页（比如删光第 3 页最后一条）
  if (articles.value.length === 0 && page.value > 1) {
    page.value -= 1
    fetchArticles()
  }
}

function searchArticles() {
  page.value = 1      // 搜索永远从第一页开始看结果
  fetchArticles()
}

function changePage(p) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchArticles()
}

// 全选框：选中/取消当前页所有文章
function toggleAll(e) {
  selectedIds.value = e.target.checked ? articles.value.map(a => a.id) : []
}

// 单选框：加入/移出选中数组
function toggleOne(id) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

// 批量删除：二次确认后逐条删，再刷新
async function batchDelete() {
  if (selectedIds.value.length === 0) {
    msg.value = '请先勾选要删除的文章'
    return
  }
  if (!confirm(`确定删除选中的 ${selectedIds.value.length} 篇文章？`)) return
  try {
    for (const id of selectedIds.value) {
      await request.delete('/articles/' + id)
    }
    msg.value = `✅ 已删除 ${selectedIds.value.length} 篇`
    selectedIds.value = []
    fetchArticles()
  } catch (e) {
    msg.value = '删除失败：' + (e.response?.data?.detail || e.message)
  }
}

async function delArticle(id) {
  if (!confirm('确定删除这篇文章？')) return
  try {
    await request.delete('/articles/' + id)
    msg.value = '✅ 文章已删除'
    fetchArticles()
  } catch (e) {
    msg.value = '删除失败：' + (e.response?.data?.detail || e.message)
  }
}

// ---------- 发布说说 ----------
const momentContent = ref('')
const momentImages = ref('')   // 说说配图 URL（可选，多张用英文逗号分隔）
const momentMsg = ref('')     // 说说区反馈
const moments = ref([])

async function publishMoment() {
  if (!momentContent.value.trim()) {
    momentMsg.value = '说说内容不能为空'
    return
  }
  momentMsg.value = ''
  try {
    await request.post('/moments', {
      content: momentContent.value,
      images: momentImages.value.trim(),   // 空字符串 = 纯文字说说
    })
    momentMsg.value = '✅ 发布成功'
    momentContent.value = ''
    momentImages.value = ''
    fetchMoments()
  } catch (e) {
    momentMsg.value = '发布失败：' + (e.response?.data?.detail || e.message)
  }
}

async function fetchMoments() {
  const data = await request.get('/moments?page=1&page_size=10')
  moments.value = data.items   // moments 返回 {total, items}
}

async function delMoment(id) {
  if (!confirm('确定删除这条说说？')) return
  try {
    await request.delete('/moments/' + id)
    momentMsg.value = '✅ 已删除'
    fetchMoments()
  } catch (e) {
    momentMsg.value = '删除失败：' + (e.response?.data?.detail || e.message)
  }
}

// ---------- 新增友链 ----------
const friendName = ref('')
const friendUrl = ref('')
const friendDesc = ref('')
const friendMsg = ref('')
const friends = ref([])

async function addFriend() {
  if (!friendName.value.trim() || !friendUrl.value.trim()) {
    friendMsg.value = '友链名称和网址必填'
    return
  }
  friendMsg.value = ''
  try {
    await request.post('/friends', {
      name: friendName.value, url: friendUrl.value, description: friendDesc.value,
    })
    friendMsg.value = '✅ 添加成功'
    friendName.value = ''
    friendUrl.value = ''
    friendDesc.value = ''
    fetchFriends()
  } catch (e) {
    friendMsg.value = '添加失败：' + (e.response?.data?.detail || e.message)
  }
}

async function fetchFriends() {
  friends.value = await request.get('/friends')   // friends 返回纯数组！
}

async function delFriend(id) {
  if (!confirm('确定删除这个友链？')) return
  try {
    await request.delete('/friends/' + id)
    friendMsg.value = '✅ 已删除'
    fetchFriends()
  } catch (e) {
    friendMsg.value = '删除失败：' + (e.response?.data?.detail || e.message)
  }
}

// ---------- 新增项目 ----------
const projName = ref('')
const projDesc = ref('')
const projRepo = ref('')
const projStars = ref(0)
const projTags = ref('')
const projMsg = ref('')
const projects = ref([])

async function addProject() {
  if (!projName.value.trim()) {
    projMsg.value = '项目名称必填'
    return
  }
  projMsg.value = ''
  try {
    await request.post('/projects', {
      name: projName.value,
      description: projDesc.value,
      repo: projRepo.value,
      stars: Number(projStars.value) || 0,
      tech_tags: projTags.value,
    })
    projMsg.value = '✅ 添加成功'
    projName.value = ''
    projDesc.value = ''
    projRepo.value = ''
    projStars.value = 0
    projTags.value = ''
    fetchProjects()
  } catch (e) {
    projMsg.value = '添加失败：' + (e.response?.data?.detail || e.message)
  }
}

async function fetchProjects() {
  projects.value = await request.get('/projects')   // projects 返回纯数组！
}

async function delProject(id) {
  if (!confirm('确定删除这个项目？')) return
  try {
    await request.delete('/projects/' + id)
    projMsg.value = '✅ 已删除'
    fetchProjects()
  } catch (e) {
    projMsg.value = '删除失败：' + (e.response?.data?.detail || e.message)
  }
}

// ---------- 页面加载：拉全部列表 ----------
onMounted(() => {
  fetchArticles()
  fetchMoments()
  fetchFriends()
  fetchProjects()
})

// ---------- 退出登录 ----------
function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}
</script>

<template>
  <div class="admin">
    <!-- 顶栏 -->
    <div class="admin-header">
      <h2>管理后台</h2>
      <button @click="logout" class="btn-danger">退出登录</button>
    </div>

    <!-- ══════════ 文章管理 ══════════ -->
    <section class="card">
      <h3>发布文章</h3>
      <p v-if="msg" :class="msg.startsWith('✅') ? 'ok' : 'err'">{{ msg }}</p>
      <form @submit.prevent="publishArticle">
        <input v-model="title" type="text" placeholder="文章标题" class="input" />
        <input v-model="category" type="text" placeholder="分类（默认'默认'）" class="input" />
        <textarea v-model="content" placeholder="正文（支持 Markdown）" class="textarea"></textarea>
        <button type="submit" :disabled="submitting" class="btn-primary">
          {{ submitting ? '发布中...' : '发布文章' }}
        </button>
      </form>
    </section>

    <section class="card">
      <h3>文章管理（共 {{ total }} 篇）</h3>

      <!-- 工具栏：搜索框 + 搜索按钮 + 批量删除 -->
      <div class="toolbar">
        <input v-model="keyword" type="text" placeholder="按标题搜索..."
               class="input search-input" @keyup.enter="searchArticles" />
        <button @click="searchArticles" class="btn-primary btn-sm">搜索</button>
        <button @click="batchDelete" class="btn-del">
          批量删除{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
      </div>
      <p v-if="msg" :class="msg.startsWith('✅') ? 'ok' : 'err'">{{ msg }}</p>

      <p v-if="articles.length === 0" class="empty">暂无文章</p>
      <ul v-else class="list">
        <li v-for="article in articles" :key="article.id" class="row">
          <!-- 复选框：checked 由 selectedIds 决定，change 时加入/移出 -->
          <input type="checkbox" class="checkbox"
                 :checked="selectedIds.includes(article.id)"
                 @change="toggleOne(article.id)" />
          <div class="row-main">
            <div class="row-title">{{ article.title }}</div>
            <div class="row-summary" v-if="article.summary">{{ article.summary }}</div>
            <div class="row-meta">{{ article.category }} · {{ article.created_at.slice(0, 10) }}</div>
          </div>
          <button @click="delArticle(article.id)" class="btn-del">删除</button>
        </li>
      </ul>

      <!-- 表头行：全选 + 当前页信息 -->
      <div v-if="articles.length" class="list-footer">
        <label class="check-all">
          <input type="checkbox" class="checkbox"
                 :checked="articles.length > 0 && articles.every(a => selectedIds.includes(a.id))"
                 @change="toggleAll" /> 全选当前页
        </label>
        <span class="page-info">第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条</span>
      </div>

      <!-- 原生分页组件：上一页 / 页码 / 下一页 -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" @click="changePage(page - 1)" :disabled="page <= 1">上一页</button>
        <button v-for="p in totalPages" :key="p" class="page-btn"
                :class="{ active: p === page }" @click="changePage(p)">{{ p }}</button>
        <button class="page-btn" @click="changePage(page + 1)" :disabled="page >= totalPages">下一页</button>
      </div>
    </section>

    <!-- ══════════ 说说管理 ══════════ -->
    <section class="card">
      <h3>发布说说</h3>
      <p v-if="momentMsg" :class="momentMsg.startsWith('✅') ? 'ok' : 'err'">{{ momentMsg }}</p>
      <form @submit.prevent="publishMoment">
        <input v-model="momentContent" type="text" placeholder="说点什么..." class="input" />
        <input v-model="momentImages" type="text" placeholder="图片 URL（可选，多张用英文逗号分隔）" class="input" />
        <button type="submit" class="btn-primary">发布说说</button>
      </form>
    </section>

    <section class="card">
      <h3>说说管理（{{ moments.length }} 条）</h3>
      <p v-if="moments.length === 0" class="empty">暂无说说</p>
      <ul v-else class="list">
        <li v-for="moment in moments" :key="moment.id" class="row">
          <div>
            <div class="row-title">{{ moment.content }}</div>
            <div class="row-meta">{{ moment.created_at.slice(0, 10) }}</div>
          </div>
          <button @click="delMoment(moment.id)" class="btn-del">删除</button>
        </li>
      </ul>
    </section>

    <!-- ══════════ 友链管理 ══════════ -->
    <section class="card">
      <h3>新增友链</h3>
      <p v-if="friendMsg" :class="friendMsg.startsWith('✅') ? 'ok' : 'err'">{{ friendMsg }}</p>
      <form @submit.prevent="addFriend">
        <input v-model="friendName" type="text" placeholder="友链名称（必填）" class="input" />
        <input v-model="friendUrl" type="text" placeholder="网址（必填，https://...）" class="input" />
        <input v-model="friendDesc" type="text" placeholder="一句话介绍" class="input" />
        <button type="submit" class="btn-primary">添加友链</button>
      </form>
    </section>

    <section class="card">
      <h3>友链管理（{{ friends.length }} 个）</h3>
      <p v-if="friends.length === 0" class="empty">暂无友链</p>
      <ul v-else class="list">
        <li v-for="friend in friends" :key="friend.id" class="row">
          <div>
            <div class="row-title">{{ friend.name }}</div>
            <div class="row-meta">{{ friend.url }} · {{ friend.description }}</div>
          </div>
          <button @click="delFriend(friend.id)" class="btn-del">删除</button>
        </li>
      </ul>
    </section>

    <!-- ══════════ 项目管理 ══════════ -->
    <section class="card">
      <h3>新增项目</h3>
      <p v-if="projMsg" :class="projMsg.startsWith('✅') ? 'ok' : 'err'">{{ projMsg }}</p>
      <form @submit.prevent="addProject">
        <input v-model="projName" type="text" placeholder="项目名称（必填）" class="input" />
        <input v-model="projDesc" type="text" placeholder="简介" class="input" />
        <input v-model="projRepo" type="text" placeholder="GitHub 仓库地址" class="input" />
        <input v-model="projStars" type="number" placeholder="star 数" class="input" />
        <input v-model="projTags" type="text" placeholder="技术标签（逗号分隔）" class="input" />
        <button type="submit" class="btn-primary">添加项目</button>
      </form>
    </section>

    <section class="card">
      <h3>项目管理（{{ projects.length }} 个）</h3>
      <p v-if="projects.length === 0" class="empty">暂无项目</p>
      <ul v-else class="list">
        <li v-for="project in projects" :key="project.id" class="row">
          <div>
            <div class="row-title">{{ project.name }} <span class="stars">⭐{{ project.stars }}</span></div>
            <div class="row-meta">{{ project.description }} · {{ project.tech_tags }}</div>
          </div>
          <button @click="delProject(project.id)" class="btn-del">删除</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.admin { max-width: 720px; margin: 0 auto; }
.admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
.card h3 { margin-bottom: 16px; }
.input {
  width: 100%; padding: 10px 12px; margin-bottom: 12px;
  border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box;
}
.textarea {
  width: 100%; min-height: 160px; padding: 10px 12px; margin-bottom: 12px;
  border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box;
  font-family: inherit; resize: vertical;
}
.btn-primary {
  padding: 10px 24px; background: #2563eb; color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
}
.btn-primary:disabled { opacity: 0.6; }
.btn-danger {
  padding: 8px 16px; background: #dc2626; color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
}
.btn-del {
  padding: 6px 14px; background: #fee2e2; color: #dc2626;
  border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 13px;
}
.btn-del:hover { background: #fecaca; }
.ok { color: #16a34a; margin-bottom: 12px; }
.err { color: #dc2626; margin-bottom: 12px; }
.empty { color: #9ca3af; }
.list { list-style: none; }
.row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 0; border-bottom: 1px solid #f3f4f6;
}
.row-title { font-weight: 600; }
.row-summary { color: #6b7280; font-size: 13px; margin: 4px 0; }
.row-meta { color: #9ca3af; font-size: 13px; margin-top: 2px; }
.stars { color: #d97706; font-size: 13px; }

/* ===== 搜索/批量删除工具栏 ===== */
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.search-input { margin-bottom: 0; flex: 1; }
.btn-sm { padding: 8px 16px; font-size: 14px; }

/* ===== 复选框 + 行布局 ===== */
.checkbox { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
.row-main { flex: 1; margin-left: 10px; }

/* ===== 列表底部（全选 + 页信息） ===== */
.list-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 12px; color: #6b7280; font-size: 13px;
}
.check-all { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.page-info { color: #9ca3af; }

/* ===== 原生分页 ===== */
.pagination { display: flex; gap: 6px; margin-top: 16px; justify-content: center; }
.page-btn {
  padding: 6px 12px; border: 1px solid #d1d5db; background: #fff;
  border-radius: 6px; cursor: pointer; font-size: 14px; color: #374151;
}
.page-btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; }
.page-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
