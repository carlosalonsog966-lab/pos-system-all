export function showToast(message: string) {
  const el = document.getElementById('toaster')
  if (!el) return
  el.textContent = message
  el.style.display = 'block'
  setTimeout(() => {
    el.textContent = ''
    el.style.display = 'none'
  }, 2200)
}

