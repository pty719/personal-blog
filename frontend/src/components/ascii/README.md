# AsciiSharks · 字符鲨鱼与鱼群

一个可交互的二维字符海洋：多种鲨鱼用有明暗层次的 ASCII 方格拼成，从俯视角连续摆尾游动，追逐会聚集与逃散的小鱼。默认白色细网格，中间有轻雾与半透明本地输入框。

- 全部绘制使用 Canvas2D 与 CSS，无 3D 库、无图片、无视频、无远程资源。
- 每个实例拥有独立的 mulberry32 随机序列，不修改全局 `Math.random`；同页可挂载多个实例。
- 输入层只产生本地消息与 `File[]`，不会自动调用 AI、上传文件或产生虚假回答；宿主可通过 `onSubmit` 接到自己的后端。

## 文件

| 文件 | 作用 |
| --- | --- |
| `AsciiSharksEngine.js` | 框架无关核心：网格、鱼群力学、鲨鱼脊柱/捕食、尾迹场、字符渲染 |
| `motion-runtime.ts` | 实例生命周期：Canvas、雾层、输入框、History、附件、麦克风、键盘/指针、RAF、观察器 |
| `AsciiSharks.vue` | Vue 入口（本博客 AI 助手页使用） |
| `AsciiSharks.tsx` | React 入口 |
| `AsciiSharks.svelte` | Svelte 入口 |
| `AsciiSharksSolid.jsx` | Solid 入口 |
| `AsciiSharksPreact.jsx` | Preact 入口 |
| `mountAsciiSharks.js` | 原生 JS 入口 |
| `AsciiSharksEngine.d.ts` | 类型声明 |
| `index.js` | 核心公共导出 |

## 安装

Vue 博客直接使用，无需额外依赖（引擎只依赖浏览器 API）。

React 使用：

```bash
npm install react react-dom
```

Svelte / Solid / Preact 各自安装对应框架即可；核心不依赖任何框架。

## 使用

### React

```tsx
import { AsciiSharks } from './components/ascii/AsciiSharks'

export default function App() {
  return <AsciiSharks />
}
```

### Vue

```vue
<script setup>
import AsciiSharks from './components/ascii/AsciiSharks.vue'

function handleSubmit({ text, attachments }) {
  console.log(text, attachments)
}
</script>

<template>
  <AsciiSharks
    theme="light"
    :height="720"
    :on-submit="handleSubmit"
  />
</template>
```

### Svelte

```svelte
<script>
  import AsciiSharks from './components/ascii/AsciiSharks.svelte'
</script>

<AsciiSharks height={720} onVoiceInput={null} />
```

### Solid

```jsx
import { AsciiSharks } from './components/ascii/AsciiSharksSolid'

export default function App() {
  return <AsciiSharks height={720} />
}
```

### Preact

```jsx
import { AsciiSharks } from './components/ascii/AsciiSharksPreact'

export default function App() {
  return <AsciiSharks height={720} />
}
```

### 原生 JS

```js
import { mountAsciiSharks } from './components/ascii/mountAsciiSharks'

const controller = mountAsciiSharks(document.querySelector('#ocean'), {
  height: 720,
  onSubmit: ({ text, attachments }) => console.log(text, attachments),
})

// controller.update({ theme: 'dark', speed: 1.4 })
// controller.setPaused(true)
// controller.reset()
// controller.destroy()
```

## Options

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark'` | `'light'` | 浅色仅对 Canvas 施加 `invert(1)`；暗色黑底、不反色 |
| `paused` | `boolean` | `false` | 暂停模拟；手动点击仍会即时反馈 |
| `speed` | `number` | `1` | 模拟速度，限制在 `0.25–2` |
| `seed` | `number` | `7` | 确定性初始种子；修改后重建海洋 |
| `fishCount` | `number \| null` | `null` | `null` 时按面积自动计算并限制在 `85–340`；`0` 表示无鱼 |
| `sharks` | `{ kind, size? }[]` | 4 条默认鲨鱼 | `kind` 支持 8 种；`size` 限制 `0.35–1.25` |
| `showComposer` | `boolean` | `true` | 为 `false` 时隐藏输入层、雾与 History，只留纯背景 |
| `height` | `number \| string` | `880` | 数字最小 480px；也可传 CSS 长度 |
| `reducedMotion` | `boolean` | 系统偏好 | 显式覆盖系统“减少动态效果” |
| `variant` | `'default' \| 'thumb'` | `'default'` | `thumb` 用 `#f4f4f4` 底与 `brightness(.956862745)` |
| `onSubmit` | `({ text, attachments }) => void` | — | 本地提交回调；附件是 `File[]`，不会被读取或上传 |
| `onVoiceInput` | `() => string \| Promise<string> \| void` | `null` | 提供才启用麦克风，否则禁用并提示 `Voice input is not connected` |

## 交互

- `Enter` 本地提交；`Shift+Enter` 换行；中文组合输入不会触发提交。
- `History` 展开本地最近 8 条提交文本，点击回填；`Escape` 或点外部收起。
- 附件最多 3 个，显示文件名与 24px 删除按钮。
- 鼠标在水面移动产生避让；点击惊散半径 240 内的鱼；触屏轻点才惊散，纵向滑动正常滚页。
- 聚焦画布后：`Space` 暂停/继续，`R` 用相同 seed 重置，方向键每次移动虚拟指针 48px，`Enter` 在虚拟指针或中央制造水波。
- 输入框内的空格与 `R` 不会控制海洋。

## 生命周期

- DOM 只在挂载后访问；同页多实例各自持有 Canvas、随机序列、事件与观察器。
- 卸载时取消 RAF、断开 Resize/Intersection 观察器、移除媒体/可见性/键盘/指针/表单监听，清空 Canvas 与缓存引用。
- 修改 `theme` / `paused` / `speed` 保留鱼群、输入值与本地历史；修改 `seed` / `sharks` / `fishCount` 重建海洋，但复用同一个 Canvas 与输入节点。
- 容器尺寸变化时按新旧宽高缩放鱼群与 20 节鲨鱼脊柱，再更新字符网格。

## 测试

```bash
npm run test        # 单元测试（引擎确定性、初始化、脊柱约束、输入行为）
npm run test:e2e    # Playwright：375 / 768 / 1440 截图、溢出、输入、附件、错误反馈
npm run build
```
