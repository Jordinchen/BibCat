import type { Book, Subject } from '@shared/types'
import { READ_STATUS_LABELS } from '@shared/types'
import { Cover } from './Cover'
import { Stars } from './Stars'
import { primaryAuthor } from '../util'

interface Props {
  books: Book[]
  selectedId: number | null
  onSelect: (b: Book) => void
  onOpen: (b: Book) => void
  subjects: Map<number, Subject>
}

export function BookGrid({ books, selectedId, onSelect, onOpen }: Props) {
  return (
    <div className="book-grid">
      {books.map((b) => (
        <button
          key={b.id}
          className={`grid-card ${b.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(b)}
          onDoubleClick={() => onOpen(b)}
        >
          <div className="grid-cover">
            <Cover book={b} />
            {b.readStatus === 'read' && (
              <span className="badge-read" title="Gelesen">
                ✓
              </span>
            )}
            {b.readStatus === 'reading' && (
              <span className="badge-reading" title="Lese ich gerade">
                ◐
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

export function BookTable({ books, selectedId, onSelect, onOpen, subjects }: Props) {
  return (
    <div className="table-wrap">
      <table className="book-table">
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            <th>Titel</th>
            <th>Autor</th>
            <th>Jahr</th>
            <th>Fachgebiet</th>
            <th>Signatur</th>
            <th>Status</th>
            <th>Bewertung</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => {
            const s = b.subjectId != null ? subjects.get(b.subjectId) : undefined
            return (
              <tr
                key={b.id}
                className={b.id === selectedId ? 'selected' : ''}
                onClick={() => onSelect(b)}
                onDoubleClick={() => onOpen(b)}
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
                  <span className={`status status-${b.readStatus}`}>{READ_STATUS_LABELS[b.readStatus]}</span>
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
