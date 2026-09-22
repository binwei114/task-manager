/**
 * search.js — 搜索与筛选（按标题/描述模糊匹配）
 * 通过 board.applyFilter() 实现实时过滤
 */
const search = (() => {
  let input = null
  let debounceTimer = null

  function init() {
    input = document.getElementById('searchBox')
    if (!input) return
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        board.applyFilter(input.value)
      }, 300)
    })
  }

  function getKeyword() {
    return input?.value?.trim() ?? ''
  }

  return { init, getKeyword }
})()