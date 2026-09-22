/**
 * app.js — 应用入口：初始化、事件订阅
 */
const app = {
  init() {
    // 1. 初始化数据层
    store.init()

    // 2. 初始化主题
    theme.init()

    // 3. 初始化弹窗
    modal.init()

    // 4. 初始渲染看板
    board.render()

    // 5. 初始化搜索
    search.init()

    // 6. 事件总线订阅
    this._bindEvents()

    // 7. UI 按钮事件
    document.getElementById('addTaskBtn')?.addEventListener('click', () => modal.openCreate())
    document.getElementById('themeToggle')?.addEventListener('click', () => theme.toggle())

    // 8. 首次空状态 → 创建示例任务
    this._maybeSeedTasks()
  },

  _bindEvents() {
    // 数据变更 → 刷新看板
    bus.on('task:created', () => board.refresh())
    bus.on('task:updated', () => board.refresh())
    bus.on('task:deleted', () => board.refresh())
    bus.on('task:status-changed', () => board.refresh())
    bus.on('task:delete-pending', () => board.refresh())
    bus.on('task:delete-cancelled', () => board.refresh())

    // 存储异常 → toast
    bus.on('storage:quota-exceeded', (data) => {
      showToast(data.message, 'warning')
    })

    // Toast 撤销
    bus.on('task:delete-pending', (data) => {
      const task = store.getTask(data.id)
      showToast(`已删除「${task ? task.title : ''}」`, 'undo', () => {
        store.cancelDelete(data.id)
      })
    })
  },

  _maybeSeedTasks() {
    const all = store.getAllTasks()
    if (all.length > 0) return

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fmt = d => d.toISOString().split('T')[0]

    store.createTask({
      title: '欢迎使用 Task Manager',
      description: '试试拖拽我到其他列 🚀',
      priority: 'low',
      status: 'todo',
    })
    store.createTask({
      title: '添加第一个真实任务',
      description: '点击上方「新建任务」开始',
      priority: 'medium',
      status: 'todo',
      dueDate: fmt(tomorrow),
    })
    store.createTask({
      title: '探索深色模式',
      description: '点击页头的 🌙 按钮切换',
      priority: 'low',
      status: 'done',
    })
  },
}

// ── Toast 通知 ──────────────────────────────────────────
function showToast(message, type = 'info', onUndo) {
  const container = document.getElementById('toastContainer')
  if (!container) return

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <span class="toast-msg">${message}</span>
    ${onUndo ? '<button class="toast-undo">撤销</button>' : ''}
  `
  container.appendChild(toast)

  if (onUndo) {
    toast.querySelector('.toast-undo')?.addEventListener('click', () => {
      onUndo()
      toast.remove()
    })
  }

  // 3 秒后自动消失
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast-fade')
      setTimeout(() => toast.remove(), 300)
    }
  }, 3000)
}

// DOM 就绪后启动
document.addEventListener('DOMContentLoaded', () => app.init())