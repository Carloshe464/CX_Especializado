import { useSyncExternalStore } from 'react'

// API shadcn/ui: uma notificação de cada vez, com saída animada após dismiss.
const listeners = new Set()
let state = { toasts: [] }
let count = 0
const removalTimers = new Map()

function publish(toasts) {
  state = { toasts }
  listeners.forEach((listener) => listener())
}

function dismiss(toastId) {
  const targets = state.toasts.filter((item) => toastId === undefined || item.id === toastId)
  publish(state.toasts.map((item) => targets.includes(item) ? { ...item, open: false } : item))
  targets.forEach(({ id }) => {
    if (!removalTimers.has(id)) {
      removalTimers.set(id, setTimeout(() => {
        removalTimers.delete(id)
        publish(state.toasts.filter((item) => item.id !== id))
      }, 1000))
    }
  })
}

export function toast(props) {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  const id = String(count)
  const update = (next) => publish(state.toasts.map((item) => item.id === id ? { ...item, ...next, id } : item))
  publish([{
    ...props,
    id,
    open: true,
    onOpenChange: (open) => {
      props.onOpenChange?.(open)
      if (!open) dismiss(id)
    },
  }])
  return { id, update, dismiss: () => dismiss(id) }
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state

export function useToast() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ...snapshot, toast, dismiss }
}
