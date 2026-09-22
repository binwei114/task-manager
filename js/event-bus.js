/**
 * event-bus.js — 轻量发布/订阅事件总线
 * 用于解耦 Store 与视图层
 */
const bus = (() => {
  const handlers = {}
  return {
    on(event, fn) {
      ;(handlers[event] ??= []).push(fn)
    },
    off(event, fn) {
      const list = handlers[event]
      if (list) handlers[event] = list.filter(f => f !== fn)
    },
    emit(event, data) {
      ;(handlers[event] ?? []).forEach(fn => fn(data))
    },
  }
})()