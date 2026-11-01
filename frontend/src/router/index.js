// 路由配置：URL 地址 -> 页面组件的对应表（第 4 个读）
// 阅读顺序：main.js -> App.vue -> 本文件 -> views/
import { createRouter, createWebHistory } from 'vue-router'

// 路由表：全部视图按需加载，首屏不再打包所有页面（marked 只进文章详情 chunk）
const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: '首页' } },
  { path: '/articles', name: 'article', component: () => import('../views/ArticlesView.vue'), meta: { title: '文章' } },
  { path: '/articles/:id', name: 'article-detail', component: () => import('../views/ArticleDetailView.vue'), meta: { title: '文章' } },
  { path: '/moments', name: 'moment', component: () => import('../views/MomentsView.vue'), meta: { title: '说说' } },
  { path: '/friends', name: 'friend', component: () => import('../views/FriendsView.vue'), meta: { title: '友链' } },
  { path: '/projects', name: 'project', component: () => import('../views/ProjectsView.vue'), meta: { title: '项目' } },
  { path: '/ai-partner', name: 'ai-partner', component: () => import('../views/AiPartnerView.vue'), meta: { title: 'AI 伴侣' } },
  { path: '/ai-assistant', name: 'ai-assistant', component: () => import('../views/AssistantView.vue'), meta: { title: 'AI 助手' } },
  { path: '/ai-news', name: 'AiNews', component: () => import('../views/AiNewsView.vue'), meta: { title: 'AI 新闻' } },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { title: '管理后台' } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: '登录' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: '页面不存在' } },
]

// createWebHistory：使用浏览器 History 模式（URL 干净，没有 # 号）
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (to.path.startsWith('/admin') && !token) {
    return next('/login')  // 注意：要用 next()，不是 return
  }

  if (to.path === '/login' && token) {
    return next('/admin')
  }

  next()  // 正常放行
})

router.afterEach((to) => {
  const page = to.meta.title
  document.title = page ? `${page} · yizhiyu的小站` : 'yizhiyu的小站'
})

export default router
