import { ref } from 'vue'

const toasts = ref([])
let idCounter = 0

export function useToast() {
  function show(message, type = 'info', onUndo = null) {
    const id = ++idCounter
    toasts.value.push({ id, message, type, onUndo })
    setTimeout(() => {
      const idx = toasts.value.findIndex(t => t.id === id)
      if (idx !== -1) toasts.value.splice(idx, 1)
    }, 3000)
  }

  function dismiss(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, show, dismiss }
}