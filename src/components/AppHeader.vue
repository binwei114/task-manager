<script setup>
import { ref } from 'vue'
defineProps({ isDark: Boolean })
const emit = defineEmits(['toggle-theme', 'create-task'])

const searchWord = defineModel('search', { default: '' })
</script>

<template>
  <header class="sticky top-0 z-50 flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
    <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight mr-auto">Task Manager</h1>

    <input
      v-model="searchWord"
      type="text"
      placeholder="搜索…"
      class="w-full sm:w-48 order-last sm:order-none px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
    />

    <button
      @click="emit('toggle-theme')"
      class="text-xl p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      :aria-label="isDark ? '切换浅色模式' : '切换深色模式'"
    >{{ isDark ? '☀️' : '🌙' }}</button>

    <button
      @click="emit('create-task')"
      class="px-4 py-2 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
      >+ 新建任务</button>
  </header>
</template>