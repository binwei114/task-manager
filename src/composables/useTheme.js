import { ref, watch, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'taskmanager_theme'
const isDark = ref(false)

export function useTheme() {
  let mq = null

  function apply(value) {
    isDark.value = value
    document.documentElement.classList.toggle('dark', value)
  }

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark') apply(true)
    else if (saved === 'light') apply(false)
    else apply(window.matchMedia('(prefers-color-scheme: dark)').matches)

    mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', onChange)
  }

  function onChange(e) {
    if (!localStorage.getItem(STORAGE_KEY)) apply(e.matches)
  }

  function toggle() {
    apply(!isDark.value)
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  }

  onMounted(init)
  onUnmounted(() => mq?.removeEventListener('change', onChange))

  return { isDark, toggle }
}