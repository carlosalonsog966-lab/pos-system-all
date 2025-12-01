import { showToast } from '@/ui/toast'

export async function withAction<T>(name: string, fn: () => Promise<T> | T) {
  const start = performance.now()
  try {
    const res = await fn()
    showToast(`${name}: ok`)
    const end = performance.now()
    return { res, ms: Math.round(end - start), ok: true }
  } catch (e) {
    console.error(name, e)
    showToast(`${name}: error`)
    const end = performance.now()
    return { res: undefined as unknown as T, ms: Math.round(end - start), ok: false }
  }
}

