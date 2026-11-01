<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { renderArticleMarkdown } from '../lib/articleMarkdown'
import { apiGet } from '../lib/publicApi'
import StateBlock from '../components/editorial/StateBlock.vue'
import TocList from '../components/editorial/TocList.vue'

const route = useRoute()
const article = ref(null)
const related = ref([])
const loading = ref(true)
const error = ref('')

// 文章正文 HTML：走 DOMPurify 白名单（见 lib/articleMarkdown.js）。
// 用 computed 而不是在模板里直接调函数 —— 内容不变时不会重复解析 Markdown。
const bodyHtml = computed(() => renderArticleMarkdown(article.value?.content || ''))

const contentRef = ref(null)
const toc = ref([])
const activeId = ref('')
const progress = ref(0)
let observer = null
let loadSeq = 0

function buildToc() {
  const root = contentRef.value
  if (!root) return

  // 优先用 Markdown 标题；没有标题时，用顶层有序列表的前几项做“要点”目录
  const headings = [...root.querySelectorAll('h2, h3')]
  if (headings.length) {
    toc.value = headings.map((el, index) => {
      const id = 'section-' + (index + 1)
      el.id = id
      return { id, text: el.textContent.trim(), level: Number(el.tagName.slice(1)) }
    })
  } else {
    const items = [...root.querySelectorAll(':scope > ol > li')]
    toc.value = items.length >= 3
      ? items.slice(0, 8).map((el, index) => {
          const id = 'point-' + (index + 1)
          el.id = id
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
          return { id, text: text.length > 28 ? text.slice(0, 28) + '…' : text, level: 2 }
        })
      : []
  }
  observeHeadings()
}

function observeHeadings() {
  observer?.disconnect()
  if (!contentRef.value || !toc.value.length) return
  observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
    if (visible.length) activeId.value = visible[0].target.id
  }, { rootMargin: '-15% 0px -70% 0px' })
  toc.value.forEach((item) => {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  })
}

function updateProgress() {
  const el = contentRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const top = rect.top + window.scrollY
  const scrollable = rect.height - window.innerHeight
  const raw = scrollable <= 0 ? 0 : ((window.scrollY - top) / scrollable) * 100
  progress.value = Math.min(100, Math.max(0, raw))
}

function onScroll() {
  updateProgress()
}

async function loadArticle(id) {
  const seq = ++loadSeq
  loading.value = true
  error.value = ''
  article.value = null
  related.value = []
  toc.value = []
  activeId.value = ''
  progress.value = 0
  observer?.disconnect()

  try {
    const data = await apiGet(`/api/articles/${id}`)
    if (seq !== loadSeq) return
    article.value = data
  } catch (e) {
    if (seq !== loadSeq) return
    error.value = e.status === 404 ? '文章不存在。' : e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }

  if (seq !== loadSeq || !article.value) return

  await nextTick()
  buildToc()
  updateProgress()

  apiGet(`/api/articles/${id}/related`)
    .then((data) => {
      if (seq === loadSeq) related.value = data || []
    })
    .catch(() => {
      if (seq === loadSeq) related.value = []
    })
}

watch(() => route.params.id, (id) => {
  if (id) loadArticle(id)
})

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  loadArticle(route.params.id)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  observer?.disconnect()
})
</script>

<template>
  <div class="reading-progress" aria-hidden="true">
    <span :style="{ transform: 'scaleX(' + progress / 100 + ')' }"></span>
  </div>

  <div class="page-col">
    <StateBlock v-if="loading" state="loading" message="加载文章…" />
    <StateBlock v-else-if="error" state="error" :message="error" />

    <article v-else-if="article">
      <header class="article-cover">
        <div class="article-cover-inner">
          <h1 class="article-title font-serif font-light tracking-tight text-3xl md:text-5xl leading-[1.15]">
            {{ article.title }}
          </h1>
          <p class="article-meta font-sans text-xs md:text-sm tracking-[0.12em]">
            <span class="folio">NO. {{ String(article.id).padStart(2, '0') }}</span>
            <span class="meta-slash mx-2">/</span>
            {{ article.category }}
            <template v-if="article.tags"> · {{ article.tags }}</template>
            · {{ article.views }} 次浏览 · {{ (article.created_at || '').slice(0, 10) }}
          </p>
          <div
            v-if="article.summary"
            class="article-standfirst font-serif italic text-lg leading-8"
          >
            {{ article.summary }}
          </div>
        </div>
      </header>

      <details v-if="toc.length" class="toc-inline">
        <summary>目录</summary>
        <TocList :items="toc" :active-id="activeId" />
      </details>

      <div class="article-body-layout" :class="{ 'has-toc': toc.length }">
        <div class="article-body">
          <div ref="contentRef" class="prose-editorial mt-10" v-html="bodyHtml"></div>

          <section v-if="related.length" class="mt-14 pt-8 border-t border-foreground/10">
            <h2 class="font-serif text-xl md:text-2xl font-light tracking-tight">相关文章</h2>
            <ul class="list-none mt-3">
              <li v-for="r in related" :key="r.id">
                <router-link
                  :to="'/articles/' + r.id"
                  class="block py-4 border-b border-foreground/10 group"
                >
                  <span class="font-serif text-lg leading-7 group-hover:underline decoration-foreground/40 underline-offset-4">
                    {{ r.title }}
                  </span>
                  <span v-if="r.summary" class="block font-sans text-sm text-foreground/70 mt-1 line-clamp-1">
                    {{ r.summary }}
                  </span>
                </router-link>
              </li>
            </ul>
          </section>

          <div class="mt-14 pt-6 border-t border-foreground/10">
            <router-link
              to="/articles"
              class="font-sans text-sm tracking-[0.15em] border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
            >
              ← 返回文章列表
            </router-link>
          </div>
        </div>

        <aside v-if="toc.length" class="toc-rail" aria-label="文章目录">
          <p class="toc-label">目录</p>
          <TocList :items="toc" :active-id="activeId" />
        </aside>
      </div>
    </article>
  </div>
</template>

<style scoped>
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  z-index: 40;
  pointer-events: none;
}
.reading-progress span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transform-origin: left center;
  transition: transform 0.1s linear;
}

/* 深墨封面带：全宽出血，标题、元信息与导语反白 */
.article-cover {
  margin-inline: calc(50% - 50vw);
  margin-top: -48px;              /* 抵消 App main 的 pt-12，贴住导航下沿 */
  padding: 72px max(24px, calc(50vw - 28rem)) 64px;
  background: var(--color-ink-deep);
  color: var(--color-background);
  border-bottom: 1px solid rgba(212, 163, 115, 0.55);
}
.article-cover-inner {
  max-width: 56rem;
  margin: 0 auto;
}

.article-title { color: var(--color-background); }
.article-meta {
  margin-top: 1.25rem;
  color: rgba(249, 248, 246, 0.7);
}
.meta-slash { color: rgba(249, 248, 246, 0.25); }

/* 刊物页码：真实文章 id，在深墨场上用暖沙 */
.folio {
  font-family: var(--font-serif);
  color: var(--color-primary);
  letter-spacing: 0.08em;
}

/* 导语：顶部细线 + 大引号，像杂志的开口引文 */
.article-standfirst {
  position: relative;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(249, 248, 246, 0.2);
  color: rgba(249, 248, 246, 0.84);
}
.article-standfirst::before {
  content: "“";
  position: absolute;
  left: -1.4rem;
  top: -0.35rem;
  font-family: var(--font-serif);
  font-size: 2.5rem;
  line-height: 1;
  color: var(--color-primary);
}

/* 正文与目录：宽屏时正文左、目录右；窄屏目录折叠在正文上方 */
.article-body-layout { max-width: 56rem; }

.toc-inline {
  display: none;
  margin-top: 2rem;
  padding: 0.75rem 0;
  border-top: 1px solid rgba(28, 28, 28, 0.1);
  border-bottom: 1px solid rgba(28, 28, 28, 0.1);
}
.toc-inline summary {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: rgba(28, 28, 28, 0.7);
  cursor: pointer;
}
.toc-inline :deep(.toc-list) { margin-top: 0.5rem; }

.toc-rail { display: none; }
.toc-label {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: rgba(28, 28, 28, 0.7);
  margin-bottom: 0.6rem;
}

@media (min-width: 1100px) {
  .article-body-layout.has-toc {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 10rem;
    gap: 2rem;
  }
  .article-body-layout.has-toc .toc-rail {
    display: block;
    position: sticky;
    top: 6rem;
    align-self: start;
    border-top: 1px solid rgba(28, 28, 28, 0.1);
    padding-top: 0.75rem;
  }
}

@media (max-width: 1099px) {
  .toc-inline { display: block; }
}

@media (min-width: 768px) {
  .article-cover { margin-top: -64px; }  /* 抵消 App main 的 md:pt-16 */
}
@media (max-width: 767px) {
  .article-cover { padding: 56px 24px 48px; }
  .article-standfirst::before { display: none; }
}
</style>
