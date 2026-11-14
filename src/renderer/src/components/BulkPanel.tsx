import { useMemo, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import {
  READ_STATUSES,
  type Book,
  type BulkPatch,
  type Location,
  type ReadStatus,
  type Subject
} from '@shared/types'
import { Cover } from './Cover'
import { Stars } from './Stars'
import { flattenLocations } from '../util'
import { useI18n } from '../i18n'
import { MEDIA_TYPES, type MediaType } from '@shared/media'
import { statusLabel } from '../media'

interface Props {
  books: Book[]
  subjects: Subject[]
  locations: Location[]
  onApply: (patch: BulkPatch) => Promise<void>
  onDelete: () => void
  onClose: () => void
}

/** Wert eines Auswahlfelds: unverändert, entfernen (null) oder eine ID */
const UNCHANGED = ''
const CLEAR = 'clear'

const splitKeywords = (s: string) =>
  s
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

/** Sammelbearbeitung für mehrere ausgewählte Bücher */
export function BulkPanel({ books, subjects, locations, onApply, onDelete, onClose }: Props) {
  const { t } = useI18n()
  const locs = useMemo(() => flattenLocations(locations), [locations])
  const [location, setLocation] = useState(UNCHANGED)
  const [media, setMedia] = useState<MediaType | ''>('')
  const [subject, setSubject] = useState(UNCHANGED)
  const [status, setStatus] = useState<ReadStatus | ''>('')
  const [rating, setRating] = useState<number | null>(null)
  const [addKw, setAddKw] = useState('')
  const [removeKw, setRemoveKw] = useState('')
  const [busy, setBusy] = useState(false)

  const patch: BulkPatch = {}
  if (media) patch.mediaType = media
  if (location !== UNCHANGED) patch.locationId = location === CLEAR ? null : Number(location)
  if (subject !== UNCHANGED) patch.subjectId = subject === CLEAR ? null : Number(subject)
  if (status) patch.readStatus = status
  if (rating !== null) patch.rating = rating
  if (splitKeywords(addKw).length) patch.addKeywords = splitKeywords(addKw)
  if (splitKeywords(removeKw).length) patch.removeKeywords = splitKeywords(removeKw)
  const dirty = Object.keys(patch).length > 0

  // Schlagworte der Auswahl als Vorschläge zum Entfernen
  const existingKeywords = useMemo(() => {
    const set = new Map<string, string>()
    for (const b of books) for (const k of splitKeywords(b.keywords)) set.set(k.toLowerCase(), k)
    return [...set.values()].sort((a, b) => a.localeCompare(b))
  }, [books])

  async function apply() {
    setBusy(true)
    try {
      await onApply(patch)
      setLocation(UNCHANGED)
      setMedia('')
      setSubject(UNCHANGED)
      setStatus('')
      setRating(null)
      setAddKw('')
      setRemoveKw('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="detail bulk">
      <button className="icon-btn detail-close" onClick={onClose} aria-label={t('cmd.selectNone')}>
        <X size={16} />
      </button>
      <div className="bulk-stack" aria-hidden>
        {books.slice(0, 5).map((b, i) => (
          <div
            key={b.id}
            className="bulk-stack-item"
            style={{
              transform: `translateX(${(i - Math.min(books.length, 5) / 2 + 0.5) * 26}px) rotate(${(i - 2) * 4}deg)`,
              zIndex: 10 - i
            }}
          >
            <Cover book={b} />
          </div>
        ))}
      </div>
      <h2 className="detail-title">{t('bulk.title', { n: books.length })}</h2>
      <p className="bulk-hint">{t('bulk.hint')}</p>

      <div className="bulk-form">
        <label className="field">
          <span className="field-label">{t('field.mediaType')}</span>
          <select
            value={media}
            onChange={(e) => setMedia(e.target.value as MediaType | '')}
            className={media ? 'changed' : ''}
          >
            <option value="">{t('bulk.unchanged')}</option>
            {MEDIA_TYPES.map((m) => (
              <option key={m} value={m}>
                {t(`media.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('field.location')}</span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={location ? 'changed' : ''}
          >
            <option value={UNCHANGED}>{t('bulk.unchanged')}</option>
            <option value={CLEAR}>{t('bulk.clear')}</option>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.path}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('field.subject')}</span>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={subject ? 'changed' : ''}
          >
            <option value={UNCHANGED}>{t('bulk.unchanged')}</option>
            <option value={CLEAR}>{t('bulk.clear')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.notation ? `${s.notation} ` : ''}
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('field.readStatus')}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReadStatus | '')}
            className={status ? 'changed' : ''}
          >
            <option value="">{t('bulk.unchanged')}</option>
            {READ_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(
                  t,
                  s,
                  new Set(books.map((b) => b.mediaType)).size === 1 ? books[0].mediaType : 'mixed'
                )}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">{t('field.rating')}</span>
          <div className="row gap-sm">
            <Stars value={rating ?? 0} onChange={(v) => setRating(v)} />
            {rating !== null && (
              <button className="link-btn" onClick={() => setRating(null)}>
                {t('bulk.unchanged')}
              </button>
            )}
          </div>
        </div>
        <label className="field">
          <span className="field-label">
            {t('bulk.addKeywords')}
            <span className="field-hint">{t('bulk.keywordsHint')}</span>
          </span>
          <input
            value={addKw}
            onChange={(e) => setAddKw(e.target.value)}
            className={addKw.trim() ? 'changed' : ''}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('bulk.removeKeywords')}</span>
          <input
            value={removeKw}
            onChange={(e) => setRemoveKw(e.target.value)}
            list="bulk-keywords"
            className={removeKw.trim() ? 'changed' : ''}
          />
          <datalist id="bulk-keywords">
            {existingKeywords.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="detail-actions bulk-actions">
        <button className="btn btn-primary" onClick={apply} disabled={!dirty || busy}>
          {t('bulk.apply', { n: books.length })}
        </button>
        <button className="btn btn-ghost btn-danger" onClick={onDelete}>
          <Trash2 size={15} /> {t('bulk.delete', { n: books.length })}
        </button>
      </div>
    </aside>
  )
}
