# 任务管理应用 — 架构说明

## 1. 技术选型

| 层面 | 技术 | 理由 |
|------|------|------|
| 语言 | JavaScript (ES6+) | 通用、生态成熟 |
| 前端框架 | Vue 3 (Composition API, `<script setup>`) | 响应式数据绑定、组件化开发、轻量高效 |
| 构建工具 | Vite | 极速 HMR、原生 ESM、开箱即用支持 Vue SFC |
| 样式方案 | Tailwind CSS 3 | 原子化 CSS、深色模式内置支持、快速开发 |
| 存储 | localStorage（按状态列拆分 key） | 纯前端、刷新不丢失；拆分 key 减少单次序列化量 |
| 拖拽 | Pointer Events（自研）| 基于 `pointerdown/move/up`，绑定到 `window`；`elementFromPoint` 命中测试 |
| 包管理 | npm | 标准生态 |
| 开发工具 | VSCode + Vite Dev Server | 热更新开发体验 |

**关于拖拽的架构决策**：采用自研 Pointer Events 方案（`useDrag.js` composable），将 `pointermove/up/cancel` 绑定到 `window`，并通过 `document.elementFromPoint()` 进行命中测试。对触屏设备（`'ontouchstart' in window`）自动降级为在卡片上显示「移动至…」下拉菜单，确保所有设备可操作。

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
│   ├── App.vue                 # 根组件：初始化 Store/主题、管理弹窗状态、监听存储告警
│   ├── stores/
│   │   └── taskStore.js        # 响应式 Store：localStorage CRUD + 撤销删除
│   ├── composables/
│   │   ├── useDrag.js          # Pointer Events 拖拽控制器
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

## 3. 组件关系

```
App.vue
├── AppHeader          — 标题、搜索框、深色切换按钮、新建按钮
├── KanbanBoard        — Provide: drag (useDrag)
│   └── Column (×3)   — 遍历 COLUMNS 渲染
│       └── TaskCard   — pointerdown、click、touch menu
├── TaskModal          — Teleport to body; v-if 控制显隐
└── ToastContainer     — 浮动通知
```

- 弹窗使用 `<Teleport to="body">`，`v-if="modal.show"` 控制挂载/卸载
- 拖拽状态通过 `provide/inject` 从 `KanbanBoard` 向下传递
- 搜索词通过 `provide/inject` 从 `App.vue` 向下传递

Column 的任务放置区选择器：`.task-list[data-status]`，拖拽命中检测依赖此结构。

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
  dueDate: "YYYY-MM-DD" | null,         // 截止日期（选填，来自 date input）
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
           ├── 用户手动切换 → 写入 localStorage（只存 'light' 或 'dark'）
           ├── 系统主题变化 → 仅当 localStorage 无保存值时自动跟随
           └── 切换 <html> 的 .dark 类
```

## 6. 拖拽交互流程

### 6.1 桌面拖拽（Pointer Events）

基于 `useDrag.js` composable，监听器绑定在 `window`：

1. `pointerdown` 在 TaskCard 触发 → 记录初始位置、源卡片 DOM、源状态；将 `pointermove`/`pointerup`/`pointercancel`、`keydown` 及 `blur` 绑定到 `window`
2. 鼠标移动超过 5px 后进入拖拽模式：
   - 源卡片添加 `drag-source-hidden`（`display: none !important;`）→ 完全离开布局，其他卡片补位
   - 创建浮层卡片 (`drag-floating-card`) 克隆（`position: fixed`，`opacity: 0.92`，`rotate(3deg) scale(1.04)`，`pointer-events: none`）跟随鼠标
   - `document.elementFromPoint()` 检测目标列，更新 `state.targetStatus` → Column 高亮
3. `pointerup` 时计算插入位置，调用 `taskStore.updateStatus()`（跨列）或 `taskStore.reorderColumn()`（同列排序）；通过 `setTimeout(0)` 阻止可能的 `click` 事件
4. `pointercancel`、`Escape` 或 `blur` → 清理浮层、恢复源卡片，不提交数据

### 6.2 触屏降级

- 设备检测：`'ontouchstart' in window`
- 触屏设备上卡片右下角显示「⋮」菜单按钮
- 点击弹出下拉操作：移动至「待办 / 进行中 / 完成」
- 选择后调用 `taskStore.updateStatus()`，效果与拖拽一致

## 7. 深色模式

- CSS 通过 Tailwind `dark:` 变体控制，切换时在 `<html>` 上添加/移除 `.dark` 类
- **启动时**：先检查 localStorage 中的用户偏好；无保存值时读取 `window.matchMedia('(prefers-color-scheme: dark)')` 跟随系统
- **手动切换**：更新 `.dark` 类 + 写入 localStorage（仅保存 `'light'` 或 `'dark'`）
- **系统变化**：监听 `matchMedia` 的 `change` 事件，仅当 localStorage 无保存值时自动跟随
- 主题存储无异常处理

## 8. 弹窗

- 新增 / 编辑 / 确认共用同一个 `TaskModal.vue` 组件
- 通过 `mode` prop 区分三种模式：`"create"` / `"edit"` / `"confirm"`
- `create`：表单字段为空，提交 → `App.vue` 调用 `taskStore.create()`
- `edit`：从 `taskStore` 读取当前任务数据预填，提交 → `App.vue` 调用 `taskStore.update()`
- `confirm`：只显示消息文本 + 取消/确认按钮
- 关闭方式：点击遮罩、关闭按钮均可关闭

## 9. 搜索与筛选

- 搜索框在页头右侧，输入即搜索，实时过滤
- 按标题和描述做模糊匹配（`includes()` 大小写不敏感）
- 搜索激活时，所有列仅显示匹配的卡片；列计数变为匹配数
- 清空搜索框恢复完整看板
- 搜索状态不影响数据（纯前端过滤）

## 10. 存储与异常处理

### 10.1 任务数据

- **读取**（`_load`）：`localStorage.getItem()` 包装在 try-catch 中，解析失败返回 `[]`
- **写入**（`_save`）：`localStorage.setItem()` 包装在 try-catch 中。捕获 `QuotaExceededError` 时：① `console.warn` ② `window.dispatchEvent(new CustomEvent('storage:quota-exceeded'))` → Toast 警告
- **创建**（`create`）：先 `push` 到响应式数组，再 `_save()`，写入失败则 `pop()` 回滚
- **更新**（`update`）：先修改并备份旧值，再 `_save()`，写入失败则恢复备份
- **排序**（`reorderColumn`）：先以对象展开（浅拷贝，`{ ...t }`）备份每个任务，再 `_save()`，写入失败则恢复备份
- **删除提交**（`commitDelete`）：先 `splice` 移除，再 `_save()`，写入失败则 `splice` 插回
- **旧格式迁移**（`_migrateOld`）：整个迁移过程在 try-catch 中，失败时静默忽略
- **字段规范化**（`_validate`）：对读取的每条任务补全缺失字段的默认值，不抛出异常

### 10.2 撤销删除机制

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
// 看板三列配置（标签与图标）
const COLUMNS = [
  { status: 'todo',         label: '待办',   icon: '📋' },
  { status: 'in-progress',  label: '进行中', icon: '🔄' },
  { status: 'done',         label: '完成',   icon: '✅' },
]
```

三列定义在 `taskStore.js` 的 `COLUMNS` 常量中，看板由 Vue 组件遍历 `COLUMNS` 渲染。但 Store 层多处写死了三个状态：`STORE_KEYS`、`tasks` 响应式对象的三个固定键、`_validate` 中的状态白名单（`['todo','in-progress','done']`）、`_migrateOld` 的分组逻辑等。添加新列需同步修改这些位置，并非只改 `COLUMNS` 一处。

## 12. 渲染机制

- 列内任务通过 `computed` 链处理：`tasks` → `filtered`（搜索 + 隐藏过滤）→ `sorted`（按 `order` + `createdAt`）
- Vue 的响应式系统自动追踪 `reactive` 数组的变化，仅更新受影响的 DOM
- 拖拽时的列高亮通过 `computed`（`drag.state.targetStatus === props.status`）实现
- 搜索过滤改变 `computed` 返回值，`v-for` 据此增删对应的卡片 DOM 节点（匹配数变化时卡片节点随之创建或移除）
