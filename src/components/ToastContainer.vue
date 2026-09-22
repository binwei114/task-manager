<script setup>
import { useToast } from '../composables/useToast.js'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-xs">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="flex items-center gap-2 px-3 py-2.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded-lg shadow-lg text-sm"
      >
        <span class="flex-1">{{ t.message }}</span>
        <button
          v-if="t.onUndo"
          @click="t.onUndo(); dismiss(t.id)"
          class="font-bold text-indigo-300 dark:text-indigo-600 hover:text-indigo-200 dark:hover:text-indigo-800 whitespace-nowrap"
        >撤销</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active { animation: slide-in 0.3s ease-out; }
.toast-leave-active { animation: slide-in 0.3s ease-in reverse; }
@keyframes slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>