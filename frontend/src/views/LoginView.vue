<!-- 登录页：管理后台的"门"，没有登录进不了后台
     新套路：v-model 表单双向绑定 + 事件处理 + localStorage 存 token + 路由跳转 -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '../api/request'   // 用封装的 axios

const router = useRouter()
const username = ref('')    // v-model 绑定输入框
const password = ref('')
const error = ref('')       // 错误提示
const loading = ref(false)  // 登录中禁用按钮

async function handleLogin() {
  // 简单校验：空输入直接提示，不发请求
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    // 登录接口不需要 token（拦截器自动判断，没 token 就不带头）
    const data = await request.post('/auth/login', {
      username: username.value,
      password: password.value,
    })
    // 登录成功：token 存 localStorage（浏览器持久存储，刷新页面不丢）
    localStorage.setItem('token', data.access_token)
    router.push('/admin')   // 跳转管理后台
  } catch (e) {
    // 后端返回的错误信息在 e.response.data.detail（FastAPI 风格）
    error.value = '登录失败：' + (e.response?.data?.detail || e.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-box">
    <h2>管理后台登录</h2>
    <p v-if="error" class="error">{{ error }}</p>

    <!-- v-model：输入框 <-> ref 变量 双向绑定（输入即改值） -->
    <input v-model="username" type="text" placeholder="用户名" class="input" />
    <input v-model="password" type="password" placeholder="密码" class="input"
           @keyup.enter="handleLogin" />   <!-- 回车也能登录 -->

    <button @click="handleLogin" :disabled="loading" class="btn">
      {{ loading ? '登录中...' : '登 录' }}
    </button>
    <p class="tip">测试账号：admin / admin123</p>
  </div>
</template>

<style scoped>
.login-box {
  max-width: 320px; margin: 80px auto;
  background: #fff; padding: 32px;
  border-radius: 12px; border: 1px solid #e5e7eb;
}
.input {
  width: 100%; padding: 10px 12px; margin-bottom: 12px;
  border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box;
}
.btn {
  width: 100%; padding: 10px; background: #2563eb; color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
}
.btn:disabled { opacity: 0.6; }
.error { color: #dc2626; margin-bottom: 12px; font-size: 14px; }
.tip { color: #9ca3af; font-size: 12px; margin-top: 12px; text-align: center; }
</style>
