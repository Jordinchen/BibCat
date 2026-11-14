import type { Book } from '@shared/types'

function hue(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/** Zeigt das gespeicherte Cover oder einen typografischen Platzhalter. */
export function Cover({
  book,
  className = ''
}: {
  book: Pick<Book, 'title' | 'authors' | 'coverFile'>
  className?: string
}) {
  if (book.coverFile) {
    return <img className={`cover ${className}`} src={`cover://${book.coverFile}`} alt="" draggable={false} />
  }
  const h = hue(book.title || '?')
  return (
    <div
      className={`cover cover-placeholder ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${h} 32% 42%), hsl(${(h + 30) % 360} 38% 28%))` }}
    >
      <span className="ph-title">{book.title || 'Ohne Titel'}</span>
      <span className="ph-author">{book.authors.split(';')[0]}</span>
    </div>
  )
}
