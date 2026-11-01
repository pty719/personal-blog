<!-- 首页组件 v3：门户页
     结构：博主介绍（hero）→ AI 助手大入口 → 最新文章 / 最新说说 / AI 新闻速递
     数据：全部来自后端公开接口；文章/说说直接请求 3 条，避免拉全量再截断
     容错：任一接口挂了不影响其他区块（各自状态） -->
<script setup>
import { onMounted, ref } from 'vue'
import { apiGet } from '../lib/publicApi'
import SectionHeader from '../components/editorial/SectionHeader.vue'
import ArticleRow from '../components/editorial/ArticleRow.vue'
import ProjectRow from '../components/editorial/ProjectRow.vue'
import StateBlock from '../components/editorial/StateBlock.vue'
import SourceChip from '../components/editorial/SourceChip.vue'

const articles = ref([])
const moments = ref([])
const aiNews = ref([])
const projects = ref([])

const articlesState = ref('loading')
const momentsState = ref('loading')
const newsState = ref('loading')
const projectsState = ref('loading')

const articlesError = ref('')
const momentsError = ref('')
const newsError = ref('')
const projectsError = ref('')

async function loadList(url, target, state, errorRef, limit = 3) {
  try {
    const data = await apiGet(url)
    target.value = (data.items || []).slice(0, limit)
    state.value = target.value.length ? 'ready' : 'empty'
  } catch (e) {
    errorRef.value = e.message
    state.value = 'error'
  }
}

// 项目接口返回纯数组（不是 {items}），首页只取前 2 个
async function loadProjects() {
  try {
    const data = await apiGet('/api/projects')
    projects.value = (data || []).slice(0, 2)
    projectsState.value = projects.value.length ? 'ready' : 'empty'
  } catch (e) {
    projectsError.value = e.message
    projectsState.value = 'error'
  }
}

onMounted(() => {
  loadList('/api/articles?page=1&page_size=3', articles, articlesState, articlesError)
  loadList('/api/moments?page=1&page_size=3', moments, momentsState, momentsError)
  loadList('/api/ai-news', aiNews, newsState, newsError)
  loadProjects()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 md:px-12">
    <!-- ========== 博主介绍（深墨封面带）========== -->
    <section class="hero-cover">
      <span class="hero-mark" aria-hidden="true">Y</span>
      <div class="hero-inner">
        <p class="hero-kicker font-sans text-xs md:text-sm tracking-[0.25em]">你好，我是</p>
        <h1 class="hero-title font-serif font-light tracking-tight text-5xl md:text-6xl leading-[1.05] mt-4">
          yizhiyu
        </h1>
        <p class="hero-copy font-sans text-base md:text-lg max-w-xl mt-6 leading-8">
          智能体应用开发者（求职中）—— 用 Python 构建会思考、能检索、懂记忆的 AI 应用。
          这个站点的 AI 助手能调用站内工具、RAG 检索知识库、记住对话上下文。
        </p>
        <div class="mt-10 flex flex-wrap items-center gap-6">
          <router-link
            to="/ai-assistant"
            class="hero-cta font-sans text-sm tracking-[0.15em]"
          >
            和 AI 助手聊聊 →
          </router-link>
          <router-link
            to="/articles"
            class="hero-link font-sans text-sm tracking-[0.15em]"
          >
            阅读文章
          </router-link>
        </div>
      </div>
    </section>

    <!-- ========== 项目（招聘方最先想看的能力证明）========== -->
    <section class="py-14 md:py-16 border-b border-foreground/10">
      <SectionHeader title="项目" to="/projects" />
      <StateBlock
        v-if="projectsState !== 'ready'"
        :state="projectsState"
        :message="projectsError || '暂无项目'"
      />
      <div v-else class="mt-2">
        <ProjectRow v-for="p in projects" :key="p.id" :project="p" />
      </div>
    </section>

    <!-- ========== 最新文章 ========== -->
    <section class="py-14 md:py-16 border-b border-foreground/10">
      <SectionHeader title="最新文章" to="/articles" />
      <StateBlock
        v-if="articlesState !== 'ready'"
        :state="articlesState"
        :message="articlesError || '暂无文章'"
      />
      <div v-else class="mt-2">
        <ArticleRow
          v-for="a in articles"
          :key="a.id"
          :to="'/articles/' + a.id"
          :title="a.title"
          :summary="a.summary"
          :meta="(a.created_at || '').slice(0, 10)"
        />
      </div>
    </section>

    <!-- ========== 最新说说 ========== -->
    <section class="py-14 md:py-16 border-b border-foreground/10">
      <SectionHeader title="最新说说" to="/moments" />
      <StateBlock
        v-if="momentsState !== 'ready'"
        :state="momentsState"
        :message="momentsError || '暂无说说'"
      />
      <div v-else class="mt-2">
        <div
          v-for="m in moments"
          :key="m.id"
          class="border-l-2 border-foreground/10 pl-5 md:pl-8 py-6"
        >
          <p class="font-sans text-sm md:text-base leading-7 text-foreground/90 whitespace-pre-wrap">
            {{ m.content }}
          </p>
          <p class="font-sans text-xs text-foreground/70 mt-2">
            {{ (m.created_at || '').slice(0, 10) }}
          </p>
        </div>
      </div>
    </section>

    <!-- ========== AI 新闻速递 ========== -->
    <section class="py-14 md:py-16">
      <SectionHeader title="AI 新闻速递" to="/ai-news" />
      <p class="font-sans text-sm text-foreground/70 mt-3">
        自动采集的 AI 领域最新资讯（每 6 小时更新）
      </p>
      <StateBlock
        v-if="newsState !== 'ready'"
        :state="newsState"
        :message="newsError || 'AI 新闻采集即将上线…'"
      />
      <div v-else class="mt-2 border-t border-foreground/10">
        <a
          v-for="n in aiNews"
          :key="n.id"
          :href="n.url"
          target="_blank"
          rel="noopener noreferrer"
          class="block py-6 border-b border-foreground/10 group"
        >
          <div class="flex items-baseline gap-3">
            <h3 class="font-serif text-lg leading-7 group-hover:underline decoration-foreground/40 underline-offset-4">
              {{ n.title }}
            </h3>
            <SourceChip :label="n.source" class="shrink-0" />
          </div>
          <p v-if="n.summary" class="font-sans text-sm text-foreground/70 leading-6 mt-1 line-clamp-2">
            {{ n.summary }}
          </p>
          <p class="font-sans text-xs text-foreground/70 mt-2">
            {{ (n.published_at || '').slice(0, 10) }}
          </p>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 深墨封面带：全宽出血，内容仍对齐 56rem 阅读列 */
.hero-cover {
  position: relative;
  overflow: hidden;
  margin-inline: calc(50% - 50vw);
  margin-top: -48px;              /* 抵消 App main 的 pt-12，贴住导航下沿 */
  padding: 88px max(24px, calc(50vw - 28rem)) 96px;
  background: var(--color-ink-deep);
  color: var(--color-background);
  border-bottom: 1px solid rgba(212, 163, 115, 0.55);
}

.hero-inner {
  position: relative;
  z-index: 10;
  max-width: 56rem;
  margin: 0 auto;
}

.hero-kicker { color: rgba(249, 248, 246, 0.7); }
.hero-title { color: var(--color-background); }
.hero-copy { color: rgba(249, 248, 246, 0.84); }

.hero-cta {
  display: inline-block;
  padding: 12px 24px;
  border: 1px solid rgba(249, 248, 246, 0.8);
  color: var(--color-background);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.hero-cta:hover {
  background: var(--color-background);
  color: var(--color-ink-deep);
}

.hero-link {
  color: rgba(249, 248, 246, 0.84);
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(249, 248, 246, 0.35);
  transition: border-color 0.15s ease, color 0.15s ease;
}
.hero-link:hover {
  color: var(--color-background);
  border-color: var(--color-background);
}

/* 超大字：深墨场上的暖沙水印，不承载信息 */
.hero-mark {
  position: absolute;
  top: -0.32em;
  right: -0.06em;
  z-index: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 300;
  font-size: clamp(16rem, 32vw, 30rem);
  line-height: 0.8;
  color: var(--color-primary);
  opacity: 0.22;
  pointer-events: none;
  user-select: none;
}

@media (min-width: 768px) {
  .hero-cover { margin-top: -64px; }  /* 抵消 App main 的 md:pt-16 */
}
@media (max-width: 767px) {
  .hero-cover { padding: 64px 24px 72px; }
  .hero-mark { top: -0.16em; font-size: 14rem; opacity: 0.18; }
}
</style>
