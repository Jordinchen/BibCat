import type { Book, Subject } from '@shared/types'
import { BookCheck, BookOpen } from 'lucide-react'
import { useI18n } from '../i18n'
import { Cover } from './Cover'
import { Stars } from './Stars'
import { primaryAuthor } from '../util'

interface Props {
  books: Book[]
  selected: Set<number>
  /** Klick auf ein Buch; Strg/Umschalt werden vom Aufrufer ausgewertet */
  onSelect: (b: Book, e: React.MouseEvent) => void
  onOpen: (b: Book) => void
  onDragStart: (b: Book, e: React.DragEvent) => void
  subjects: Map<number, Subject>
}

export function BookGrid({ books, selected, onSelect, onOpen, onDragStart }: Props) {
  const { t } = useI18n()
  return (
    <div className="book-grid">
      {books.map((b) => (
        <button
          key={b.id}
          className={`grid-card ${selected.has(b.id) ? 'selected' : ''}`}
          onClick={(e) => onSelect(b, e)}
          onDoubleClick={() => onOpen(b)}
          draggable
          onDragStart={(e) => onDragStart(b, e)}
          aria-pressed={selected.has(b.id)}
        >
          <div className="grid-cover">
            <Cover book={b} />
            {b.readStatus === 'read' && (
              <span className="badge-read" title={t('status.read')}>
                <BookCheck size={13} />
              </span>
            )}
            {b.readStatus === 'reading' && (
              <span className="badge-reading" title={t('status.reading')}>
                <BookOpen size={13} />
              </span>
            )}
          </div>
          <div className="grid-title">{b.title}</div>
          <div className="grid-author">{primaryAuthor(b.authors)}</div>
          {b.rating > 0 && <Stars value={b.rating} size="sm" />}
        </button>
      ))}
    </div>
  )
}

export function BookTable({ books, selected, onSelect, onOpen, onDragStart, subjects }: Props) {
  const { t } = useI18n()
  return (
    <div className="table-wrap">
      <table className="book-table">
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            <th>{t('sort.title')}</th>
            <th>{t('sort.authors')}</th>
            <th>{t('field.year')}</th>
            <th>{t('field.subject')}</th>
            <th>{t('field.callNumber')}</th>
            <th>{t('field.readStatus')}</th>
            <th>{t('field.rating')}</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => {
            const s = b.subjectId != null ? subjects.get(b.subjectId) : undefined
            return (
              <tr
                key={b.id}
                className={selected.has(b.id) ? 'selected' : ''}
                onClick={(e) => onSelect(b, e)}
                onDoubleClick={() => onOpen(b)}
                draggable
                onDragStart={(e) => onDragStart(b, e)}
              >
                <td>
                  <Cover book={b} className="cover-xs" />
                </td>
                <td>
                  <div className="cell-title">{b.title}</div>
                  {b.subtitle && <div className="cell-sub">{b.subtitle}</div>}
                </td>
                <td>{primaryAuthor(b.authors)}</td>
                <td className="num">{b.year}</td>
                <td>
                  {s && (
                    <span className="chip">
                      <span className="dot" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  )}
                </td>
                <td className="mono">{b.callNumber}</td>
                <td>
                  <span className={`status status-${b.readStatus}`}>{t(`status.${b.readStatus}`)}</span>
                </td>
                <td>{b.rating > 0 && <Stars value={b.rating} size="sm" />}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
