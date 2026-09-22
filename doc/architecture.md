# 任务管理应用 — 架构设计草案

## 1. 技术选型

| 层面 | 技术 | 理由 |
|------|------|------|
| 语言 | 原生 JavaScript (ES6+) | 无需构建工具、零依赖，开箱即用 |
| 样式 | 原生 CSS + CSS 自定义属性 | 轻量实现深色模式主题切换 |
| 存储 | localStorage（按状态列拆分 key） | 纯前端、刷新不丢失；拆分 key 减少单次序列化量 |
| 拖拽 | HTML5 Drag & Drop API + 触屏降级 | 桌面拖拽原生支持；触屏设备降级为「移动至」下拉菜单 |
| 事件解耦 | 自定义事件总线 (EventBus) | Store 不再直接依赖视图层，新增模块只需订阅事件 |
| 开发工具 | VSCode + Live Server | 本地快速预览 |

**关于拖拽的架构决策**：对桌面端用户使用 HTML5 Drag & Drop；对触屏设备（`'ontouchstart' in window`）自动降级为在卡片上显示「移动至…」下拉菜单，确保所有设备可操作。后续如需统一体验，可替换为 @hello-pangea/dnd（~5KB gzip）。

## 2. 目录结构

```
task manager/
├── index.html                  # 入口页面，承载所有 UI
├── css/
│   └── style.css               # 全局样式、主题变量、看板布局
├── js/
│   ├── app.js                  # 应用入口：初始化、路由切换
│   ├── store.js                # 数据层：localStorage 读写 + CRUD 操作
│   ├── board.js                # 看板视图：渲染三列、拖拽处理
│   ├── modal.js                # 任务编辑弹窗：新增 / 编辑表单
│   ├── theme.js                # 深色模式切换与系统偏好跟随
│   ├── event-bus.js            # 轻量发布/订阅事件总线
│   ├── confirm.js              # 自定义确认对话框（替代原生 confirm）
│   └── search.js               # 搜索与筛选（按标题/描述模糊匹配）
├── doc/
│   ├── architecture.md         # 本文件 — 架构设计草案
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

## 5. 数据流 — 事件总线模式

```
用户操作 → 事件监听 → store.js CRUD 方法
                          ├── 更新内存 Map（按 status 分桶）
                          ├── 写入对应状态列的 localStorage key
                          ├── 容量检查（捕获 QuotaExceededError）
                          └── bus.emit('task:created' | 'task:updated' | 'task:deleted', data)

board.js ──bus.on('task:created') / bus.on('task:updated') / bus.on('task:deleted') / bus.on('task:status-changed')──→ 重绘受影响的列
modal.js ──bus.on('task:created') / bus.on('task:updated')──→ 关闭弹窗
search.js ──bus.on('task:updated') / bus.on('task:deleted')──→ 刷新搜索结果（如果搜索激活）
confirm.js ──独立组件，不依赖 Store

深色切换 → theme.js
          ├── 读取 window.matchMedia('(prefers-color-scheme: dark)')
          ├── 用户手动切换 → 写入 localStorage + 标记 userOverridden
          ├── 系统主题变化 → 仅当 !userOverridden 时自动跟随
          └── 更新 <html> 的 data-theme 属性
```

**核心变更**：引入事件总线后，Store 不再直接调用任何视图方法。所有视图模块通过 `bus.on()` 订阅感兴趣的事件。这是一个 ≤30 行的解耦层。

**事件总线接口**：
```javascript
// js/event-bus.js
bus.on(event, fn)     // 订阅事件
bus.emit(event, data) // 发布事件
bus.off(event, fn)    // 取消订阅
```

**事件清单**：
| 事件名 | 数据载荷 | 发布时机 |
|--------|---------|---------|
| `task:created` | `{ task }` | store.createTask() 成功后 |
| `task:updated` | `{ id, changes }` | store.updateTask() 成功后 |
| `task:deleted` | `{ id }` | store.confirmDelete() 到期执行后 |
| `task:status-changed` | `{ id, fromStatus, toStatus, order }` | 拖拽或下拉改变状态后 |
| `task:delete-pending` | `{ id }` | store.markPendingDelete() 调用后 |
| `task:delete-cancelled` | `{ id }` | store.cancelDelete() 撤销删除后 |

## 6. 拖拽交互流程

### 6.1 桌面拖拽（HTML5 Drag & Drop）

1. `task-card` 设置 `draggable="true"`，`dragstart` 保存任务 ID 到 `dataTransfer`
2. `.task-list` 监听 `dragover`（阻止默认以允许 drop）+ `dragenter`/`dragleave` 视觉高亮
3. `.task-list` 监听 `drop`：
   - **跨列**：读取任务 ID + 目标列 status → `store.updateTaskStatus(id, newStatus, newOrder)` → 重绘两列
   - **同列排序**：根据鼠标落点位置（`offsetY` 与子元素位置对比）计算新位置 → `store.reorderTask(id, targetColumnStatus)` → 被拖拽列的所有卡片**重新编号** `order=0,1,2,…`（简单稳定，防止浮点数膨胀）
4. 使用 `dragend` 清理拖拽状态

### 6.2 触屏降级

- 设备检测：`'ontouchstart' in window`
- 触屏设备上卡片右下角显示「⋮」菜单按钮
- 点击弹出下拉操作：移动至「待办 / 进行中 / 完成」
- 选择后调用 `store.updateTaskStatus()`，数据流与拖拽一致

### 6.3 键盘操作（无障碍）

- 卡片获得焦点后，快捷键 `Ctrl+→` / `Ctrl+←` 切换至相邻状态列（不改变同列排序）
- 提供 `aria-label` 和 `role` 标注

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

- 搜索框在页头右侧，输入即搜索（300ms 防抖）
- 按标题和描述做模糊匹配（`includes()` 大小写不敏感）
- 搜索激活时，所有列仅显示匹配的卡片；列计数变为匹配数
- 清空搜索框恢复完整看板
- 搜索状态不影响数据（纯前端过滤）

## 10. 存储安全与异常处理

- **容量预警**：每次 `setItem` 前用探针检查 `QuotaExceededError`
- **异常捕获**：所有 `localStorage` 操作包裹 try-catch，捕获到错误时：① bus.emit 警告事件 ② 界面显示 toast 提示
- **向前兼容**：`store.init()` 时检测旧数据格式（单 key），自动迁移到三 key 新格式
- **数据校验**：`store.init()` 对每条任务做 schema 校验，修补缺失字段默认值

### 10.1 撤销删除机制

`store.deleteTask(id)` 实现延迟删除流程：

1. 调用 `store.markPendingDelete(id)` → 将任务标记 `_pendingDelete: true`，存入内存（不清除 DOM）
2. 触发 `bus.emit('task:delete-pending', { id })` → 视图移除卡片 + 弹出「已删除」toast（含「撤销」按钮）
3. 创建 3 秒定时器（`setTimeout`），到期后执行 `store.confirmDelete(id)`：
   - 从内存和 localStorage 彻底移除该任务
   - 触发 `bus.emit('task:deleted', { id })`
4. **撤销流程**：用户点击「撤销」→ 调用 `store.cancelDelete(id)` 清除 `_pendingDelete` 标记 → 清除定时器 → 触发 `bus.emit('task:delete-cancelled', { id })`（视图恢复卡片）
5. 如果用户在 pending 期间又对同一任务进行编辑/拖拽操作，自动取消删除 pending

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