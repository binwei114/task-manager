<script setup>
import { computed, inject } from 'vue'
import { taskStore, isOverdue } from '../stores/taskStore.js'
import TaskCard from './TaskCard.vue'

const props = defineProps({ status: String, label: String, icon: String, searchWord: { type: String, default: '' } })
const emit = defineEmits(['card-click', 'delete-pending'])

const drag = inject('drag', null)
const isDragTarget = computed(() => drag?.state.targetStatus === props.status)

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

function cardClick(id) {
  emit('card-click', id)
}
function deletePending(id) {
  emit('delete-pending', id)
}
</script>

<template>
  <div class="flex-1 min-w-[280px] max-w-[400px] bg-white dark:bg-gray-800/60 rounded-xl p-4 flex flex-col transition-colors snap-start border border-gray-200 dark:border-gray-700/40">
    <div class="flex items-center gap-2 pb-3 px-0.5">
      <span class="text-base font-semibold text-gray-700 dark:text-gray-300">{{ icon }} {{ label }}</span>
      <span class="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-semibold rounded-full bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ filtered.length }}</span>
      <span v-if="overdueCount" class="text-xs font-semibold text-red-500 dark:text-red-400">⚠️{{ overdueCount }}</span>
    </div>

    <div
      class="task-list flex flex-col gap-3 min-h-[200px] flex-1 p-2 rounded-lg transition-colors"
      :class="{ 'bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-inset ring-indigo-400/40': isDragTarget }"
      :data-status="status"
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
