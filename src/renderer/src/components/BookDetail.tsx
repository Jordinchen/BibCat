import { X } from 'lucide-react'
import { READ_STATUSES, type Book, type ReadStatus, type Subject } from '@shared/types'
import { Cover } from './Cover'
import { Stars } from './Stars'
import type { LocationNode } from '../util'
import { useI18n } from '../i18n'

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
  const { t, date } = useI18n()
  // Bibliografische Form "Ort: Verlag, Jahr"
  const published = [[b.place, b.publisher].filter(Boolean).join(': '), b.year].filter(Boolean).join(', ')
  return (
    <aside className="detail">
      <button className="icon-btn detail-close" onClick={onClose} aria-label={t('common.close')}>
        <X size={16} />
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
          {READ_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <dl className="detail-list">
        <Row label={t('detail.location')} value={location?.path} />
        <Row
          label={t('detail.callNumber')}
          value={b.callNumber && <span className="mono">{b.callNumber}</span>}
        />
        <Row
          label={t('detail.subject')}
          value={
            subject && (
              <span className="chip">
                <span className="dot" style={{ background: subject.color }} />
                {subject.notation && <span className="mono">{subject.notation}</span>} {subject.name}
              </span>
            )
          }
        />
        <Row label={t('detail.published')} value={published} />
        <Row label={t('detail.edition')} value={b.edition} />
        <Row label={t('detail.series')} value={[b.series, b.seriesNumber].filter(Boolean).join(' · ')} />
        <Row label={t('detail.contributors')} value={b.contributors} />
        <Row label={t('detail.isbn')} value={b.isbn && <span className="mono">{b.isbn}</span>} />
        <Row
          label={t('detail.extent')}
          value={[b.pages ? t('detail.pages', { n: b.pages }) : '', b.binding].filter(Boolean).join(', ')}
        />
        <Row label={t('detail.language')} value={b.language} />
        <Row label={t('detail.copies')} value={b.copies !== 1 ? b.copies : ''} />
        <Row label={t('detail.readDate')} value={date(b.readDate)} />
        <Row label={t('detail.acquired')} value={date(b.acquiredDate)} />
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
          <span className="field-label">{t('detail.notes')}</span>
          <p>{b.notes}</p>
        </div>
      )}

      <div className="detail-actions">
        <button className="btn btn-primary" onClick={onEdit}>
          {t('common.edit')}
        </button>
        <button className="btn btn-ghost btn-danger" onClick={onDelete}>
          {t('common.delete')}
        </button>
      </div>
    </aside>
  )
}
