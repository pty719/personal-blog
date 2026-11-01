<!-- 登录页：管理后台的"门"，没有登录进不了后台
     新套路：v-model 表单双向绑定 + 事件处理 + localStorage 存 token + 路由跳转 -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '../api/request'   // 用封装的 axios
import AppInput from '../components/editorial/AppInput.vue'
import AppButton from '../components/editorial/AppButton.vue'

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
  <section class="page-col max-w-sm py-10">
    <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">管理后台登录</h2>

    <form class="mt-8" @submit.prevent="handleLogin">
      <p
        v-if="error"
        class="mb-5 font-sans text-sm text-foreground border-l border-foreground/30 pl-4"
        role="alert"
      >
        {{ error }}
      </p>

      <AppInput
        id="login-username"
        v-model="username"
        label="用户名"
        autocomplete="username"
      />
      <AppInput
        id="login-password"
        v-model="password"
        label="密码"
        type="password"
        autocomplete="current-password"
      />

      <AppButton type="submit" :disabled="loading" class="w-full">
        {{ loading ? '登录中…' : '登 录' }}
      </AppButton>
    </form>
  </section>
</template>
