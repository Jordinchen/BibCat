import { X } from 'lucide-react'
import { READ_STATUSES, type Book, type ReadStatus, type Subject } from '@shared/types'
import { Cover } from './Cover'
import { Stars } from './Stars'
import type { LocationNode } from '../util'
import { useI18n } from '../i18n'
import { fieldLabel, MEDIA_ICONS, readDateLabel, statusLabel } from '../media'
import { mediaGroup } from '@shared/media'

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
  const L = (field: string) => fieldLabel(t, field, b.mediaType)
  const isBook = mediaGroup(b.mediaType) === 'book'
  const TypeIcon = MEDIA_ICONS[b.mediaType]
  const tracks = b.tracks
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return (
    <aside className="detail">
      <button className="icon-btn detail-close" onClick={onClose} aria-label={t('common.close')}>
        <X size={16} />
      </button>
      <Cover book={b} className="cover-detail" />
      <span className="detail-type">
        <TypeIcon size={13} /> {t(`media.${b.mediaType}`)}
      </span>
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
              {statusLabel(t, s, b.mediaType)}
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
        <Row
          label={isBook ? t('detail.published') : L('publisher')}
          value={isBook ? published : b.publisher}
        />
        {!isBook && <Row label={t('field.year')} value={b.year} />}
        <Row label={isBook ? t('detail.edition') : L('edition')} value={b.edition} />
        <Row
          label={isBook && b.mediaType === 'book' ? t('detail.series') : L('series')}
          value={[b.series, b.seriesNumber].filter(Boolean).join(' · ')}
        />
        <Row
          label={isBook && b.mediaType === 'book' ? t('detail.contributors') : L('contributors')}
          value={b.contributors}
        />
        <Row label={L('code')} value={b.isbn && <span className="mono">{b.isbn}</span>} />
        {isBook ? (
          <Row
            label={t('detail.extent')}
            value={[b.pages ? t('detail.pages', { n: b.pages }) : '', b.binding].filter(Boolean).join(', ')}
          />
        ) : (
          <>
            <Row label={L('binding')} value={b.binding} />
            <Row
              label={L('duration').replace(/\s*\(.*\)$/, '')}
              value={b.duration ? t('detail.minutes', { n: b.duration }) : ''}
            />
          </>
        )}
        <Row label={t('detail.ageRating')} value={b.ageRating} />
        <Row label={t('detail.players')} value={b.players} />
        <Row label={t('detail.language')} value={b.language} />
        <Row label={t('detail.copies')} value={b.copies !== 1 ? b.copies : ''} />
        <Row label={readDateLabel(t, b.mediaType)} value={date(b.readDate)} />
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
      {tracks.length > 0 && (
        <div className="detail-tracks">
          <span className="field-label">{t('detail.tracks')}</span>
          <ol>
            {tracks.map((tr, i) => (
              <li key={i}>{tr.replace(/^\d+\.\s*/, '')}</li>
            ))}
          </ol>
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
