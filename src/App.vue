<script setup>
import { ref, onMounted, provide } from 'vue'
import { taskStore } from './stores/taskStore.js'
import { useTheme } from './composables/useTheme.js'
import { useToast } from './composables/useToast.js'
import AppHeader from './components/AppHeader.vue'
import KanbanBoard from './components/KanbanBoard.vue'
import TaskModal from './components/TaskModal.vue'
import ToastContainer from './components/ToastContainer.vue'

const { isDark, toggle } = useTheme()
const { toasts, show, dismiss } = useToast()
const searchWord = ref('')
provide('searchWord', searchWord)

const modal = ref({ show: false, mode: 'create', editingId: null, confirmId: null, confirmMsg: '' })

function openCreate() { modal.value = { show: true, mode: 'create', editingId: null, confirmId: null, confirmMsg: '' } }
function openEdit(id) { modal.value = { show: true, mode: 'edit', editingId: id, confirmId: null, confirmMsg: '' } }
function openConfirm(id, msg) { modal.value = { show: true, mode: 'confirm', editingId: null, confirmId: id, confirmMsg: msg } }

function handleSave(data) {
  if (modal.value.mode === 'create') taskStore.create(data)
  else if (modal.value.mode === 'edit' && modal.value.editingId) taskStore.update(modal.value.editingId, data)
  modal.value.show = false
}
function handleDelete() {
  if (modal.value.editingId) {
    const t = taskStore.getById(modal.value.editingId)
    taskStore.markPendingDelete(modal.value.editingId)
    show(`已删除「${t ? t.title : ''}」`, 'info', () => taskStore.cancelDelete(modal.value.editingId))
    modal.value.show = false
  }
}
function handleConfirm() {
  if (modal.value.confirmId) { taskStore.confirmDelete(modal.value.confirmId); modal.value.show = false }
}

onMounted(() => {
  taskStore.init()
  if (taskStore.getAll().length === 0) seedTasks()
})
function seedTasks() {
  const t = new Date(); t.setDate(t.getDate() + 1)
  const f = d => d.toISOString().split('T')[0]
  taskStore.create({ title: '欢迎使用 Task Manager', description: '试试拖拽我到其他列 🚀', priority: 'low', status: 'todo' })
  taskStore.create({ title: '添加第一个真实任务', description: '点击上方「新建任务」开始', priority: 'medium', status: 'todo', dueDate: f(t) })
  taskStore.create({ title: '探索深色模式', description: '点击页头的 🌙 按钮切换', priority: 'low', status: 'done' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader :isDark="isDark" v-model:search="searchWord" @toggle-theme="toggle" @create-task="openCreate" />
    <KanbanBoard @edit-task="openEdit" @confirm-delete="openConfirm" />
    <TaskModal
      v-if="modal.show"
      :mode="modal.mode"
      :task="modal.mode === 'edit' ? taskStore.getById(modal.editingId) : null"
      :confirmMsg="modal.confirmMsg"
      @save="handleSave"
      @delete="handleDelete"
      @confirm="handleConfirm"
      @close="modal.show = false"
    />
    <ToastContainer :toasts="toasts" @dismiss="dismiss" />
  </div>
</template>