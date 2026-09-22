/**
 * board.js — 看板视图：渲染三列、拖拽处理、触屏降级
 */
const COLUMNS = [
  { status: 'todo',         label: '待办',   icon: '📋' },
  { status: 'in-progress',  label: '进行中', icon: '🔄' },
  { status: 'done',         label: '完成',   icon: '✅' },
]

const PRIORITY_MAP = { high: '🔴', medium: '🟡', low: '🟢' }
const PRIORITY_CLASS = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }

const board = (() => {
  let container = null
  let draggedId = null
  const isTouchDevice = 'ontouchstart' in window

  // ── 渲染 ──────────────────────────────────────────────
  function render() {
    if (!container) {
      container = document.getElementById('kanbanBoard')
      if (!container) return
    }
    container.innerHTML = ''
    COLUMNS.forEach(col => {
      const tasks = store.getTasks(col.status)
      const overdueCount = tasks.filter(t => isOverdue(t)).length
      const el = document.createElement('div')
      el.className = 'column'
      el.setAttribute('data-status', col.status)

      const countSuffix = overdueCount > 0 ? ` ⚠️${overdueCount}逾期` : ''
      el.innerHTML = `
        <div class="column-header">
          <span>${col.icon} ${col.label} (${tasks.length})${countSuffix}</span>
        </div>
        <div class="task-list" data-status="${col.status}"></div>
      `
      container.appendChild(el)
      const list = el.querySelector('.task-list')
      renderTasks(list, tasks)
    })
  }

  function renderTasks(listEl, tasks) {
    // 按 order 排序，再按 createdAt 降序
    const sorted = [...tasks].sort((a, b) => a.order - b.order || (b.createdAt > a.createdAt ? 1 : -1))
    listEl.innerHTML = ''
    sorted.forEach(task => {
      const card = createCard(task)
      listEl.appendChild(card)
    })
  }

  function createCard(task) {
    const card = document.createElement('div')
    card.className = `task-card ${PRIORITY_CLASS[task.priority]}`
    card.setAttribute('data-id', task.id)
    card.setAttribute('draggable', !isTouchDevice)
    card.setAttribute('role', 'listitem')
    card.setAttribute('tabindex', '0')

    const due = task.dueDate ? formatDate(task.dueDate) : ''
    const overdue = isOverdue(task)

    card.innerHTML = `
      <div class="card-priority ${PRIORITY_CLASS[task.priority]}">${PRIORITY_MAP[task.priority]}</div>
      <div class="card-body">
        <div class="card-title">${escHtml(task.title)}</div>
        ${task.description ? `<div class="card-desc">${escHtml(task.description)}</div>` : ''}
        <div class="card-meta">
          ${due ? `<span class="card-due ${overdue ? 'overdue' : ''}">${overdue ? '⚠️ ' : '📅 '}${due}</span>` : ''}
          <span class="card-date">${formatCreated(task.createdAt)}</span>
        </div>
      </div>
      ${isTouchDevice ? `<button class="card-menu-btn" data-id="${task.id}" aria-label="操作菜单">⋮</button>` : ''}
    `

    // 点击卡片 → 编辑
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-menu-btn')) return
      modal.openEdit(task.id)
    })

    // 键盘操作
    card.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault()
        moveTask(task.id, nextStatus(task.status))
      } else if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        moveTask(task.id, prevStatus(task.status))
      }
    })

    // 桌面拖拽事件
    if (!isTouchDevice) bindDragEvents(card, task.id)
    // 触屏菜单
    if (isTouchDevice) bindTouchMenu(card, task.id)

    return card
  }

  // ── 拖拽事件 ──────────────────────────────────────────
  function bindDragEvents(card, id) {
    card.addEventListener('dragstart', (e) => {
      draggedId = id
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      card.classList.add('dragging')
    })
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging')
      document.querySelectorAll('.task-list').forEach(el => el.classList.remove('drag-over'))
      draggedId = null
    })
  }

  function bindDropTargets() {
    document.querySelectorAll('.task-list').forEach(list => {
      // 避免重复绑定
      if (list.dataset.dropBound) return
      list.dataset.dropBound = 'true'

      list.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      })

      list.addEventListener('dragenter', (e) => {
        e.preventDefault()
        list.classList.add('drag-over')
      })

      list.addEventListener('dragleave', () => {
        list.classList.remove('drag-over')
      })

      list.addEventListener('drop', (e) => {
        e.preventDefault()
        list.classList.remove('drag-over')
        const id = e.dataTransfer.getData('text/plain') || draggedId
        if (!id) return
        const newStatus = list.getAttribute('data-status')
        if (!newStatus) return

        // 同列排序
        const currentTask = store.getTask(id)
        if (currentTask && currentTask.status === newStatus) {
          // 同列内排序：根据落点位置调整
          const cards = [...list.querySelectorAll('.task-card')]
          const targetCard = cards.find(c => c.getAttribute('data-id') === id)
          if (targetCard) {
            const rect = list.getBoundingClientRect()
            const offsetY = e.clientY - rect.top
            const children = [...list.children]
            let insertIdx = children.length
            for (let i = 0; i < children.length; i++) {
              const childRect = children[i].getBoundingClientRect()
              const childMid = childRect.top + childRect.height / 2 - rect.top
              if (offsetY < childMid) {
                insertIdx = i
                break
              }
            }
            // 从 DOM 中移除再插入新位置
            const allIds = cards.map(c => c.getAttribute('data-id')).filter(Boolean)
            const withoutCurrent = allIds.filter(cid => cid !== id)
            withoutCurrent.splice(insertIdx > allIds.indexOf(id) ? Math.min(insertIdx, withoutCurrent.length) : insertIdx, 0, id)
            store.reorderColumn(newStatus, withoutCurrent)
          }
        } else {
          // 跨列
          moveTask(id, newStatus)
        }
      })
    })
  }

  // ── 触屏降级 ──────────────────────────────────────────
  function bindTouchMenu(card, id) {
    const btn = card.querySelector('.card-menu-btn')
    if (!btn) return
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      showTouchMenu(id, btn)
    })
  }

  function showTouchMenu(id, anchorEl) {
    const existing = document.querySelector('.touch-menu')
    if (existing) existing.remove()

    const menu = document.createElement('div')
    menu.className = 'touch-menu'
    menu.innerHTML = COLUMNS.map(col =>
      `<button class="touch-menu-item" data-status="${col.status}">移动到「${col.label}」</button>`
    ).join('')

    const rect = anchorEl.getBoundingClientRect()
    menu.style.top = (rect.bottom + 4) + 'px'
    menu.style.right = (window.innerWidth - rect.right) + 'px'
    document.body.appendChild(menu)

    menu.querySelectorAll('.touch-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        moveTask(id, btn.dataset.status)
        menu.remove()
      })
    })

    // 点击其他区域关闭
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true })
    }, 0)
  }

  // ── 工具函数 ──────────────────────────────────────────
  function moveTask(id, newStatus) {
    if (!newStatus) return
    const task = store.getTask(id)
    if (!task || task.status === newStatus) return
    store.updateTaskStatus(id, newStatus)
  }

  function nextStatus(s) {
    const idx = COLUMNS.findIndex(c => c.status === s)
    return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].status : s
  }
  function prevStatus(s) {
    const idx = COLUMNS.findIndex(c => c.status === s)
    return idx > 0 ? COLUMNS[idx - 1].status : s
  }

  function isOverdue(task) {
    if (!task.dueDate || task.status === 'done') return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(task.dueDate + 'T23:59:59')
    return due < today
  }

  function formatDate(iso) {
    if (!iso) return ''
    const d = new Date(iso + 'T00:00:00')
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function formatCreated(iso) {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function escHtml(s) {
    const div = document.createElement('div')
    div.textContent = s
    return div.innerHTML
  }

  // ── 搜索过滤 ──────────────────────────────────────────
  function applyFilter(keyword) {
    const q = keyword.trim().toLowerCase()
    document.querySelectorAll('.column').forEach(col => {
      const status = col.getAttribute('data-status')
      const allTasks = store.getTasks(status)
      const filtered = q ? allTasks.filter(t =>
        t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      ) : allTasks
      const list = col.querySelector('.task-list')
      if (list) renderTasks(list, filtered)
      // 更新计数
      const header = col.querySelector('.column-header span')
      const overdueCount = filtered.filter(t => isOverdue(t)).length
      const colDef = COLUMNS.find(c => c.status === status)
      const countSuffix = overdueCount > 0 ? ` ⚠️${overdueCount}逾期` : ''
      if (header && colDef) {
        header.textContent = `${colDef.icon} ${colDef.label} (${filtered.length})${countSuffix}`
      }
    })
  }

  // ── 公共 API ──────────────────────────────────────────
  return {
    render() {
      render()
      if (!isTouchDevice) bindDropTargets()
    },

    refresh() {
      render()
      if (!isTouchDevice) bindDropTargets()
      // 恢复搜索状态
      const searchVal = document.getElementById('searchBox')?.value
      if (searchVal) this.applyFilter(searchVal)
    },

    applyFilter,
    isOverdue,
  }
})()