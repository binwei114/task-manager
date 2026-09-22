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
  // 排除待删除（隐藏）任务
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
    // 同列排序 — 基于完整数据列表操作，避免搜索过滤导致数据丢失
    const listEl = e.currentTarget
    const visibleCardIds = [...listEl.querySelectorAll('[data-task-id]')].map(el => el.dataset.taskId).filter(Boolean)
    // 获取该列的完整任务 ID 列表（按当前 order 排序）
    const fullOrdered = [...taskStore.getByStatus(props.status)].sort(
      (a, b) => a.order - b.order || (b.createdAt > a.createdAt ? 1 : -1)
    )
    const allIds = fullOrdered.map(t => t.id)

    // 计算可见卡片的新插入位置
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

    // 从完整列表中移除当前卡片，再按可见卡片新顺序重新插入
    const withoutCurrent = allIds.filter(i => i !== id)

    // 落点指向被拖动卡片自身 → 维持原位不排序
    if (insertIdx < visibleCardIds.length && visibleCardIds[insertIdx] === id) return

    if (insertIdx >= visibleCardIds.length) {
      // 拖到末尾的最后 → 插入列尾
      taskStore.reorderColumn(props.status, [...withoutCurrent, id])
      return
    }

    // 找到完整列表中第 insertIdx 个可见卡片在 withoutCurrent 中的位置
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