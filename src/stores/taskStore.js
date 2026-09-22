import { reactive, computed } from 'vue'

/* ── 常量 ──────────────────────────────────────── */
const STORE_KEYS = {
  todo: 'taskmanager_todo',
  'in-progress': 'taskmanager_in-progress',
  done: 'taskmanager_done',
}
const OLD_KEY = 'taskmanager_tasks'

export const COLUMNS = [
  { status: 'todo',         label: '待办',   icon: '📋' },
  { status: 'in-progress',  label: '进行中', icon: '🔄' },
  { status: 'done',         label: '完成',   icon: '✅' },
]

/* ── 响应式 Store ──────────────────────────────── */
const tasks = reactive({ todo: [], 'in-progress': [], done: [] })
const pendingDeletes = {}

function _load(status) {
  try { return JSON.parse(localStorage.getItem(STORE_KEYS[status]) || '[]') }
  catch { return [] }
}
function _save(status) {
  try { localStorage.setItem(STORE_KEYS[status], JSON.stringify(tasks[status])) }
  catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('存储空间不足，部分数据可能没有保存')
      // 触发一个自定义 DOM 事件供 Toast 捕获
      window.dispatchEvent(new CustomEvent('storage:quota-exceeded', { detail: '存储空间不足，部分数据可能未保存' }))
    } else {
      console.error('存储写入失败', e)
    }
  }
}
function _validate(t) {
  return {
    id: t.id || crypto.randomUUID(),
    title: t.title || '',
    description: t.description || '',
    status: ['todo','in-progress','done'].includes(t.status) ? t.status : 'todo',
    priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium',
    order: typeof t.order === 'number' ? t.order : 0,
    dueDate: t.dueDate || null,
    tags: Array.isArray(t.tags) ? t.tags : [],
    createdAt: t.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
function _nextOrder(status) {
  const list = tasks[status]
  return list.length === 0 ? 0 : Math.max(...list.map(t => t.order)) + 1
}

/* ── Store ──────────────────────────────────────── */
export const taskStore = {
  init() {
    _migrateOld()
    for (const st of Object.keys(STORE_KEYS)) {
      tasks[st] = _load(st).map(_validate)
    }
  },

  getByStatus(status) { return tasks[status] ?? [] },
  getAll() { return [...tasks.todo, ...tasks['in-progress'], ...tasks.done] },
  getById(id) {
    for (const st of Object.keys(STORE_KEYS)) {
      const found = tasks[st].find(t => t.id === id)
      if (found) return found
    }
    return null
  },

  create(data) {
    const now = new Date().toISOString()
    const task = _validate({
      id: crypto.randomUUID(),
      title: data.title.trim(),
      description: (data.description || '').trim(),
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      order: _nextOrder(data.status || 'todo'),
      dueDate: data.dueDate || null,
      createdAt: now,
      updatedAt: now,
    })
    tasks[task.status].push(task)
    _save(task.status)
    return task
  },

  update(id, changes) {
    for (const st of Object.keys(STORE_KEYS)) {
      const idx = tasks[st].findIndex(t => t.id === id)
      if (idx === -1) continue
      const task = tasks[st][idx]
      const oldStatus = task.status

      if (changes.title !== undefined) task.title = changes.title.trim()
      if (changes.description !== undefined) task.description = (changes.description || '').trim()
      if (changes.priority !== undefined) task.priority = changes.priority
      if (changes.dueDate !== undefined) task.dueDate = changes.dueDate || null
      task.updatedAt = new Date().toISOString()

      if (changes.status && changes.status !== oldStatus) {
        task.status = changes.status
        task.order = _nextOrder(changes.status)
        tasks[st].splice(idx, 1)
        tasks[changes.status].push(task)
        _save(oldStatus)
        _save(changes.status)
      } else {
        _save(st)
      }
      if (pendingDeletes[id]) cancelDelete(id)
      return task
    }
    return null
  },

  updateStatus(id, newStatus) {
    return this.update(id, { status: newStatus })
  },

  markPendingDelete(id) {
    if (pendingDeletes[id]) return
    pendingDeletes[id] = setTimeout(() => this.confirmDelete(id), 3000)
  },
  cancelDelete(id) {
    if (pendingDeletes[id]) { clearTimeout(pendingDeletes[id]); delete pendingDeletes[id] }
  },
  confirmDelete(id) {
    this.cancelDelete(id)
    for (const st of Object.keys(STORE_KEYS)) {
      const idx = tasks[st].findIndex(t => t.id === id)
      if (idx !== -1) { tasks[st].splice(idx, 1); _save(st); return }
    }
  },

  reorderColumn(status, orderedIds) {
    const map = {}
    tasks[status].forEach(t => { map[t.id] = t })
    tasks[status] = orderedIds.map((id, i) => { map[id].order = i; return map[id] })
    _save(status)
  },

  hasPendingDelete(id) { return !!pendingDeletes[id] },
}

function _migrateOld() {
  try {
    const old = localStorage.getItem(OLD_KEY)
    if (!old) return
    const arr = JSON.parse(old)
    if (!Array.isArray(arr)) return
    const buckets = { todo: [], 'in-progress': [], done: [] }
    arr.forEach(t => {
      const st = ['todo','in-progress','done'].includes(t.status) ? t.status : 'todo'
      buckets[st].push(_validate(t))
    })
    for (const st of Object.keys(buckets))
      localStorage.setItem(STORE_KEYS[st], JSON.stringify(buckets[st]))
    localStorage.removeItem(OLD_KEY)
  } catch {}
}

export function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(task.dueDate + 'T23:59:59') < today
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}