/**
 * theme.js — 深色模式管理
 * - 首次访问跟随系统偏好
 * - 手动切换后保存偏好，覆盖系统默认
 * - 监听系统变化，仅当未手动覆盖时自动跟随
 */
const theme = (() => {
  const STORAGE_KEY = 'taskmanager_theme'
  const html = document.documentElement

  function getSystemDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function applyTheme(isDark) {
    html.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }

  return {
    init() {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark') {
        applyTheme(true)
      } else if (saved === 'light') {
        applyTheme(false)
      } else {
        applyTheme(getSystemDark())
      }
      this._listenSystem()
      this._updateButton()
    },

    toggle() {
      const isDark = html.getAttribute('data-theme') !== 'dark'
      applyTheme(isDark)
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
      this._updateButton()
    },

    isDark() {
      return html.getAttribute('data-theme') === 'dark'
    },

    _listenSystem() {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          applyTheme(e.matches)
          this._updateButton()
        }
      })
    },

    _updateButton() {
      const btn = document.getElementById('themeToggle')
      if (btn) btn.textContent = this.isDark() ? '☀️' : '🌙'
    },
  }
})()