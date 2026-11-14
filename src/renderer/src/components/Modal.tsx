import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** Offene Dialoge, damit Escape nur den obersten schließt */
const stack: symbol[] = []

export function Modal({ title, onClose, children, footer, wide }: Props) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const id = Symbol()
    stack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      stack.splice(stack.indexOf(id), 1)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}
