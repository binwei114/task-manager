<script setup>
import { computed, ref } from 'vue'
import { taskStore, isOverdue, formatDate } from '../stores/taskStore.js'
import TaskCard from './TaskCard.vue'

const props = defineProps({ status: String, label: String, icon: String, searchWord: { type: String, default: '' } })
const emit = defineEmits(['card-click', 'delete-pending'])

const tasks = computed(() => taskStore.getByStatus(props.status))

const filtered = computed(() => {
  const q = (props.searchWord || '').toLowerCase().trim()
  const visible = q ? tasks.value.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) : tasks.value
  return visible.filter(t => !taskStore.isHidden(t.id))
})

const sorted = computed(() =>
  [...filtered.value].sort((a, b) => a.order - b.order || (b.createdAt > a.createdAt ? 1 : -1))
)

const overdueCount = computed(() => filtered.value.filter(t => isOverdue(t)).length)

// 拖拽状态
let dragCounter = 0
const isDragOver = ref(false)

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
function onDragEnter(e) {
  e.preventDefault()
  dragCounter++
  isDragOver.value = true
}
function onDragLeave() {
  dragCounter--
  if (dragCounter <= 0) { dragCounter = 0; isDragOver.value = false }
}
function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  dragCounter = 0
  const id = e.dataTransfer.getData('text/plain')
  if (!id) return
  const task = taskStore.getById(id)
  if (!task) return
  if (task.status === props.status) {
    const listEl = e.currentTarget
    const visibleCardIds = [...listEl.querySelectorAll('[data-task-id]')].map(el => el.dataset.taskId).filter(Boolean)
    const fullOrdered = [...taskStore.getByStatus(props.status)].sort(
      (a, b) => a.order - b.order || (b.createdAt > a.createdAt ? 1 : -1)
    )
    const allIds = fullOrdered.map(t => t.id)

    const offsetY = e.clientY - listEl.getBoundingClientRect().top
    let insertIdx = visibleCardIds.length
    for (let i = 0; i < visibleCardIds.length; i++) {
      const el = listEl.querySelector(`[data-task-id="${visibleCardIds[i]}"]`)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (offsetY < rect.top + rect.height / 2 - listEl.getBoundingClientRect().top) {
        insertIdx = i
        break
      }
    }

    const withoutCurrent = allIds.filter(i => i !== id)
    if (insertIdx < visibleCardIds.length && visibleCardIds[insertIdx] === id) return

    if (insertIdx >= visibleCardIds.length) {
      taskStore.reorderColumn(props.status, [...withoutCurrent, id])
      return
    }

    const targetVisibleId = visibleCardIds[insertIdx]
    const spliceAt = withoutCurrent.indexOf(targetVisibleId)
    if (spliceAt === -1) return
    withoutCurrent.splice(spliceAt, 0, id)

    taskStore.reorderColumn(props.status, withoutCurrent)
  } else {
    taskStore.updateStatus(id, props.status)
  }
}

function cardClick(id) {
  emit('card-click', id)
}
function deletePending(id) {
  emit('delete-pending', id)
}
</script>

<template>
  <div class="flex-1 min-w-[280px] max-w-[400px] bg-gray-100 dark:bg-gray-800/60 rounded-xl p-4 flex flex-col transition-colors snap-start">
    <div class="flex items-center gap-2 pb-3 px-0.5">
      <span class="text-base font-semibold text-gray-700 dark:text-gray-300">{{ icon }} {{ label }}</span>
      <span class="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-semibold rounded-full bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ filtered.length }}</span>
      <span v-if="overdueCount" class="text-xs font-semibold text-red-500 dark:text-red-400">⚠️{{ overdueCount }}</span>
    </div>

    <div
      class="flex flex-col gap-3 min-h-[180px] p-2 rounded-lg transition-colors"
      :class="{ 'bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-dashed ring-indigo-400/40': isDragOver }"
      @dragover="onDragOver"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div v-if="sorted.length === 0" class="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 select-none">暂无任务</div>
      <TaskCard
        v-for="task in sorted"
        :key="task.id"
        :task="task"
        @click="cardClick(task.id)"
        @delete-pending="deletePending"
      />
    </div>
  </div>
</template>