<!-- AI 伴侣项目展示页（AI 伴侣独立站点已并入小站/退役，此页作为项目案例展示）
     导航栏"AI 伴侣"入口：从"嵌入在线站点"改为"展示项目" -->
<script setup>
import SourceChip from '../components/editorial/SourceChip.vue'

const tags = ['FastAPI', 'MySQL', 'DeepSeek API', 'JWT 鉴权', 'nginx']
const features = [
  '自定义人设：昵称、性格、说话风格随时改',
  '多轮对话：上下文记忆，越聊越懂你',
  '会话管理：历史会话保存，随时找回',
  '账号体系：JWT 登录，数据隔离',
]
</script>

<template>
  <section class="page-col">
    <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">AI 伴侣</h2>
    <p class="mt-3 font-sans text-sm text-foreground/70">
      一个会聊天的 AI 伙伴——自定义人设、记住你们聊过的每句话
    </p>

    <div class="mt-10 pt-6 border-t border-foreground/10">
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-block px-2 py-0.5 border border-foreground/20 font-sans text-xs tracking-[0.15em] text-foreground/70">
          已交付项目
        </span>
        <h3 class="font-serif text-xl md:text-2xl font-normal">AI 智能伴侣</h3>
      </div>

      <p class="mt-4 font-sans text-base leading-8 text-foreground/90 max-w-2xl">
        培训班结业项目：支持自定义人设（昵称/性格/语气），基于 DeepSeek 大模型实现多轮对话，
        会话历史持久化存储，JWT 登录鉴权。独立部署于阿里云，现已并入本站作为功能展示。
      </p>

      <div class="flex flex-wrap gap-2 mt-5">
        <SourceChip v-for="tag in tags" :key="tag" :label="tag" />
      </div>

      <ul class="list-none mt-6 border-t border-foreground/10">
        <li
          v-for="feature in features"
          :key="feature"
          class="py-3 border-b border-foreground/10 font-sans text-sm text-foreground/80"
        >
          {{ feature }}
        </li>
      </ul>
    </div>
  </section>
</template>
