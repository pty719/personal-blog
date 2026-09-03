// 路由配置：URL 地址 -> 页面组件的对应表（第 4 个读）
// 阅读顺序：main.js -> App.vue -> 本文件 -> views/
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ArticlesView from "../views/ArticlesView.vue"
import ArticleDetailView from "../views/ArticleDetailView.vue"
import MomentsView from "../views/MomentsView.vue";
import ProjectsView from "../views/ProjectsView.vue";
import FriendsView from "../views/FriendsView.vue";
import AdminView from "../views/AdminView.vue";
import LoginView from "../views/LoginView.vue";
import AiPartnerView from "../views/AiPartnerView.vue";
import AssistantView from "../views/AssistantView.vue";

// 路由表：加新页面就在这里加一行
const routes = [
  { path: '/', name: 'home', component: HomeView },        // /        -> 首页
  {path: '/articles', name: 'article', component: ArticlesView},
  {path: '/articles/:id', name: 'article-detail', component: ArticleDetailView},
  {path: '/moments', name: 'moment', component: MomentsView},
  {path: '/friends', name: 'friend', component: FriendsView},
  {path: '/projects', name: 'project', component: ProjectsView},
  {path: '/ai-partner', name: 'ai-partner', component: AiPartnerView},   // AI 伴侣展示页
  {path: '/ai-assistant', name: 'ai-assistant', component: AssistantView},   // AI 助手
  {path: '/admin', name: 'admin', component: AdminView},
  {path: '/login', name: 'login', component: LoginView}
  // Week 2 陆续加：文章列表 / 文章详情 / 说说 / 友链 / 项目 / 关于 / 管理后台
]

// createWebHistory：使用浏览器 History 模式（URL 干净，没有 # 号）
const router = createRouter({
  history: createWebHistory(),
  routes,
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
export default router
