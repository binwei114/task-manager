# Task Manager — 任务管理器

[English](#english) | [中文](#chinese)

---

<a name="english"></a>

## 📋 Task Manager

A lightweight, browser-based kanban task management tool built with **Vue 3 + Vite + Tailwind CSS**. Tasks are stored in `localStorage` — zero backend, zero dependencies, refresh-safe.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 (Composition API, `<script setup>`) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 (dark mode via `class` strategy) |
| Storage | localStorage (split by status into 3 keys) |
| Drag & Drop | Pointer Events (custom implementation) |
| Icons | Unicode / emoji (zero external icon deps) |

### Features

- **Full CRUD** — Create, read, edit, delete tasks (title required, description optional)
- **Three statuses** — Todo / In Progress / Done — organized as a kanban board
- **Priority levels** — High (red), Medium (yellow), Low (green) with text badges
- **Drag & drop** — Pointer Events-based: cross-column move, same-column reorder; touch devices fall back to a context menu
- **Due dates** — Date picker + overdue warning (⚠️)
- **Undo delete** — 3-second undo window with a toast notification
- **Search** — Real-time filter by title / description
- **Dark mode** — Follows system preference; manual toggle persisted to localStorage
- **Storage safety** — Write-ahead strategy with rollback on `QuotaExceededError`; user-facing toast warnings
- **Responsive** — Three-column layout on desktop, horizontal scroll on narrow screens with snap-scroll

### Getting Started

```bash
cd ~/Desktop/task\ manager
npm install
npm run dev
```

Open **http://localhost:5173/** in your browser.

To build for production:

```bash
npm run build
npm run preview
```

### Project Structure

```
task manager/
├── index.html                 # Vite entry HTML
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.js                # Vue app mount
│   ├── App.vue                # Root component
│   ├── assets/style.css       # Tailwind directives + custom styles
│   ├── stores/
│   │   └── taskStore.js       # Reactive store (localStorage CRUD)
│   ├── composables/
│   │   ├── useDrag.js         # Pointer Events drag controller
│   │   ├── useTheme.js        # Dark mode (system + manual + persist)
│   │   └── useToast.js        # Toast notification manager
│   ├── components/
│   │   ├── AppHeader.vue      # Header: title, search, theme, new-task
│   │   ├── KanbanBoard.vue    # Board container (provides drag)
│   │   ├── Column.vue         # Single column + drop target
│   │   ├── TaskCard.vue       # Task card (pointer-down, click, touch menu)
│   │   ├── TaskModal.vue      # Create / Edit / Confirm dialog
│   │   └── ToastContainer.vue # Toast notifications
├── doc/
│   ├── architecture.md        # Architecture design document
│   └── requirement.md         # Requirements specification
├── screenshots/               # Feature screenshots
├── prompts/                   # Prompt design records
└── .gitignore
```

### Architecture Highlights

- **Single-direction data flow**: `store` is the single source of truth; components read reactively and write through store methods.
- **Event bus eliminated**: Vue's reactive system (`reactive`, `computed`, `watch`) replaces the old custom event bus.
- **Delete safety net**: Deleted tasks are immediately hidden from UI via a `reactive(Set)`; a 3-second timer calls `commitDelete` which splices from the array + `_save()`. If `_save()` fails, the task is re-inserted and a toast warns the user.
- **Drag robustness**: Pointer Events bound to `document` (no `setPointerCapture`), `elementsFromPoint` for hit-testing, `drag-source-hidden` CSS class collapses the source card from the flex layout.

---

<a name="chinese"></a>

## 📋 Task Manager — 任务管理器

一款轻量浏览器端看板任务管理工具，使用 **Vue 3 + Vite + Tailwind CSS** 构建。数据存储在 `localStorage` 中——无需后端、零外部依赖、刷新不丢失。

### 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | Vue 3（Composition API, `<script setup>`） |
| 构建工具 | Vite 5 |
| 样式方案 | Tailwind CSS 3（`class` 策略实现深色模式） |
| 数据存储 | localStorage（按状态分 3 个 key） |
| 拖拽实现 | Pointer Events（自研） |
| 图标方案 | Unicode / emoji（零外部图标依赖） |

### 功能特性

- **完整增删改查** — 创建、读取、编辑、删除任务（标题必填，描述选填）
- **三种状态** — 待办 / 进行中 / 完成，看板三列展示
- **优先级** — 高（红）、中（黄）、低（绿）文字标签
- **拖拽操作** — 基于 Pointer Events：跨列移动/同列排序；触屏设备降级为菜单操作
- **截止日期** — 日期选择器 + 逾期警告（⚠️）
- **撤销删除** — 3 秒内可通过 Toast 撤销删除
- **搜索筛选** — 按标题/描述实时过滤
- **深色模式** — 自动跟随系统偏好；手动切换后持久化
- **存储安全** — 先写策略 + `QuotaExceededError` 回滚 + Toast 警告
- **响应式布局** — 桌面三列等宽，窄屏横向滚动 + 吸附滚动

### 快速启动

```bash
cd ~/Desktop/task\ manager
npm install
npm run dev
```

在浏览器中打开 **http://localhost:5173/**。

生产构建：

```bash
npm run build
npm run preview
```

### 项目结构

```
task manager/
├── index.html                 # Vite 入口 HTML
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.js                # Vue 应用挂载
│   ├── App.vue                # 根组件
│   ├── assets/style.css       # Tailwind 指令 + 自定义样式
│   ├── stores/
│   │   └── taskStore.js       # 响应式 Store（localStorage CRUD）
│   ├── composables/
│   │   ├── useDrag.js         # Pointer Events 拖拽控制器
│   │   ├── useTheme.js        # 深色模式（系统 + 手动 + 持久化）
│   │   └── useToast.js        # Toast 通知管理
│   ├── components/
│   │   ├── AppHeader.vue      # 页头：标题、搜索、主题、新建
│   │   ├── KanbanBoard.vue    # 看板容器（provide 拖拽）
│   │   ├── Column.vue         # 单列 + 拖放目标
│   │   ├── TaskCard.vue       # 任务卡片（pointerdown、点击、触屏菜单）
│   │   ├── TaskModal.vue      # 新建/编辑/确认对话框
│   │   └── ToastContainer.vue # Toast 通知容器
├── doc/
│   ├── architecture.md        # 架构设计文档
│   └── requirement.md         # 需求规格说明
├── screenshots/               # 功能截图
├── prompts/                   # 提示词设计记录
└── .gitignore
```

### 架构要点

- **单向数据流**：Store 是唯一数据源，组件响应式读取，通过 Store 方法写入
- **事件总线已移除**：Vue 响应式系统（`reactive`、`computed`、`watch`）取代了旧的自定义事件总线
- **删除安全网**：删除后立即用 `reactive(Set)` 从 UI 隐藏；3 秒定时器到期后调用 `commitDelete` 从数组移除 + `_save()`。若 `_save()` 失败则插回任务，Toast 警告用户
- **拖拽可靠性**：Pointer Events 绑定在 `document`（不使用 `setPointerCapture`），`elementsFromPoint` 命中测试，`drag-source-hidden` CSS class 使源卡片从 flex 布局坍缩