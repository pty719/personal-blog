# 第三阶段学习记录：管理后台表单 CRUD

> 项目：D:\blog_project\frontend ｜ 技术：Vue3 + axios + FastAPI 写接口
> 记录周期：Week 2 后期 ｜ 状态：✅ 完成（验证 6/6 + build 通过）

---

## 1. 本阶段做了什么

| 能力 | 之前 | 现在 |
|---|---|---|
| 数据操作 | 只读（列表/详情） | **写**：发布文章、删除文章 |
| 前端交互 | 展示 | **表单提交 + 操作反馈 + 删除确认** |
| 后台功能 | 占位页 | 发布文章 + 文章管理列表 |

**一句话：管理后台 = 表单（POST）+ 列表（GET）+ 删除（DELETE）三件套。**

---

## 2. 核心知识模块

### 2.1 表单提交流程（标准姿势）

```vue
<form @submit.prevent="publishArticle">
  <input v-model="title" />
  <textarea v-model="content"></textarea>
  <button type="submit">发布</button>
</form>
```

```js
async function publishArticle() {
  if (!title.value.trim()) return        // ① 校验
  submitting.value = true                // ② 防连点
  try {
    await request.post('/articles', {    // ③ 发请求（自动带 token）
      title: title.value, content: content.value,
    })
    msg.value = '✅ 发布成功'             // ④ 成功反馈
    title.value = ''                     // ⑤ 清空表单
    fetchList()                          // ⑥ 刷新列表
  } catch (e) {
    msg.value = '失败：' + (e.response?.data?.detail || e.message)  // ⑦ 错误反馈
  } finally {
    submitting.value = false
  }
}
```

**标准流程七步：校验 → 防连点 → 请求 → 成功反馈 → 清空 → 刷新 → 错误处理。** 所有"提交"功能都是这个骨架。

### 2.2 写操作的 axios 调用

```js
request.post('/articles', { ... })       // 创建（后端 201）
request.delete('/articles/' + id)        // 删除（后端 204）
```

对比 fetch：**拦截器自动带 token + 自动返回 data**——前端不用管鉴权，这就是封装的价值。

### 2.3 删除确认

```js
async function del(id) {
  if (!confirm('确定删除？')) return   // 浏览器原生确认框；取消直接退出
  await request.delete('/articles/' + id)
  fetchList()                          // 删完刷新
}
```

### 2.4 操作后刷新（CRUD 闭环的关键）

```js
async function fetchList() {           // 拉列表抽成函数
  const data = await request.get('/articles?page=1&page_size=10')
  articles.value = data.items
}
onMounted(fetchList)                   // 进页面加载一次
// 增/删成功后都调 fetchList() —— 数据和页面永远同步
```

---

## 3. 踩坑记录（本阶段你亲手踩的 4 个）

| # | 坑 | 症状 | 正确写法 | 教训 |
|---|---|---|---|---|
| 1 | `(await request.get(...).items)` | 列表 undefined | `(await request.get(...)).items` | **先 await 完再取属性**，括号位置错 = 拿 Promise 的属性 |
| 2 | `onMounted(fetchList())` | 列表不加载 | `onMounted(fetchList)` | **传"函数本身"，不是"调用结果"**——加括号=立即执行返回 Promise |
| 3 | `:key="article"` | 警告/更新错乱 | `:key="article.id"` | key 必须是唯一 id |
| 4 | `article.create_at` | 显示 undefined | `article.created_at` | 字段名拼错——**以前端实际收到的为准（Network 里看）** |

**#1 #2 是 JS 新手高频坑，一定要记牢。**

---

## 4. 和智能体开发的关系（本阶段为什么值得学）

管理后台的 CRUD 不是"普通网站功能"，它是 **Agent 工具（Tool）的基础设施**：

```
管理后台（人操作）          Agent 工具（模型操作）
POST /articles 发文章  ←→  create_article(工具函数，LLM 调用)
GET  /articles 列表   ←→  list_articles(工具)
DELETE /articles/{id} ←→  delete_article(工具)

同一个 API，两种"调用者"：人通过表单点按钮，Agent 通过 Function Calling 调工具
```

**面试可以这么讲**："我的博客管理后台验证了完整的 CRUD 链路，这套接口就是以后 Agent 工具层的骨架——把 `request.post('/articles')` 包成函数注册给 LLM，就是写文章的 Agent 工具。"

**另外**：管理后台本质是"带鉴权的数据操作界面"，而 Agent 的很多任务（查数据、写数据、调外部服务）底层都是这类 API——**API 设计能力 = Agent 工具设计能力**。

---

## 5. 面试速记

| 问题 | 回答 |
|---|---|
| 表单提交为什么要 @submit.prevent？ | 阻止浏览器默认刷新 |
| 如何防重复提交？ | submitting 状态禁用按钮 |
| 增删后怎么保持数据同步？ | 操作成功后重新调 fetchList() |
| 删除为什么要 confirm？ | 防误操作，用户体验 |
| 后端错误信息怎么拿？ | e.response?.data?.detail（FastAPI 约定） |
| 写接口和 Agent 工具什么关系？ | 同一 API 两种调用者：人（表单）/ 模型（Function Calling） |

---

## 6. 技能清单

- [x] v-model 表单（input/textarea）+ @submit.prevent
- [x] request 写操作（POST/DELETE）+ 错误处理
- [x] 操作后刷新列表（fetchList 模式）
- [x] confirm 删除确认
- [x] 成功/失败反馈（msg + 颜色区分）
- [x] 防重复提交（submitting）

**待学（Week 3）**：部署上线（Docker + nginx）、Agent 功能（站内 AI 助手 / 文章摘要 / 友链监控 / RAG）。

---

## 7. 前端学习进度（更新）

```
列表页 ✅ → 详情页 ✅ → 三个展示页 ✅ → 管理后台登录 ✅ → 管理后台 CRUD ✅
→ 剩余：前端打磨（关于页/首页文章推荐/音乐播放器）+ 部署（Week 3）
```
