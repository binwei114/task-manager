<script setup>
import { computed, ref } from 'vue'
import { taskStore, isOverdue, formatDate, COLUMNS } from '../stores/taskStore.js'

const props = defineProps({ task: Object })
const emit = defineEmits(['click', 'delete-pending'])

const touchMenu = ref(false)
const isTouch = 'ontouchstart' in window

const overdue = computed(() => isOverdue(props.task))

const priorityConfig = {
  high: { label: '高', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  medium: { label: '中', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  low: { label: '低', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
}

function onDragStart(e) {
  e.dataTransfer.setData('text/plain', props.task.id)
  e.dataTransfer.effectAllowed = 'move'
  // 立即隐藏源卡片并使其从 flex 布局中坍缩，其他卡片自然补位
  const el = e.currentTarget
  el.classList.add('dragging-source')
}

function onDragEnd(e) {
  // 恢复源卡片显示（无论拖拽是否成功放下）
  const el = e.currentTarget
  el.classList.remove('dragging-source')
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
    @dragend="onDragEnd"
    @click="$emit('click')"
    class="group flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing transition-all duration-150"
  >
    <!-- 优先级色标（文字标签） -->
    <span
      :class="`inline-flex items-center justify-center w-7 h-5 text-[11px] font-bold rounded flex-shrink-0 mt-0.5 ${priorityConfig[task.priority].cls}`"
    >{{ priorityConfig[task.priority].label }}</span>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <div class="text-[15px] font-semibold leading-snug break-words">{{ task.title }}</div>
      <div v-if="task.description" class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug line-clamp-2">{{ task.description }}</div>
      <div class="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
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
        class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-base"
      >⋮</button>
      <div
        v-if="touchMenu"
        class="absolute right-0 top-7 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
      >
        <button
          v-for="col in COLUMNS"
          :key="col.status"
          @click.stop="moveToStatus(col.status)"
          class="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
        >移动到「{{ col.label }}」</button>
      </div>
    </div>
  </div>
</template>