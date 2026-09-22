<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'create' },
  task: { type: Object, default: null },
  confirmMsg: { type: String, default: '' },
})
const emit = defineEmits(['save', 'delete', 'confirm', 'close'])

// 表单本地状态
const title = ref('')
const description = ref('')
const priority = ref('medium')
const status = ref('todo')
const dueDate = ref('')

// 编辑模式时预填
watch(() => props.task, (t) => {
  if (t) {
    title.value = t.title || ''
    description.value = t.description || ''
    priority.value = t.priority || 'medium'
    status.value = t.status || 'todo'
    dueDate.value = t.dueDate || ''
  }
}, { immediate: true })

function handleSubmit() {
  if (!title.value.trim()) return
  emit('save', {
    title: title.value.trim(),
    description: description.value.trim(),
    priority: priority.value,
    status: status.value,
    dueDate: dueDate.value || null,
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
      <div class="bg-white dark:bg-[#16213e] rounded-xl w-[90%] max-w-md max-h-[90vh] overflow-y-auto shadow-2xl transition-colors">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 class="text-lg font-bold">
            {{ mode === 'create' ? '新建任务' : mode === 'edit' ? '编辑任务' : '确认操作' }}
          </h2>
          <button @click="emit('close')" class="text-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
        </div>

        <!-- Form mode -->
        <form v-if="mode !== 'confirm'" @submit.prevent="handleSubmit" class="px-5 pb-5 space-y-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">标题 *</label>
            <input v-model="title" required placeholder="任务标题" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">描述</label>
            <textarea v-model="description" placeholder="描述（选填）" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"></textarea>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">截止日期</label>
            <input type="date" v-model="dueDate" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">优先级</label>
              <select v-model="priority" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="high">🔴 高</option>
                <option value="medium">🟡 中</option>
                <option value="low">🟢 低</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">状态</label>
              <select v-model="status" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="todo">📋 待办</option>
                <option value="in-progress">🔄 进行中</option>
                <option value="done">✅ 完成</option>
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between pt-2">
            <button v-if="mode === 'edit'" type="button" @click="emit('delete')" class="px-4 py-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors">删除</button>
            <div v-else></div>
            <button type="submit" class="px-5 py-1.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-md transition-colors">保存</button>
          </div>
        </form>

        <!-- Confirm mode -->
        <div v-else class="px-5 pb-5">
          <p class="text-sm mb-4">{{ confirmMsg || '确定要删除此任务吗？' }}</p>
          <div class="flex justify-end gap-2">
            <button @click="emit('close')" class="px-4 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">取消</button>
            <button @click="emit('confirm')" class="px-4 py-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>