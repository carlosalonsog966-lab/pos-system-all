import React from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  dataTestId?: string
}

const Modal: React.FC<ModalProps> = ({ open, onClose, children, dataTestId }) => {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        data-testid={dataTestId}
        className="bg-white rounded shadow p-4 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}

export default Modal

