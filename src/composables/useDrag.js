/**
 * useDrag.js — Pointer Events 拖拽控制器（单例状态）
 *
 * 设计要点：
 *   - pointerdown 绑定在 TaskCard，开始记录初始位置
 *   - 移动超 5px 阈值后，事件绑定升级到 document 级别
 *     （不设 setPointerCapture，避免事件被重定向丢失）
 *   - 浮层卡片 pointer-events: none，不阻挡命中测试
 *   - document.elementsFromPoint() 检测目标列和插入位置
 *   - 拖拽结束后设 dragJustEnded 标记，在下一个 tick 阻止 click
 */

import { reactive, readonly } from 'vue'
import { taskStore } from '../stores/taskStore.js'

/* ── 响应式状态（Column 通过注入读取） ─────────────── */
const state = reactive({
  isDragging: false,
  sourceId: null,
  sourceStatus: null,
  targetStatus: null,  // 供 Column 高亮
  ended: 0,            // 递增信号，Column watch 后清除高亮
})

/* ── 私有状态 ──────────────────────────────────────── */
let sourceEl = null
let startX = 0
let startY = 0
let hasMoved = false
let floatingEl = null
let dragJustEnded = false  // 阻止拖拽后的 click

/* ── 浮层 ──────────────────────────────────────────── */
function createFloating(cardEl, x, y) {
  const clone = cardEl.cloneNode(true)
  clone.className = 'drag-floating-card'
  clone.style.position = 'fixed'
  clone.style.left = (x - 20) + 'px'
  clone.style.top = (y - 10) + 'px'
  clone.style.width = cardEl.offsetWidth + 'px'
  clone.style.pointerEvents = 'none'
  clone.style.zIndex = '9999'
  clone.style.willChange = 'transform'
  document.body.appendChild(clone)
  return clone
}

function moveFloating(x, y) {
  if (!floatingEl) return
  floatingEl.style.left = (x - 20) + 'px'
  floatingEl.style.top = (y - 10) + 'px'
}

function removeFloating() {
  floatingEl?.remove()
  floatingEl = null
}

/* ── 命中测试 ──────────────────────────────────────── */
function findDropTarget(x, y) {
  const els = document.elementsFromPoint(x, y)
  let listEl = null
  for (const el of els) {
    const list = el.matches('.task-list') ? el : el.closest('.task-list')
    if (list) { listEl = list; break }
  }
  if (!listEl) return { status: null, insertIdx: -1 }

  const status = listEl.getAttribute('data-status')
  if (!status) return { status: null, insertIdx: -1 }

  const cards = [...listEl.querySelectorAll('[data-task-id]')]
  if (cards.length === 0) return { status, insertIdx: 0 }

  let insertIdx = cards.length
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect()
    if (y < rect.top + rect.height / 2) { insertIdx = i; break }
  }
  return { status, insertIdx }
}

/* ── 提交 ──────────────────────────────────────────── */
function commitDrop(x, y) {
  const { status: targetStatus, insertIdx } = findDropTarget(x, y)
  if (!targetStatus || !state.sourceId || !state.sourceStatus) return

  const id = state.sourceId

  if (targetStatus === state.sourceStatus) {
    // 同列排序
    const allIds = [...taskStore.getByStatus(targetStatus)]
      .sort((a, b) => a.order - b.order || (b.createdAt > a.createdAt ? 1 : -1))
      .map(t => t.id)
    const withoutCurrent = allIds.filter(i => i !== id)
    const origPos = allIds.indexOf(id)
    let actualIdx = insertIdx
    if (actualIdx > origPos) actualIdx--
    if (actualIdx === origPos || actualIdx < 0) return
    withoutCurrent.splice(Math.min(actualIdx, withoutCurrent.length), 0, id)
    taskStore.reorderColumn(targetStatus, withoutCurrent)
  } else {
    taskStore.updateStatus(id, targetStatus)
  }
}

/* ── document 级事件处理 ─────────────────────────────── */
function onPointerMove(e) {
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (!hasMoved) {
    if (dx * dx + dy * dy < 25) return
    hasMoved = true
    state.isDragging = true
    state.sourceId = sourceEl?.getAttribute('data-task-id') || null
    if (sourceEl) sourceEl.classList.add('drag-source-hidden')
    floatingEl = createFloating(sourceEl, e.clientX, e.clientY)
  }

  moveFloating(e.clientX, e.clientY)

  const { status } = findDropTarget(e.clientX, e.clientY)
  state.targetStatus = status
}

function onPointerUp(e) {
  cleanup()
  if (hasMoved) {
    dragJustEnded = true
    // 下一个 tick 清除标记，让可能的 click 被阻止
    setTimeout(() => { dragJustEnded = false }, 0)
    commitDrop(e.clientX, e.clientY)
  }
  // hasMoved === false → 普通点击，不做任何事，让 click 事件正常触发
}

function onPointerCancel() {
  cleanup()
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    cleanup()
  }
}

/* ── 清理（所有退出路径共享） ────────────────────────── */
function cleanup() {
  removeFloating()
  sourceEl?.classList.remove('drag-source-hidden')
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerCancel)
  document.removeEventListener('keydown', onKeyDown)

  state.isDragging = false
  state.targetStatus = null
  state.ended++
  state.sourceId = null
  state.sourceStatus = null

  sourceEl = null
  hasMoved = false
  startX = 0
  startY = 0
}

/* ── 公开 API ──────────────────────────────────────── */
export function useDrag() {
  function pointerDown(e, cardEl) {
    if (e.pointerType !== 'mouse') return
    if (e.target.closest('.card-menu-btn, .touch-menu, .touch-menu-item')) return

    const taskId = cardEl.getAttribute('data-task-id')
    const task = taskId ? taskStore.getById(taskId) : null
    if (!task) return

    // 保存初始状态
    sourceEl = cardEl
    startX = e.clientX
    startY = e.clientY
    hasMoved = false
    state.sourceStatus = task.status
    state.sourceId = null

    // ★ 绑定到 document —— 最可靠，不依赖 pointer capture ★
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    document.addEventListener('keydown', onKeyDown)
  }

  return {
    state: readonly(state),
    pointerDown,
    /** TaskCard 检测此标记来阻止拖拽后的 click */
    get dragJustEnded() { return dragJustEnded },
  }
}