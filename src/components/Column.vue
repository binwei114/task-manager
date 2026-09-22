<script setup>
import { computed, ref } from 'vue'
import { taskStore, isOverdue, formatDate } from '../stores/taskStore.js'
import TaskCard from './TaskCard.vue'

const props = defineProps({ status: String, label: String, icon: String, searchWord: { type: String, default: '' } })
const emit = defineEmits(['card-click', 'delete-pending'])

const tasks = computed(() => taskStore.getByStatus(props.status))

const filtered = computed(() => {
  const q = searchWord.value.toLowerCase().trim()
  return q ? tasks.value.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) : tasks.value
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
    // 同列排序
    const listEl = e.currentTarget
    const cards = [...listEl.querySelectorAll('[data-task-id]')]
    const ids = cards.map(el => el.dataset.taskId).filter(Boolean)
    const withoutCurrent = ids.filter(i => i !== id)
    const offsetY = e.clientY - listEl.getBoundingClientRect().top
    let insertIdx = withoutCurrent.length
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (offsetY < rect.top + rect.height / 2 - listEl.getBoundingClientRect().top) {
        insertIdx = i
        break
      }
    }
    withoutCurrent.splice(insertIdx, 0, id)
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
  <div class="flex-1 min-w-[260px] max-w-[380px] bg-gray-200 dark:bg-[#0f3460] rounded-lg p-3 flex flex-col transition-colors">
    <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 px-1">
      {{ icon }} {{ label }} ({{ filtered.length }})<span v-if="overdueCount" class="text-red-500 dark:text-red-400"> ⚠️{{ overdueCount }}逾期</span>
    </div>

    <div
      class="flex flex-col gap-2 min-h-[48px] p-1 rounded-md transition-colors"
      :class="{ 'bg-indigo-100/50 dark:bg-indigo-900/30 outline-2 outline-dashed outline-indigo-400': isDragOver }"
      @dragover="onDragOver"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div v-if="sorted.length === 0" class="text-center py-4 text-xs text-gray-400">暂无任务</div>
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