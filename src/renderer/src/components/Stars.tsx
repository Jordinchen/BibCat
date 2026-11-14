import { useState } from 'react'

interface Props {
  value: number
  onChange?: (v: number) => void
  size?: 'sm' | 'md'
}

/** Bewertung 0–5; erneuter Klick auf den aktuellen Stern setzt auf 0 zurück. */
export function Stars({ value, onChange, size = 'md' }: Props) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <span
      className={`stars stars-${size} ${onChange ? 'stars-edit' : ''}`}
      onMouseLeave={() => setHover(0)}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={`${value}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            className={n <= shown ? 'on' : ''}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n === value ? 0 : n)}
            aria-label={`${n}/5`}
          >
            ★
          </button>
        ) : (
          <span key={n} className={n <= shown ? 'on' : ''}>
            ★
          </span>
        )
      )}
    </span>
  )
}
