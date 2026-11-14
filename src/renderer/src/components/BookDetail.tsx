import { READ_STATUS_LABELS, type Book, type ReadStatus, type Subject } from '@shared/types'
import { Cover } from './Cover'
import { Stars } from './Stars'
import type { LocationNode } from '../util'

interface Props {
  book: Book
  subject?: Subject
  location?: LocationNode
  onEdit: () => void
  onDelete: () => void
  onPatch: (patch: Partial<Book>) => void
  onClose: () => void
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === '' || value == null) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

export function BookDetail({ book: b, subject, location, onEdit, onDelete, onPatch, onClose }: Props) {
  // Bibliografische Form "Ort: Verlag, Jahr"
  const published = [[b.place, b.publisher].filter(Boolean).join(': '), b.year].filter(Boolean).join(', ')
  return (
    <aside className="detail">
      <button className="icon-btn detail-close" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <Cover book={b} className="cover-detail" />
      <h2 className="detail-title">{b.title}</h2>
      {b.subtitle && <p className="detail-sub">{b.subtitle}</p>}
      <p className="detail-author">
        {b.authors
          .split(';')
          .map((a) => a.trim())
          .join(' · ')}
      </p>

      <div className="detail-quick">
        <Stars value={b.rating} onChange={(rating) => onPatch({ rating })} />
        <select
          className={`status-select status-${b.readStatus}`}
          value={b.readStatus}
          onChange={(e) => {
            const readStatus = e.target.value as ReadStatus
            const readDate =
              readStatus === 'read' && !b.readDate ? new Date().toISOString().slice(0, 10) : b.readDate
            onPatch({ readStatus, readDate })
          }}
        >
          {(Object.keys(READ_STATUS_LABELS) as ReadStatus[]).map((s) => (
            <option key={s} value={s}>
              {READ_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <dl className="detail-list">
        <Row label="Standort" value={location?.path} />
        <Row label="Signatur" value={b.callNumber && <span className="mono">{b.callNumber}</span>} />
        <Row
          label="Fachgebiet"
          value={
            subject && (
              <span className="chip">
                <span className="dot" style={{ background: subject.color }} />
                {subject.notation && <span className="mono">{subject.notation}</span>} {subject.name}
              </span>
            )
          }
        />
        <Row label="Erschienen" value={published} />
        <Row label="Auflage" value={b.edition} />
        <Row label="Reihe" value={[b.series, b.seriesNumber].filter(Boolean).join(' · ')} />
        <Row label="Beteiligte" value={b.contributors} />
        <Row label="ISBN" value={b.isbn && <span className="mono">{b.isbn}</span>} />
        <Row label="Umfang" value={[b.pages ? `${b.pages} S.` : '', b.binding].filter(Boolean).join(', ')} />
        <Row label="Sprache" value={b.language} />
        <Row label="Exemplare" value={b.copies !== 1 ? b.copies : ''} />
        <Row label="Gelesen am" value={b.readDate && new Date(b.readDate).toLocaleDateString('de-DE')} />
        <Row
          label="Erworben"
          value={b.acquiredDate && new Date(b.acquiredDate).toLocaleDateString('de-DE')}
        />
      </dl>

      {b.keywords && (
        <div className="tags">
          {b.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
            .map((k) => (
              <span key={k} className="tag">
                {k}
              </span>
            ))}
        </div>
      )}
      {b.description && <p className="detail-text">{b.description}</p>}
      {b.notes && (
        <div className="detail-notes">
          <span className="field-label">Notizen</span>
          <p>{b.notes}</p>
        </div>
      )}

      <div className="detail-actions">
        <button className="btn btn-primary" onClick={onEdit}>
          Bearbeiten
        </button>
        <button className="btn btn-ghost btn-danger" onClick={onDelete}>
          Löschen
        </button>
      </div>
    </aside>
  )
}
