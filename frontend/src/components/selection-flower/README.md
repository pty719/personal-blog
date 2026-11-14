# SelectionFlower · 文字选区开花

真实文字拖选经过的每个非空白字符，会在文字**后面**种下一株程序花朵；松手后沿原生长路径反向收回。没有服务器、没有远程素材、没有外部字体。

- 正文始终是真实、可拖选、可复制的文本节点，不转成图片。
- 花朵 Canvas 在文字下层（`z-index: 0`），文章在 `z-index: 1` 且背景透明；文字与原生绿色选区完整遮住经过它们的茎、叶、花瓣。
- 每个字符以「文本节点序号 + 字符偏移」为稳定键；同一次拖选扩展只创建新字符，已有植株的身份、形态、坐标不变。
- 每次手势独立 32 位种子；每株使用 xorshift32 生成形态，结果可复现但不同株不重复。

## 文件

| 文件 | 作用 |
| --- | --- |
| `SelectionFlowerEngine.js` | 共享交互核心：Selection 字符采集、植株生成/同步、生长与收回、Canvas 绘制 |
| `motion-runtime.ts` | 实例生命周期：DOM 文案、等比布局、鼠标/键盘/触屏、RAF、观察器、reduced-motion、清理 |
| `SelectionFlower.vue` | Vue 入口（本博客文章页使用） |
| `SelectionFlower.tsx` | React 入口 |
| `SelectionFlower.svelte` | Svelte 入口 |
| `SelectionFlowerSolid.jsx` | Solid 入口 |
| `SelectionFlowerPreact.jsx` | Preact 入口 |
| `mountSelectionFlower.js` | 原生 JS 入口 |
| `SelectionFlowerEngine.d.ts` | 类型声明 |
| `index.js` | 核心公共导出 |

## 安装

Vue 博客直接使用，无需额外依赖（只依赖浏览器 API）。

React 使用：

```bash
npm install react react-dom
```

Svelte / Solid / Preact 各自安装对应框架即可；核心不依赖任何框架。

## 使用

### React

```tsx
import { SelectionFlower } from './components/selection-flower/SelectionFlower'

export default function App() {
  return <SelectionFlower />
}
```

### Vue

```vue
<script setup>
import SelectionFlower from './components/selection-flower/SelectionFlower.vue'
</script>

<template>
  <SelectionFlower :height="720" />
</template>
```

### Svelte

```svelte
<script>
  import SelectionFlower from './components/selection-flower/SelectionFlower.svelte'
</script>

<SelectionFlower height={720} />
```

### Solid

```jsx
import { SelectionFlower } from './components/selection-flower/SelectionFlowerSolid'

export default function App() {
  return <SelectionFlower height={720} />
}
```

### Preact

```jsx
import { SelectionFlower } from './components/selection-flower/SelectionFlowerPreact'

export default function App() {
  return <SelectionFlower height={720} />
}
```

### 原生 JS

```js
import { mountSelectionFlower } from './components/selection-flower/mountSelectionFlower'

const controller = mountSelectionFlower(document.querySelector('#demo'), { height: 720 })

// controller.update({ reducedMotion: true })
// controller.destroy()
```

## Options

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `height` | `number` | `720` | 场景的设计高度；内部文章按 822 设计宽等比缩放，最小 240 |
| `reducedMotion` | `boolean` | 系统偏好 | 显式覆盖系统“减少动态效果”；开启时花朵即时显示最终形态，松手即时清空 |

## 交互

- 鼠标拖选（从左到右、从右到左、跨行、跨段、标题）都会种花；只移动鼠标不种花。
- 松手、取消、窗口失焦、移到外部松手：所有植株反向生长；绿色浏览器选区按系统行为保留。
- 缩小选区：离开的字符反向收回；再次经过时从当前进度接回，不更换身份。
- 聚焦段落：
  - `Enter` / `Space` 选择前 36 个字符并开花，1.3 秒后收回
  - `Shift + ←/→` 扩缩键盘选区
  - `Home` 选择开头，`End` 选择整段
  - `Escape` 清除本实例选区并收回花朵
- 触屏：保留原生长按拖选；轻点段落选择触点附近词组并开花，1.3 秒后收回；纵向滑动正常滚页。
- 屏幕阅读器：提供操作说明，并用 `aria-live="polite"` 播报一次交互结果（不逐帧播报）。

## 确定性

- 每次手势产生 32 位种子；每株种子 = `gestureSeed XOR imul(nodeIndex+1, 73856093) XOR imul(charOffset+1, 19349663)`。
- xorshift32 每次 `x ^= x << 13; x ^= x >>> 17; x ^= x << 5`，返回 `(x >>> 0) / 4294967296`。
- 约 65% 的非空白字符种植；长选区均匀采样，最多 160 株。
- 五类花形等概率：5 瓣圆花、6 瓣圆花、8 瓣细菊、4 瓣圆花、仅含苞小芽。
- 花头尺度：35% 为 5–10px，45% 为 10–17px，20% 为 18–23px；仅含苞类型 4–6px。
- 色板：`#f21b3f` / `#ffb35b` / `#f4d64c` / `#9bc9ec` / `#a47bdf` / `#f1afd0` / `#fff7db`。

## 生命周期

- DOM 只在挂载后访问；同页多实例各自拥有 Canvas、种子、选区所有权与动画控制器。
- 卸载时取消 RAF、计时器、Resize/Intersection 观察器、媒体查询与所有鼠标/键盘/选区监听器；仅清除属于本实例的浏览器选区。
- `destroy()` 幂等；React StrictMode 重新挂载正常。
- 离屏或页面隐藏时暂停 RAF；重新可见后从当前状态继续（dt 上限 0.04s，不补跑后台时间）。
- 减少动态效果仍保留完整交互状态；运行时切换系统偏好立即生效。

## 测试

```bash
npm run test        # 单元测试：确定性、65%/160 上限、身份保持、生长/收回、Selection 字符采集、键盘、多实例
npm run test:e2e    # Playwright：三档宽度、拖选/反向/跨段、键盘、触屏、reduced-motion、像素级合成层对比
npm run build
```

## 挂到真实文章（本博客的做法）

`SelectionFlowerArticle.vue` 把 Canvas 放在真实正文后面，不复制、不替换文章文字：

```vue
<script setup>
import SelectionFlowerArticle from './components/selection-flower/SelectionFlowerArticle.vue'
</script>

<SelectionFlowerArticle>
  <div class="prose-editorial" v-html="articleHtml"></div>
</SelectionFlowerArticle>
```

- 正文仍是原来的真实 DOM；组件 Canvas 层 `z-index:0`，正文 `z-index:1`。
- 使用真实文章的排版与字号，不做 822 设计缩放；`attachTo` 模式只创建 Canvas 与交互。
- 正文内的 `::selection` 使用压深的绿色 `#15803d` + 白字（5.02:1，满足 AA）；规格的 `#2fca4e` + 白字只有 2.17:1，因此做了可访问性修正。
- 鼠标拖选、触屏轻点、`Escape` 收回都可用；键盘段落级操作（Enter/Space、Shift+方向键、Home/End）保留在独立演示组件 `SelectionFlower.vue` 中。

独立演示组件仍保留在 `SelectionFlower.vue`（以及 React/Svelte/Solid/Preact/Vanilla 入口），用于单独展示规格里的固定文案与 822×720 设计布局。
