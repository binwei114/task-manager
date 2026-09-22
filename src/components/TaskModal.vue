<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'create' },
  task: { type: Object, default: null },
  confirmMsg: { type: String, default: '' },
})
const emit = defineEmits(['save', 'delete', 'confirm', 'close'])

const title = ref('')
const description = ref('')
const priority = ref('medium')
const status = ref('todo')
const dueDate = ref('')

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
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl transition-colors">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">
            {{ mode === 'create' ? '新建任务' : mode === 'edit' ? '编辑任务' : '确认操作' }}
          </h2>
          <button @click="emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">&times;</button>
        </div>

        <!-- Form mode -->
        <form v-if="mode !== 'confirm'" @submit.prevent="handleSubmit" class="px-6 pb-6 pt-3 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">标题 *</label>
            <input v-model="title" required placeholder="任务标题" class="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">描述</label>
            <textarea v-model="description" placeholder="描述（选填）" rows="2" class="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y transition-colors"></textarea>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">截止日期</label>
            <input type="date" v-model="dueDate" class="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors" />
          </div>
          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">优先级</label>
              <select v-model="priority" class="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors">
                <option value="high">🔴 高</option>
                <option value="medium">🟡 中</option>
                <option value="low">🟢 低</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">状态</label>
              <select v-model="status" class="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors">
                <option value="todo">📋 待办</option>
                <option value="in-progress">🔄 进行中</option>
                <option value="done">✅ 完成</option>
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between pt-2 gap-3">
            <button v-if="mode === 'edit'" type="button" @click="emit('delete')" class="px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">删除</button>
            <div v-else></div>
            <button type="submit" class="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">保存</button>
          </div>
        </form>

        <!-- Confirm mode -->
        <div v-else class="px-6 pb-6 pt-3">
          <p class="text-[15px] text-gray-700 dark:text-gray-300 mb-5 leading-relaxed">{{ confirmMsg || '确定要删除此任务吗？' }}</p>
          <div class="flex justify-end gap-3">
            <button @click="emit('close')" class="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">取消</button>
            <button @click="emit('confirm')" class="px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>