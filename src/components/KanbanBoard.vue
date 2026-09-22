<script setup>
import { inject, provide } from 'vue'
import { taskStore, COLUMNS } from '../stores/taskStore.js'
import { useDrag } from '../composables/useDrag.js'
import Column from './Column.vue'

const emit = defineEmits(['edit-task', 'confirm-delete'])
const searchWord = inject('searchWord', '')

const drag = useDrag()
provide('drag', drag)
</script>

<template>
  <div class="flex-1 flex gap-5 p-4 sm:p-6 overflow-x-auto items-stretch max-w-[1440px] mx-auto w-full snap-x snap-mandatory">
    <Column
      v-for="col in COLUMNS"
      :key="col.status"
      :status="col.status"
      :label="col.label"
      :icon="col.icon"
      :searchWord="searchWord"
      @card-click="(id) => emit('edit-task', id)"
    />
  </div>
</template>