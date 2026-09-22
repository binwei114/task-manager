/**
 * store.js — 数据层：localStorage 读写 + CRUD 操作
 * 存储策略：按状态拆分三个 key
 * 事件：所有写操作后通过 bus.emit 通知视图
 */
const STORE_KEYS = {
  todo: 'taskmanager_todo',
  'in-progress': 'taskmanager_in-progress',
  done: 'taskmanager_done',
}
const OLD_KEY = 'taskmanager_tasks'

/** 内存缓存：{ status: [task, ...] } */
let cache = { todo: [], 'in-progress': [], done: [] }
/** pending 删除定时器映射 */
const pendingDeletes = {}

const store = {
  // ── 初始化 ──────────────────────────────────────────────
  init() {
    this._migrateOldData()
    for (const st of Object.keys(STORE_KEYS)) {
      cache[st] = this._load(st)
    }
    // 校验并修补缺失字段
    for (const st of Object.keys(cache)) {
      cache[st] = cache[st].map(t => this._validate(t))
    }
    this._saveAll()
    return cache
  },

  // ── 查询 ────────────────────────────────────────────────
  getTasks(status) {
    return cache[status] ?? []
  },
  getAllTasks() {
    return [...cache.todo, ...cache['in-progress'], ...cache.done]
  },
  getTask(id) {
    for (const st of Object.keys(cache)) {
      const found = cache[st].find(t => t.id === id)
      if (found) return found
    }
    return null
  },

  // ── 创建 ──────────────────────────────────────────────
  createTask(data) {
    const now = new Date().toISOString()
    const task = this._validate({
      id: crypto.randomUUID(),
      title: data.title.trim(),
      description: (data.description || '').trim(),
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      order: this._nextOrder(data.status || 'todo'),
      dueDate: data.dueDate || null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    })
    cache[task.status].push(task)
    this._saveStatus(task.status)
    bus.emit('task:created', { task })
    return task
  },

  // ── 更新 ──────────────────────────────────────────────
  updateTask(id, changes) {
    for (const st of Object.keys(cache)) {
      const idx = cache[st].findIndex(t => t.id === id)
      if (idx === -1) continue

      const task = cache[st][idx]
      const oldStatus = task.status

      if (changes.title !== undefined) task.title = changes.title.trim()
      if (changes.description !== undefined) task.description = (changes.description || '').trim()
      if (changes.priority !== undefined) task.priority = changes.priority
      if (changes.dueDate !== undefined) task.dueDate = changes.dueDate || null
      task.updatedAt = new Date().toISOString()

      // 状态变更→移动卡片到新列
      if (changes.status && changes.status !== oldStatus) {
        task.status = changes.status
        task.order = this._nextOrder(changes.status)
        cache[st].splice(idx, 1)
        cache[changes.status].push(task)
        this._saveStatus(oldStatus)
        this._saveStatus(changes.status)
        bus.emit('task:status-changed', {
          id, fromStatus: oldStatus, toStatus: changes.status, order: task.order,
        })
      } else {
        this._saveStatus(st)
      }

      // 如果在 pending 删除状态，自动取消
      if (pendingDeletes[id]) this.cancelDelete(id)

      bus.emit('task:updated', { id, changes })
      return task
    }
    return null
  },

  // ── 撤销删除机制 ──────────────────────────────────────
  markPendingDelete(id) {
    if (pendingDeletes[id]) return
    pendingDeletes[id] = setTimeout(() => {
      this.confirmDelete(id)
    }, 3000)
    bus.emit('task:delete-pending', { id })
  },

  cancelDelete(id) {
    if (pendingDeletes[id]) {
      clearTimeout(pendingDeletes[id])
      delete pendingDeletes[id]
      bus.emit('task:delete-cancelled', { id })
    }
  },

  confirmDelete(id) {
    if (pendingDeletes[id]) {
      clearTimeout(pendingDeletes[id])
      delete pendingDeletes[id]
    }
    for (const st of Object.keys(cache)) {
      const idx = cache[st].findIndex(t => t.id === id)
      if (idx !== -1) {
        cache[st].splice(idx, 1)
        this._saveStatus(st)
        bus.emit('task:deleted', { id })
        return
      }
    }
  },

  // ── 排序 ──────────────────────────────────────────────
  reorderTask(id, targetStatus) {
    const list = cache[targetStatus]
    const idx = list.findIndex(t => t.id === id)
    if (idx === -1) return
    list.forEach((t, i) => { t.order = i })
    this._saveStatus(targetStatus)
    bus.emit('task:updated', { id, changes: { order: list[idx].order } })
  },

  reorderColumn(status, orderedIds) {
    const list = cache[status]
    const map = {}
    list.forEach(t => { map[t.id] = t })
    cache[status] = orderedIds.map((id, i) => {
      map[id].order = i
      return map[id]
    })
    this._saveStatus(status)
    bus.emit('task:updated', { id: 'all', changes: { status } })
  },

  updateTaskStatus(id, newStatus) {
    return this.updateTask(id, { status: newStatus })
  },

  // ── 私有方法 ──────────────────────────────────────────
  _load(status) {
    try {
      const raw = localStorage.getItem(STORE_KEYS[status])
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  },

  _saveStatus(status) {
    try {
      localStorage.setItem(STORE_KEYS[status], JSON.stringify(cache[status]))
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        bus.emit('storage:quota-exceeded', { message: '存储空间不足，建议导出备份' })
      }
    }
  },

  _saveAll() {
    for (const st of Object.keys(STORE_KEYS)) this._saveStatus(st)
  },

  _nextOrder(status) {
    const list = cache[status]
    return list.length === 0 ? 0 : Math.max(...list.map(t => t.order)) + 1
  },

  _validate(task) {
    return {
      id: task.id || crypto.randomUUID(),
      title: task.title || '',
      description: task.description || '',
      status: ['todo', 'in-progress', 'done'].includes(task.status) ? task.status : 'todo',
      priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
      order: typeof task.order === 'number' ? task.order : 0,
      dueDate: task.dueDate || null,
      tags: Array.isArray(task.tags) ? task.tags : [],
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString(),
    }
  },

  _migrateOldData() {
    try {
      const old = localStorage.getItem(OLD_KEY)
      if (!old) return
      const tasks = JSON.parse(old)
      if (!Array.isArray(tasks)) return
      const buckets = { todo: [], 'in-progress': [], done: [] }
      tasks.forEach(t => {
        const st = ['todo', 'in-progress', 'done'].includes(t.status) ? t.status : 'todo'
        buckets[st].push(this._validate(t))
      })
      for (const st of Object.keys(buckets)) {
        localStorage.setItem(STORE_KEYS[st], JSON.stringify(buckets[st]))
      }
      localStorage.removeItem(OLD_KEY)
    } catch { /* 忽略迁移错误 */ }
  },
}