/**
 * useDrag.js — Pointer Events 拖拽控制器（单例状态）
 *
 * 职责：
 *   1. 管理拖拽全过程（pointerdown → pointermove → pointerup / Esc）
 *   2. 创建并移动跟随指针的浮层卡片
 *   3. 通过 reactive 状态通知 Column 高亮目标列
 *   4. 计算插入位置，在有效放下后调用 store
 */

import { reactive, readonly } from 'vue'
import { taskStore } from '../stores/taskStore.js'

/* ── 拖拽状态（响应式，Column 通过注入读取） ─────── */
const state = reactive({
  isDragging: false,
  sourceId: null,
  sourceStatus: null,
  /** 目标列 status（供 Column 高亮） */
  targetStatus: null,
  /** 拖拽结束信号（Column watch 到后恢复高亮状态） */
  ended: 0,
})

/* ── 非响应式私有状态 ─────────────────────────────── */
let sourceEl = null          // 源卡片 DOM 元素
let sourceIndex = -1         // 源卡片在源列中的索引
let startX = 0               // pointerdown 时的 clientX
let startY = 0               // pointerdown 时的 clientY
let hasMoved = false         // 是否超过 5px 阈值
let floatingEl = null        // 浮层 DOM 元素
let pointerId = null         // pointer capture ID

/* ── 浮层创建 ─────────────────────────────────────── */
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
  if (floatingEl) {
    floatingEl.remove()
    floatingEl = null
  }
}

/* ── 插入位置计算 ─────────────────────────────────── */
function calcInsertPos(x, y) {
  // 用 elementsFromPoint 找 .task-list 容器
  const els = document.elementsFromPoint(x, y)
  let listEl = null
  for (const el of els) {
    if (el.matches('.task-list') || el.closest('.task-list')) {
      listEl = el.closest('.task-list') || el
      break
    }
  }
  if (!listEl) return { status: null, insertIdx: -1 }

  const status = listEl.getAttribute('data-status')
  if (!status) return { status: null, insertIdx: -1 }

  const cards = [...listEl.querySelectorAll('[data-task-id]')]
  if (cards.length === 0) return { status, insertIdx: 0 }

  let insertIdx = cards.length
  const listRect = listEl.getBoundingClientRect()
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect()
    if (y < rect.top + rect.height / 2) {
      insertIdx = i
      break
    }
  }
  return { status, insertIdx }
}

/* ── 提交放置 ─────────────────────────────────────── */
function commitDrop(x, y) {
  const { status: targetStatus, insertIdx } = calcInsertPos(x, y)
  if (!targetStatus || !state.sourceId || !state.sourceStatus) return

  const id = state.sourceId

  if (targetStatus === state.sourceStatus) {
    // 同列排序
    const allIds = [...taskStore.getByStatus(targetStatus)]
      .sort((a, b) => a.order - b.order || (b.createdAt > a.createdAt ? 1 : -1))
      .map(t => t.id)
    const withoutCurrent = allIds.filter(i => i !== id)

    // 如果放到原位置 → 不提交
    const origPos = withoutCurrent.length > 0 ? allIds.indexOf(id) : 0
    let actualIdx = insertIdx
    // adjust for the fact that withoutCurrent doesn't have the card
    if (actualIdx > origPos) actualIdx--
    if (actualIdx === origPos || actualIdx < 0) return

    const spliceIdx = Math.min(actualIdx, withoutCurrent.length)
    withoutCurrent.splice(spliceIdx, 0, id)
    taskStore.reorderColumn(targetStatus, withoutCurrent)
  } else {
    // 跨列移动
    taskStore.updateStatus(id, targetStatus)
  }
}

/* ── 结束拖拽（所有退出路径） ─────────────────────── */
function endDrag(commit = false, x = 0, y = 0) {
  if (!state.isDragging) return

  // 1) 解除 pointer capture，移除 window 监听
  if (sourceEl && pointerId !== null) {
    try { sourceEl.releasePointerCapture(pointerId) } catch {}
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onKeyDown)
  pointerId = null

  // 2) 提交或取消
  if (commit && state.sourceId) {
    commitDrop(x, y)
  }

  // 3) 清除浮层
  removeFloating()

  // 4) 恢复源卡片
  if (sourceEl) {
    sourceEl.classList.remove('drag-source-hidden')
    sourceEl = null
  }

  // 5) 重置状态
  state.isDragging = false
  state.targetStatus = null
  state.ended++
  state.sourceId = null
  state.sourceStatus = null
  hasMoved = false
  startX = 0
  startY = 0
}

/* ── 事件处理 ─────────────────────────────────────── */
function onPointerMove(e) {
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (!hasMoved) {
    if (dx * dx + dy * dy < 25) return // 5px 阈值
    hasMoved = true
    // ★ 绑定到 window 后再隐藏源卡片 ★
    state.isDragging = true
    state.sourceId = sourceEl?.getAttribute('data-task-id') || null
    if (sourceEl) sourceEl.classList.add('drag-source-hidden')
    floatingEl = createFloating(sourceEl, e.clientX, e.clientY)
  }

  // 更新浮层位置
  moveFloating(e.clientX, e.clientY)

  // 检测目标列
  const { status } = calcInsertPos(e.clientX, e.clientY)
  state.targetStatus = status
}

function onPointerUp(e) {
  if (hasMoved) {
    endDrag(true, e.clientX, e.clientY)
  } else {
    // 未超过阈值 → 普通点击，让 click 事件处理
    endDrag(false)
  }
}

function onPointerCancel() {
  endDrag(false) // 取消
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    endDrag(false)
  }
}

/* ── 公开 API ─────────────────────────────────────── */
let emitCardClick = null // 由 KanbanBoard 设置

export function useDrag() {
  /** TaskCard 调用：mouse pointerdown */
  function pointerDown(e, cardEl) {
    // 仅响应鼠标（忽略触控笔和手指）
    if (e.pointerType !== 'mouse') return
    // 忽略触屏菜单按钮点击
    if (e.target.closest('.card-menu-btn, .touch-menu, .touch-menu-item')) return

    const taskId = cardEl.getAttribute('data-task-id')
    if (!taskId) return

    const task = taskStore.getById(taskId)
    if (!task) return

    // 记录初始状态
    sourceEl = cardEl
    sourceIndex = -1
    startX = e.clientX
    startY = e.clientY
    hasMoved = false
    pointerId = e.pointerId
    state.sourceStatus = task.status
    state.sourceId = null // 待 hasMoved 后设置

    // ★ 先绑定 window 事件，再处理后续逻辑 ★
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeyDown)

    // capture pointer 防止鼠标离开卡片后丢失事件
    try { cardEl.setPointerCapture(e.pointerId) } catch {}
  }

  return {
    state: readonly(state),
    pointerDown,
  }
}

/** 供 KanbanBoard 设置外部点击回调 */
export function setEmitCardClick(fn) {
  emitCardClick = fn
}