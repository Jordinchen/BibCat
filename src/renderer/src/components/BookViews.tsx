import type { Book, Subject } from '@shared/types'
import { BookOpen, Check, Play } from 'lucide-react'
import { MEDIA_ICONS, statusLabel, type StatusKind } from '../media'
import { mediaGroup } from '@shared/media'
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
  /** Bestimmt die Statusnamen und ob die Medienart angezeigt wird */
  statusKind: StatusKind
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
              <span className="badge-read" title={statusLabel(t, 'read', b.mediaType)}>
                <Check size={13} strokeWidth={2.5} />
              </span>
            )}
            {b.readStatus === 'reading' && (
              <span className="badge-reading" title={statusLabel(t, 'reading', b.mediaType)}>
                {mediaGroup(b.mediaType) === 'book' ? <BookOpen size={13} /> : <Play size={12} />}
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

export function BookTable({ books, selected, onSelect, onOpen, onDragStart, subjects, statusKind }: Props) {
  const { t } = useI18n()
  return (
    <div className="table-wrap">
      <table className="book-table">
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            <th>{t('sort.title')}</th>
            <th>{statusKind === 'book' ? t('sort.authors') : t('table.by')}</th>
            <th>{t('field.year')}</th>
            <th>{t('field.subject')}</th>
            <th>{t('field.callNumber')}</th>
            <th>{statusKind === 'book' ? t('field.readStatus') : t('nav.status')}</th>
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
                  <div className="cell-title">
                    {statusKind === 'mixed' &&
                      (() => {
                        const Icon = MEDIA_ICONS[b.mediaType]
                        return <Icon size={13} className="cell-type" aria-label={t(`media.${b.mediaType}`)} />
                      })()}
                    {b.title}
                  </div>
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
                  <span className={`status status-${b.readStatus}`}>
                    {statusLabel(t, b.readStatus, b.mediaType)}
                  </span>
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
