// axios 统一封装：以后所有接口请求都走这个文件（管理后台核心）
// 三个作用：
//   1. baseURL='/api' —— 请求写 '/moments' 自动变成 '/api/moments'（走 Vite 代理）
//   2. 请求拦截器 —— 每次发请求自动带上 token（不用每个接口手动加请求头）
//   3. 响应拦截器 —— 统一处理错误：401 自动清 token 跳登录页
import axios from 'axios'

// 创建 axios 实例（带默认配置）
const request = axios.create({
  baseURL: '/api',        // 所有请求自动加 /api 前缀
  timeout: 10000,         // 10 秒超时
})

// ---- 请求拦截器：发请求之前执行 ----
request.interceptors.request.use((config) => {
  // 从 localStorage 拿登录时存的 token
  const token = localStorage.getItem('token')
  if (token) {
    // 自动加上 Authorization 请求头（还记得后端认的 "Bearer xxx" 格式吗？）
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---- 响应拦截器：收到响应之后执行 ----
request.interceptors.response.use(
  // 成功：直接返回 data，调用处不用再写 .data.data
  (res) => res.data,
  // 失败：统一处理
  (err) => {
    // 401 = token 失效/未登录 → 清 token 跳登录页
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    // 其他错误继续抛给调用方（页面里 catch 处理）
    return Promise.reject(err)
  }
)

export default request
