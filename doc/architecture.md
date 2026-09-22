# 任务管理应用 — 架构设计草案

## 1. 技术选型

| 层面 | 技术 | 理由 |
|------|------|------|
| 语言 | JavaScript (ES6+) | 通用、生态成熟 |
| 前端框架 | Vue 3 (Composition API, `<script setup>`) | 响应式数据绑定、组件化开发、轻量高效 |
| 构建工具 | Vite | 极速 HMR、原生 ESM、开箱即用支持 Vue SFC |
| 样式方案 | Tailwind CSS 3 | 原子化 CSS、深色模式内置支持、快速开发 |
| 存储 | localStorage（按状态列拆分 key） | 纯前端、刷新不丢失；拆分 key 减少单次序列化量 |
| 拖拽 | Pointer Events（自研）| 基于 `pointerdown/move/up`，绑定到 `document`；`elementsFromPoint` 命中测试 |
| 包管理 | npm | 标准生态 |
| 开发工具 | VSCode + Vite Dev Server | 热更新开发体验 |

**关于拖拽的架构决策**：采用自研 Pointer Events 方案（`useDrag.js` composable），将 `pointermove/up/cancel` 绑定到 `document`，并通过 `document.elementsFromPoint()` 进行命中测试。对触屏设备（`'ontouchstart' in window`）自动降级为在卡片上显示「移动至…」下拉菜单，确保所有设备可操作。

## 2. 目录结构

```
task manager/
├── index.html                  # Vite 入口 HTML
├── package.json                # 项目配置与依赖
├── vite.config.js              # Vite 配置
├── tailwind.config.js          # Tailwind 配置（含深色模式）
├── postcss.config.js           # PostCSS（Tailwind 插件）
├── src/
│   ├── main.js                 # Vue 应用入口
│   ├── App.vue                 # 根组件（布局 + 事件订阅）
│   ├── stores/
│   │   └── taskStore.js        # 响应式 Store：localStorage CRUD + 撤销删除
│   ├── composables/
│   │   ├── useTheme.js         # 深色模式切换与系统偏好跟随
│   │   └── useToast.js         # Toast 通知管理
│   ├── components/
│   │   ├── AppHeader.vue       # 页头：标题、搜索、主题切换、新建按钮
│   │   ├── KanbanBoard.vue     # 看板主体：三列渲染、拖拽代理
│   │   ├── Column.vue          # 单列：列头 + 拖放区 + 卡片列表
│   │   ├── TaskCard.vue        # 任务卡片：拖拽源、触屏菜单、逾期标记
│   │   ├── TaskModal.vue       # 任务弹窗：新增 / 编辑 / 确认 三种模式
│   │   └── ToastContainer.vue  # Toast 通知容器
│   └── assets/
│       └── style.css           # Tailwind 指令引入 + 少量自定义样式
├── doc/
│   ├── architecture.md         # 本文件
│   └── requirement.md          # 需求文档
└── .gitignore
```

## 3. 组件树 (DOM 结构)

```
#app
├── .app-header
│   ├── .app-title              "Task Manager"
│   ├── .search-box             搜索输入框 (placeholder="搜索…")
│   ├── .theme-toggle           深色模式切换按钮
│   └── .add-task-btn           新建任务按钮
├── .kanban-board
│   ├── .column[data-status="todo"]
│   │   ├── .column-header      待办 (计数) [逾期: N]
│   │   └── .task-list          (可拖放区)
│   │       └── .task-card      (可拖拽)
│   ├── .column[data-status="in-progress"]
│   │   ├── .column-header      进行中 (计数)
│   │   └── .task-list
│   └── .column[data-status="done"]
│       ├── .column-header      完成 (计数)
│       └── .task-list
├── #task-modal                 (隐藏弹窗 — 新增/编辑/确认复用)
│   ├── .modal-overlay
│   └── .modal-content
│       ├── .form-view          (mode="create"|"edit" 时显示)
│       │   ├── form
│       │   │   ├── input#task-title          (必填)
│       │   │   ├── textarea#task-description (选填)
│       │   │   ├── input#task-dueDate        (选填，type="date")
│       │   │   ├── select#task-priority      (高/中/低)
│       │   │   ├── select#task-status        (三态)
│       │   │   └── button[type="submit"]     保存
│       │   └── .modal-close
│       └── .confirm-view       (mode="confirm" 时显示)
│           ├── .confirm-message             提示文本
│           ├── .confirm-btn                 确认按钮
│           └── .cancel-btn                  取消按钮
└── #toast-container            临时通知容器（撤销/错误提示）
```

## 4. 数据模型

```javascript
// 单条任务
{
  id: "uuid-string",                    // crypto.randomUUID()
  title: "string",                      // 必填，非空
  description: "string",                // 选填，默认 ""
  status: "todo" | "in-progress" | "done",
  priority: "high" | "medium" | "low",
  order: 0,                             // 同列排序权重（数值越小越靠前）
  dueDate: "ISO-8601" | null,           // 截止日期（选填）
  tags: [],                             // 预留标签字段
  createdAt: "ISO-8601",                // 创建时间戳
  updatedAt: "ISO-8601"                 // 最后修改时间戳
}
```

**存储策略**：按状态拆分三个 localStorage key，减少单次读写数据量：
- `taskmanager_todo`
- `taskmanager_in-progress`
- `taskmanager_done`

**向后兼容**：读取旧数据（单 key 格式 `taskmanager_tasks`）时自动迁移到新格式，并补全缺失字段默认值。

## 5. 数据流 — Vue 响应式驱动

Store  (`taskStore`) 使用 `reactive()` 管理三个状态数组 (`todo` / `in-progress` / `done`)。组件通过 `computed` 读取数组并自动追踪依赖。任何写操作（`create`、`update`、`reorderColumn`、`commitDelete`）修改响应式数据后调用 `_save()` 持久化到 localStorage。Vue 的响应式系统自动触发视图更新，无需额外事件总线。

```
用户操作
  ├── 新建/编辑 → taskStore.create() / update()
  │                  ├── 修改 reactive tasks[...]
  │                  ├── _save() → localStorage
  │                  └── Vue 响应式 → 组件重渲染
  ├── 拖拽      → useDrag.js → pointerup → taskStore.updateStatus() / reorderColumn()
  │                                ├── 修改 reactive tasks[...]
  │                                └── _save() → localStorage
  └── 删除      → taskStore.markPendingDelete()
                     ├── hiddenTasks.add(id) → Column 自动过滤
                     ├── 3s 后 commitDelete() → splice + _save()
                     └── Vue 响应式 → 隐藏的卡片立即从 DOM 消失

深色切换 → useTheme composable
           ├── 读取 window.matchMedia('(prefers-color-scheme: dark)')
           ├── 用户手动切换 → 写入 localStorage + 标记 userOverridden
           ├── 系统主题变化 → 仅当 !userOverridden 时自动跟随
           └── 更新 <html> 的 class 包含 .dark
```

## 6. 拖拽交互流程

### 6.1 桌面拖拽（Pointer Events）

基于 `useDrag.js` composable，采用 Pointer Events 实现：

1. `pointerdown` 在 TaskCard 触发 → 记录初始位置、源卡片 DOM、源状态；将 `pointermove` / `pointerup` / `pointercancel` 绑定到 `document`
2. 鼠标移动超过 5px 后进入拖拽模式：
   - 源卡片添加 `drag-source-hidden` class → 从 flex 布局坍缩，其他卡片补位
   - 创建浮层卡片 (`drag-floating-card`) 克隆，`pointer-events: none`，跟随鼠标
   - `document.elementsFromPoint()` 检测目标列，更新 `state.targetStatus` → Column 高亮
3. `pointerup` 时计算插入位置，调用 `taskStore.updateStatus()`（跨列）或 `taskStore.reorderColumn()`（同列排序）
4. `pointercancel` 或 `Escape` → 清理浮层、恢复源卡片，不提交数据

### 6.2 触屏降级

- 设备检测：`'ontouchstart' in window`
- 触屏设备上卡片右下角显示「⋮」菜单按钮
- 点击弹出下拉操作：移动至「待办 / 进行中 / 完成」
- 选择后调用 `taskStore.updateStatus()`，效果与拖拽一致

## 7. 深色模式

- CSS 自定义属性 (`--bg-primary`, `--text-primary` 等) 定义在 `:root` 和 `[data-theme="dark"]`
- **启动时**：先检查 `localStorage` 中的用户偏好；若无，则读取 `window.matchMedia('(prefers-color-scheme: dark)')` 跟随系统
- **切换时**：更新 `data-theme` 属性 + localStorage 存储 + 标记 `userOverridden = true`
- **系统变化时**：监听 `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)`，仅当用户未手动覆盖时自动跟随
- 存储 key：`taskmanager_theme`（值：`'light'` | `'dark'` | `'system'`）

## 8. 弹窗复用

- 新增 / 编辑 / **确认对话框**共用同一个模态框
- 三种模式通过 `data-mode` 区分：`"create"` / `"edit"` / `"confirm"`
- `create`：表单字段置空，提交 → `store.createTask()`
- `edit`：预填数据，隐藏字段 `data-task-id`，提交 → `store.updateTask()`
- `confirm`：只显示消息文本 + 确认/取消按钮，不渲染表单字段
- 关闭方式：点击遮罩 / 关闭按钮 / ESC 键

## 9. 搜索与筛选

- 搜索框在页头右侧，输入即搜索，实时过滤
- 按标题和描述做模糊匹配（`includes()` 大小写不敏感）
- 搜索激活时，所有列仅显示匹配的卡片；列计数变为匹配数
- 清空搜索框恢复完整看板
- 搜索状态不影响数据（纯前端过滤）

## 10. 存储安全与异常处理

- **容量预警**：每次 `setItem` 前用探针检查 `QuotaExceededError`
- **异常捕获**：所有 `localStorage` 操作包裹 try-catch，捕获到错误时：① `window.dispatchEvent(new CustomEvent('storage:quota-exceeded', …))` 通知 Toast ② 界面显示 toast 提示
- **向前兼容**：`store.init()` 时检测旧数据格式（单 key），自动迁移到三 key 新格式
- **数据校验**：`store.init()` 对每条任务做 schema 校验，修补缺失字段默认值

### 10.1 撤销删除机制

删除流程基于 `hiddenTasks`（`reactive(Set)`）实现界面显隐控制：

1. 用户确认删除 → `store.markPendingDelete(id)` 将该 ID 加入 `hiddenTasks`，卡片从 Column 的过滤计算属性中消失（立即隐藏）
2. 同时启动 3 秒定时器，到期后执行 `store.commitDelete(id)`：
   - 从 `tasks[status]` 数组中 `splice` 移除
   - 调用 `_save(status)` 持久化
   - 若 `_save()` 写入失败，将任务 `splice` 插回原位，`hiddenTasks.delete(id)`，并触发 `CustomEvent` Toast 警告
3. **撤销流程**：用户点击 Toast「撤销」→ `store.cancelDelete(id)` 清除定时器 + `hiddenTasks.delete(id)`，任务重新出现
4. 如果用户在 pending 期间对同一任务进行编辑/拖拽操作，自动取消删除 pending

## 11. 列配置解耦

```javascript
// 列定义从硬编码改为配置数组
const COLUMNS = [
  { status: 'todo',         label: '待办',   icon: '📋' },
  { status: 'in-progress',  label: '进行中', icon: '🔄' },
  { status: 'done',         label: '完成',   icon: '✅' },
]
```

`board.js` 的渲染循环遍历 `COLUMNS` 自动生成列。后续如需加列（如「审核中」），只需追加数组项。

## 12. 渲染性能优化

- 使用 `DocumentFragment` 批量构建 DOM 后再一次性插入
- 列计数更新从 DOM 重渲染中分离，使用 `textContent` 直接更新
- 合并短期内多次渲染请求（`requestAnimationFrame` 批处理）
- 搜索过滤时只做 CSS 显隐切换（`display: none`），不销毁/重建 DOM