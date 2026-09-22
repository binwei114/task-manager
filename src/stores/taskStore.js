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
  try {
    localStorage.setItem(STORE_KEYS[status], JSON.stringify(tasks[status]))
    return true
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('存储空间不足，部分数据可能没有保存')
      window.dispatchEvent(new CustomEvent('storage:quota-exceeded', { detail: '存储空间不足，数据未保存' }))
    } else {
      console.error('存储写入失败', e)
    }
    return false
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
    // 先操作内存
    tasks[task.status].push(task)
    // 再持久化，写入失败则回滚
    if (!_save(task.status)) {
      tasks[task.status].pop()
      return null
    }
    return task
  },

  update(id, changes) {
    for (const st of Object.keys(STORE_KEYS)) {
      const idx = tasks[st].findIndex(t => t.id === id)
      if (idx === -1) continue
      const task = tasks[st][idx]
      const oldStatus = task.status
      // 备份旧值以便回滚
      const backup = { ...task, status: task.status }

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
        if (!_save(oldStatus) || !_save(changes.status)) {
          // 回滚状态变更
          tasks[changes.status].pop()
          tasks[st].splice(idx, 0, { ...backup })
          Object.assign(task, backup)
          _save(oldStatus)
          return null
        }
      } else {
        if (!_save(st)) {
          // 回滚原地修改
          Object.assign(task, backup)
          return null
        }
      }
      if (pendingDeletes[id]) this.cancelDelete(id)
      return task
    }
    return null
  },

  updateStatus(id, newStatus) {
    return this.update(id, { status: newStatus })
  },

  markPendingDelete(id) {
    if (pendingDeletes[id]) return
    // 立即从响应式状态移除 → 看板立刻消失，列计数即时更新
    let removedTask = null
    let removedFrom = null
    let removedIdx = -1
    for (const st of Object.keys(STORE_KEYS)) {
      const idx = tasks[st].findIndex(t => t.id === id)
      if (idx !== -1) {
        [removedTask] = tasks[st].splice(idx, 1)
        removedFrom = st
        removedIdx = idx
        break
      }
    }
    if (!removedTask) return

    // 存入撤销缓存，3 秒后从 localStorage 删除
    pendingDeletes[id] = {
      task: removedTask,
      fromStatus: removedFrom,
      fromIndex: removedIdx,
      timer: setTimeout(() => {
        // 到期：清理 localStorage + 缓存
        const st = pendingDeletes[id]?.fromStatus
        if (st) {
          const all = _load(st).filter(t => t.id !== id)
          localStorage.setItem(STORE_KEYS[st], JSON.stringify(all))
        }
        delete pendingDeletes[id]
      }, 3000),
    }
  },

  cancelDelete(id) {
    const record = pendingDeletes[id]
    if (!record) return
    clearTimeout(record.timer)
    // 恢复到原位置
    const list = tasks[record.fromStatus]
    list.splice(record.fromIndex, 0, record.task)
    // 重新编号保持顺序
    list.forEach((t, i) => { t.order = i })
    _save(record.fromStatus)
    delete pendingDeletes[id]
  },

  confirmDelete(id) {
    const record = pendingDeletes[id]
    if (record) {
      clearTimeout(record.timer)
      // 从 localStorage 删除（响应式状态中已不存在）
      const all = _load(record.fromStatus).filter(t => t.id !== id)
      try {
        localStorage.setItem(STORE_KEYS[record.fromStatus], JSON.stringify(all))
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          window.dispatchEvent(new CustomEvent('storage:quota-exceeded', { detail: '存储空间不足，数据未保存' }))
        }
      }
      delete pendingDeletes[id]
    }
  },

  reorderColumn(status, orderedIds) {
    const map = {}
    // 深拷贝每个任务对象，回滚时 order 值不受后续修改影响
    const backup = tasks[status].map(t => ({ ...t }))
    tasks[status].forEach(t => { map[t.id] = t })
    tasks[status] = orderedIds.map((id, i) => { map[id].order = i; return map[id] })
    if (!_save(status)) {
      // 写入失败 → 回滚
      tasks[status] = backup
    }
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