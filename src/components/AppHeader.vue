<script setup>
import { ref } from 'vue'
defineProps({ isDark: Boolean })
const emit = defineEmits(['toggle-theme'])

const searchWord = defineModel('search', { default: '' })
</script>

<template>
  <header class="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white dark:bg-[#0f3460] border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
    <h1 class="text-lg sm:text-xl font-bold mr-auto whitespace-nowrap">📋 Task Manager</h1>

    <input
      v-model="searchWord"
      type="text"
      placeholder="搜索…"
      class="w-32 sm:w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#1a1a2e] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
    />

    <button
      @click="emit('toggle-theme')"
      class="text-xl p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      :aria-label="isDark ? '切换浅色模式' : '切换深色模式'"
    >{{ isDark ? '☀️' : '🌙' }}</button>

    <button
      @click="$emit('create-task')"
      class="px-4 py-1.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-md transition-colors"
    >+ 新建任务</button>
  </header>
</template>