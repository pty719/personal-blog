<!-- AI 伴侣项目展示页（AI 伴侣独立站点已并入小站/退役，此页作为项目案例展示）
     导航栏"AI 伴侣"入口：从"嵌入在线站点"改为"展示项目" -->
<template>
  <section>
    <h2>AI 伴侣</h2>
    <p class="sub">一个会聊天的 AI 伙伴——自定义人设、记住你们聊过的每句话</p>

    <!-- 项目卡片 -->
    <div class="card">
      <div class="card-header">
        <span class="badge">已交付项目</span>
        <h3>AI 智能伴侣</h3>
      </div>
      <p class="desc">
        培训班结业项目：支持自定义人设（昵称/性格/语气），基于 DeepSeek 大模型实现多轮对话，
        会话历史持久化存储，JWT 登录鉴权。独立部署于阿里云，现已并入本站作为功能展示。
      </p>

      <div class="tags">
        <span class="tag">FastAPI</span>
        <span class="tag">MySQL</span>
        <span class="tag">DeepSeek API</span>
        <span class="tag">JWT 鉴权</span>
        <span class="tag">nginx</span>
      </div>

      <ul class="features">
        <li>✅ 自定义人设：昵称、性格、说话风格随时改</li>
        <li>✅ 多轮对话：上下文记忆，越聊越懂你</li>
        <li>✅ 会话管理：历史会话保存，随时找回</li>
        <li>✅ 账号体系：JWT 登录，数据隔离</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.sub { color: #6b7280; margin-bottom: 20px; }
.card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 24px; max-width: 640px;
}
.card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.badge {
  background: #dbeafe; color: #1d4ed8; font-size: 12px;
  padding: 2px 10px; border-radius: 999px;
}
.desc { color: #374151; line-height: 1.8; }
.tags { margin: 16px 0; }
.tag {
  display: inline-block; font-size: 13px; color: #2563eb;
  background: #eff6ff; padding: 3px 10px; border-radius: 999px; margin-right: 8px;
}
.features { list-style: none; color: #4b5563; }
.features li { margin: 6px 0; }
</style>
