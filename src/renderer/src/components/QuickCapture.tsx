import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import {
  EMPTY_BOOK,
  READ_STATUSES,
  type Book,
  type BookInput,
  type Location,
  type ReadStatus,
  type Subject
} from '@shared/types'
import { cleanIsbn, toIsbn13 } from '@shared/isbn'
import { classifyCode, MEDIA_TYPES, type MediaType } from '@shared/media'
import { Modal } from './Modal'
import { Cover } from './Cover'
import { errMsg, flattenLocations, primaryAuthor } from '../util'
import { fetchMediaData } from '../lookup'
import { statusLabel } from '../media'
import { useI18n } from '../i18n'

// Der Barcode-Leser ist groß und wird erst bei Bedarf geladen
const Scanner = lazy(() => import('./Scanner').then((m) => ({ default: m.Scanner })))

interface Props {
  subjects: Subject[]
  locations: Location[]
  onClose: () => void
  onChanged: () => void
  onEdit: (b: Book) => void
}

type Entry =
  | { key: number; isbn: string; state: 'pending' }
  | { key: number; isbn: string; state: 'saved'; book: Book; sources: string[] }
  | { key: number; isbn: string; state: 'duplicate'; book: Book }
  | { key: number; isbn: string; state: 'notfound'; book: Book }
  | { key: number; isbn: string; state: 'invalid' }
  | { key: number; isbn: string; state: 'error'; message: string }

export function QuickCapture({ subjects, locations, onClose, onChanged, onEdit }: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [readStatus, setReadStatus] = useState<ReadStatus>('unread')
  const [mediaType, setMediaType] = useState<MediaType | 'auto'>('auto')
  const [entries, setEntries] = useState<Entry[]>([])
  const queue = useRef(Promise.resolve())
  const seq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const locs = useMemo(() => flattenLocations(locations), [locations])

  const defaults = useRef({ locationId, subjectId, readStatus, mediaType })
  defaults.current = { locationId, subjectId, readStatus, mediaType }
  const tr = useRef(t)
  tr.current = t

  const update = (key: number, e: Entry) => setEntries((list) => list.map((x) => (x.key === key ? e : x)))

  /** Normalisierte Form: ISBN-10 wird zu ISBN-13, alles andere bleibt, wie es ist */
  const normalize = (code: string) => (classifyCode(code) === 'isbn' ? toIsbn13(code)! : code)

  async function process(key: number, code: string) {
    const kind = classifyCode(code)
    const isbn = normalize(code)
    try {
      const dup = await window.bibcraft.books.findByIsbn(isbn)
      if (dup) {
        update(key, { key, isbn, state: 'duplicate', book: dup })
        return
      }
      const { data, sources, coverFile } = await fetchMediaData(isbn)
      const { mediaType: chosen, ...rest } = defaults.current
      // „Automatisch": die Quelle bestimmt die Art; ohne Treffer schließen wir aus dem Code
      const detected: MediaType =
        data.mediaType && data.mediaType !== 'book'
          ? data.mediaType
          : kind === 'isbn'
            ? 'book'
            : kind === 'issn'
              ? 'periodical'
              : 'film'
      const base: BookInput = {
        ...EMPTY_BOOK,
        ...data,
        isbn,
        coverFile,
        ...rest,
        mediaType: chosen === 'auto' ? detected : chosen,
        acquiredDate: ''
      }
      if (!sources.length) {
        // Platzhalter anlegen, damit nichts verloren geht – Titel später nachtragen
        const title =
          kind === 'isbn'
            ? tr.current('quick.unknownTitle', { isbn })
            : tr.current('quick.unknownCode', { code: isbn })
        const book = await window.bibcraft.books.create({ ...base, title })
        update(key, { key, isbn, state: 'notfound', book })
      } else {
        const book = await window.bibcraft.books.create(base)
        update(key, { key, isbn, state: 'saved', book, sources })
      }
      onChanged()
    } catch (e) {
      update(key, { key, isbn, state: 'error', message: errMsg(e) })
    }
  }

  function submit(raw: string) {
    const cleaned = cleanIsbn(raw)
    if (!cleaned) return
    const key = ++seq.current
    if (classifyCode(cleaned) === 'invalid') {
      setEntries((l) => [{ key, isbn: cleaned, state: 'invalid' }, ...l])
      return
    }
    setEntries((l) => [{ key, isbn: normalize(cleaned), state: 'pending' }, ...l])
    // Nacheinander abarbeiten, damit Duplikate beim schnellen Scannen erkannt werden
    queue.current = queue.current.then(() => process(key, cleaned))
  }

  async function addCopy(entry: Extract<Entry, { state: 'duplicate' }>) {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = entry.book
    const book = await window.bibcraft.books.update(id, { ...rest, copies: rest.copies + 1 })
    update(entry.key, { ...entry, book })
    onChanged()
    inputRef.current?.focus()
  }

  async function undo(entry: Entry & { book: Book }) {
    await window.bibcraft.books.remove(entry.book.id)
    setEntries((l) => l.filter((x) => x.key !== entry.key))
    onChanged()
    inputRef.current?.focus()
  }

  const savedCount = entries.filter((e) => e.state === 'saved' || e.state === 'notfound').length

  return (
    <Modal wide title={t('quick.title')} onClose={onClose}>
      <div className="quick">
        <div className="quick-left">
          <p className="muted">{t('quick.intro')}</p>
          <div className="isbn-bar">
            <input
              ref={inputRef}
              className="isbn-input isbn-big"
              placeholder="ISBN …"
              value={input}
              autoFocus
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  submit(input)
                  setInput('')
                }
              }}
            />
            <button className={`btn ${camera ? 'btn-active' : ''}`} onClick={() => setCamera((c) => !c)}>
              <Camera size={16} /> {t('quick.camera')}
            </button>
          </div>
          {camera && (
            <Suspense fallback={null}>
              <Scanner continuous anyCode onIsbn={submit} />
            </Suspense>
          )}

          <div className="quick-defaults">
            <label className="field">
              <span className="field-label">{t('quick.mediaType')}</span>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as MediaType | 'auto')}>
                <option value="auto">{t('quick.auto')}</option>
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
                value={locationId ?? ''}
                onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t('common.unassigned')}</option>
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
                value={subjectId ?? ''}
                onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t('common.none')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('field.readStatus')}</span>
              <select value={readStatus} onChange={(e) => setReadStatus(e.target.value as ReadStatus)}>
                {READ_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(t, s, mediaType === 'auto' ? 'mixed' : mediaType)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="quick-log">
          <div className="quick-log-head">
            <strong>{t('quick.count', { n: savedCount })}</strong>
          </div>
          {entries.length === 0 && <div className="empty-small">{t('quick.empty')}</div>}
          <ul>
            {entries.map((e) => (
              <li key={e.key} className={`log-item log-${e.state}`}>
                {'book' in e ? (
                  <Cover book={e.book} className="cover-xs" />
                ) : (
                  <div className="cover cover-xs cover-empty" />
                )}
                <div className="log-text">
                  {e.state === 'pending' && (
                    <>
                      <strong>{e.isbn}</strong>
                      <span className="muted">{t('quick.pending')}</span>
                    </>
                  )}
                  {e.state === 'saved' && (
                    <>
                      <strong>{e.book.title}</strong>
                      <span className="muted">
                        {primaryAuthor(e.book.authors)} · {e.sources[0]}
                      </span>
                    </>
                  )}
                  {e.state === 'notfound' && (
                    <>
                      <strong>{e.isbn}</strong>
                      <span className="warn-text">
                        {e.book.mediaType === 'book' ? t('quick.notFound') : t('quick.notFoundMedia')}
                      </span>
                    </>
                  )}
                  {e.state === 'duplicate' && (
                    <>
                      <strong>{e.book.title}</strong>
                      <span className="warn-text">{t('quick.duplicate', { n: e.book.copies })}</span>
                    </>
                  )}
                  {e.state === 'invalid' && (
                    <>
                      <strong>{e.isbn}</strong>
                      <span className="error-text">{t('quick.invalid')}</span>
                    </>
                  )}
                  {e.state === 'error' && (
                    <>
                      <strong>{e.isbn}</strong>
                      <span className="error-text">{e.message}</span>
                    </>
                  )}
                </div>
                <div className="log-actions">
                  {(e.state === 'saved' || e.state === 'notfound') && (
                    <>
                      <button className="btn btn-sm" onClick={() => onEdit(e.book)}>
                        {t('common.edit')}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => undo(e)}>
                        {t('quick.undo')}
                      </button>
                    </>
                  )}
                  {e.state === 'duplicate' && (
                    <button className="btn btn-sm" onClick={() => addCopy(e)}>
                      {t('quick.addCopy')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
