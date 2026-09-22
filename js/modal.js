/**
 * modal.js — 任务编辑弹窗：新增 / 编辑 / 确认
 * 三种模式通过 data-mode 切换：create / edit / confirm
 */
const modal = (() => {
  let overlay = null
  let content = null
  let formView = null
  let confirmView = null
  let currentMode = 'create'
  let editingId = null

  function init() {
    overlay = document.getElementById('taskModal')
    content = overlay?.querySelector('.modal-content')
    formView = overlay?.querySelector('.form-view')
    confirmView = overlay?.querySelector('.confirm-view')

    // 关闭事件
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) close()
    })
    overlay?.querySelector('.modal-close')?.addEventListener('click', close)

    // 表单提交
    overlay?.querySelector('#taskForm')?.addEventListener('submit', (e) => {
      e.preventDefault()
      handleSubmit()
    })

    // 确认按钮
    overlay?.querySelector('.confirm-btn')?.addEventListener('click', () => {
      const id = overlay.dataset.confirmId
      if (id) store.confirmDelete(id)
      close()
    })

    // 取消按钮
    overlay?.querySelector('.cancel-btn')?.addEventListener('click', close)
  }

  // ── 打开 ──────────────────────────────────────────────
  function openCreate() {
    currentMode = 'create'
    editingId = null
    showView('form')
    overlay.querySelector('#modalTitle').textContent = '新建任务'
    overlay.querySelector('#taskForm').reset()
    overlay.querySelector('#taskPriority').value = 'medium'
    overlay.querySelector('#taskStatus').value = 'todo'
    overlay.querySelector('#taskDueDate').value = ''
    overlay.querySelector('#deleteBtn').style.display = 'none'
    overlay.classList.add('open')
  }

  function openEdit(id) {
    const task = store.getTask(id)
    if (!task) return
    currentMode = 'edit'
    editingId = id
    showView('form')
    overlay.querySelector('#modalTitle').textContent = '编辑任务'
    overlay.querySelector('#taskTitle').value = task.title
    overlay.querySelector('#taskDescription').value = task.description
    overlay.querySelector('#taskPriority').value = task.priority
    overlay.querySelector('#taskStatus').value = task.status
    overlay.querySelector('#taskDueDate').value = task.dueDate || ''
    overlay.querySelector('#deleteBtn').style.display = 'block'
    overlay.classList.add('open')
  }

  function openConfirm(id, message) {
    currentMode = 'confirm'
    editingId = null
    showView('confirm')
    overlay.dataset.confirmId = id
    overlay.querySelector('#modalTitle').textContent = '确认操作'
    overlay.querySelector('.confirm-message').textContent = message || '确定要删除此任务吗？'
    overlay.classList.add('open')
  }

  function close() {
    overlay?.classList.remove('open')
  }

  function isOpen() {
    return overlay?.classList.contains('open')
  }

  // ── 视图切换 ──────────────────────────────────────────
  function showView(view) {
    if (formView) formView.style.display = view === 'form' ? '' : 'none'
    if (confirmView) confirmView.style.display = view === 'confirm' ? '' : 'none'
  }

  // ── 提交 ──────────────────────────────────────────────
  function handleSubmit() {
    const title = overlay.querySelector('#taskTitle').value.trim()
    if (!title) {
      overlay.querySelector('#taskTitle').focus()
      overlay.querySelector('#taskTitle').reportValidity()
      return
    }

    const data = {
      title,
      description: overlay.querySelector('#taskDescription').value.trim(),
      priority: overlay.querySelector('#taskPriority').value,
      status: overlay.querySelector('#taskStatus').value,
      dueDate: overlay.querySelector('#taskDueDate').value || null,
    }

    if (currentMode === 'create') {
      store.createTask(data)
    } else if (currentMode === 'edit' && editingId) {
      store.updateTask(editingId, data)
    }

    close()
  }

  // ── 删除 ──────────────────────────────────────────────
  function deleteTask() {
    if (editingId) {
      openConfirm(editingId, `确定要删除「${store.getTask(editingId)?.title}」吗？`)
    }
  }

  return { init, openCreate, openEdit, openConfirm, close, deleteTask }
})()