<script setup>
import { computed, ref } from 'vue'
import { taskStore, isOverdue, formatDate, COLUMNS } from '../stores/taskStore.js'

const props = defineProps({ task: Object })
const emit = defineEmits(['click', 'delete-pending'])

const touchMenu = ref(false)
const isTouch = 'ontouchstart' in window

const overdue = computed(() => isOverdue(props.task))

const priorityLabel = { high: '高', medium: '中', low: 'low' }
const priorityColor = { high: 'bg-red-500', medium: 'bg-yellow-400', low: 'bg-green-500' }

function onDragStart(e) {
  e.dataTransfer.setData('text/plain', props.task.id)
  e.dataTransfer.effectAllowed = 'move'
}

function handleDelete() {
  taskStore.markPendingDelete(props.task.id)
  emit('delete-pending', props.task.id)
}

function moveToStatus(status) {
  taskStore.updateStatus(props.task.id, status)
  touchMenu.value = false
}
</script>

<template>
  <div
    :data-task-id="task.id"
    draggable="true"
    @dragstart="onDragStart"
    @click="$emit('click')"
    class="group flex items-start gap-2 bg-white dark:bg-[#16213e] rounded-md p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing transition-all duration-150"
  >
    <!-- 优先级色标 -->
    <div :class="`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${priorityColor[task.priority]}`"></div>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <div class="text-sm font-semibold break-words">{{ task.title }}</div>
      <div v-if="task.description" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ task.description }}</div>
      <div class="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
        <span v-if="task.dueDate" :class="[overdue ? 'text-red-500 dark:text-red-400 font-semibold' : '']">
          {{ overdue ? '⚠️ ' : '📅 ' }}{{ formatDate(task.dueDate) }}
        </span>
        <span>{{ new Date(task.createdAt).toISOString().split('T')[0] }}</span>
      </div>
    </div>

    <!-- 触屏菜单 -->
    <div v-if="isTouch" class="relative">
      <button
        @click.stop="touchMenu = !touchMenu"
        class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
      >⋮</button>
      <div
        v-if="touchMenu"
        class="absolute right-0 top-6 z-40 bg-white dark:bg-[#16213e] border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden"
      >
        <button
          v-for="col in COLUMNS"
          :key="col.status"
          @click.stop="moveToStatus(col.status)"
          class="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
        >移动到「{{ col.label }}」</button>
      </div>
    </div>
  </div>
</template>