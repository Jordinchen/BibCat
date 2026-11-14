import type { Book } from '@shared/types'
import type { MediaType } from '@shared/media'
import { MEDIA_ICONS } from '../media'

function hue(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/**
 * Zeigt das gespeicherte Cover oder einen typografischen Platzhalter.
 * Musik hat quadratische Cover, alles andere das Hochformat 2:3.
 */
export function Cover({
  book,
  className = ''
}: {
  book: Pick<Book, 'title' | 'authors' | 'coverFile'> & { mediaType?: MediaType }
  className?: string
}) {
  const type = book.mediaType ?? 'book'
  const shape = type === 'music' ? 'cover-square' : ''
  if (book.coverFile) {
    return (
      <img
        className={`cover ${shape} ${className}`}
        src={`cover://${book.coverFile}`}
        alt=""
        draggable={false}
      />
    )
  }
  const h = hue(book.title || '?')
  const Icon = MEDIA_ICONS[type]
  return (
    <div
      className={`cover cover-placeholder ${shape} ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${h} 32% 42%), hsl(${(h + 30) % 360} 38% 28%))` }}
    >
      <span className="ph-title">{book.title || '…'}</span>
      <span className="ph-author">{book.authors.split(';')[0]}</span>
      {type !== 'book' && <Icon className="ph-icon" size={16} strokeWidth={1.75} />}
    </div>
  )
}
