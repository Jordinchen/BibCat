import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import {
  EMPTY_BOOK,
  READ_STATUS_LABELS,
  type Book,
  type BookInput,
  type Location,
  type ReadStatus,
  type Subject
} from '@shared/types'
import { cleanIsbn, isValidIsbn, toIsbn13 } from '@shared/isbn'
import { Modal } from './Modal'
import { Cover } from './Cover'
import { flattenLocations, primaryAuthor } from '../util'
import { fetchBookData } from '../lookup'

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
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [readStatus, setReadStatus] = useState<ReadStatus>('unread')
  const [entries, setEntries] = useState<Entry[]>([])
  const queue = useRef(Promise.resolve())
  const seq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const locs = useMemo(() => flattenLocations(locations), [locations])

  const defaults = useRef({ locationId, subjectId, readStatus })
  defaults.current = { locationId, subjectId, readStatus }

  const update = (key: number, e: Entry) => setEntries((list) => list.map((x) => (x.key === key ? e : x)))

  async function process(key: number, raw: string) {
    const isbn = toIsbn13(raw)!
    try {
      const dup = await window.bibcat.books.findByIsbn(isbn)
      if (dup) {
        update(key, { key, isbn, state: 'duplicate', book: dup })
        return
      }
      const { data, sources, coverFile } = await fetchBookData(isbn)
      const base: BookInput = {
        ...EMPTY_BOOK,
        ...data,
        isbn,
        coverFile,
        ...defaults.current,
        acquiredDate: ''
      }
      if (!sources.length) {
        // Platzhalter anlegen, damit nichts verloren geht – Titel später nachtragen
        const book = await window.bibcat.books.create({ ...base, title: `Unbekannt (ISBN ${isbn})` })
        update(key, { key, isbn, state: 'notfound', book })
      } else {
        const book = await window.bibcat.books.create(base)
        update(key, { key, isbn, state: 'saved', book, sources })
      }
      onChanged()
    } catch (e) {
      update(key, { key, isbn, state: 'error', message: (e as Error).message })
    }
  }

  function submit(raw: string) {
    const cleaned = cleanIsbn(raw)
    if (!cleaned) return
    const key = ++seq.current
    if (!isValidIsbn(cleaned)) {
      setEntries((l) => [{ key, isbn: cleaned, state: 'invalid' }, ...l])
      return
    }
    setEntries((l) => [{ key, isbn: toIsbn13(cleaned)!, state: 'pending' }, ...l])
    // Nacheinander abarbeiten, damit Duplikate beim schnellen Scannen erkannt werden
    queue.current = queue.current.then(() => process(key, cleaned))
  }

  async function addCopy(entry: Extract<Entry, { state: 'duplicate' }>) {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = entry.book
    const book = await window.bibcat.books.update(id, { ...rest, copies: rest.copies + 1 })
    update(entry.key, { ...entry, book })
    onChanged()
    inputRef.current?.focus()
  }

  async function undo(entry: Entry & { book: Book }) {
    await window.bibcat.books.remove(entry.book.id)
    setEntries((l) => l.filter((x) => x.key !== entry.key))
    onChanged()
    inputRef.current?.focus()
  }

  const savedCount = entries.filter((e) => e.state === 'saved' || e.state === 'notfound').length

  return (
    <Modal wide title="Schnellerfassung" onClose={onClose}>
      <div className="quick">
        <div className="quick-left">
          <p className="muted">
            ISBN eintippen oder mit einem USB-Barcodescanner einlesen – jedes Buch wird sofort gespeichert.
            Die Voreinstellungen unten gelten für alle neuen Bücher.
          </p>
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
              📷 Kamera
            </button>
          </div>
          {camera && (
            <Suspense fallback={null}>
              <Scanner continuous onIsbn={submit} />
            </Suspense>
          )}

          <div className="quick-defaults">
            <label className="field">
              <span className="field-label">Standort</span>
              <select
                value={locationId ?? ''}
                onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— nicht zugeordnet —</option>
                {locs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.path}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Fachgebiet</span>
              <select
                value={subjectId ?? ''}
                onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— keines —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Lesestatus</span>
              <select value={readStatus} onChange={(e) => setReadStatus(e.target.value as ReadStatus)}>
                {(Object.keys(READ_STATUS_LABELS) as ReadStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {READ_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="quick-log">
          <div className="quick-log-head">
            <strong>In dieser Sitzung erfasst: {savedCount}</strong>
          </div>
          {entries.length === 0 && <div className="empty-small">Noch nichts gescannt.</div>}
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
                      <span className="muted">wird abgefragt …</span>
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
                      <span className="warn-text">Keine Daten gefunden – Platzhalter angelegt</span>
                    </>
                  )}
                  {e.state === 'duplicate' && (
                    <>
                      <strong>{e.book.title}</strong>
                      <span className="warn-text">Bereits im Katalog ({e.book.copies} Expl.)</span>
                    </>
                  )}
                  {e.state === 'invalid' && (
                    <>
                      <strong>{e.isbn}</strong>
                      <span className="error-text">Ungültige ISBN</span>
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
                        Bearbeiten
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => undo(e)}>
                        Rückgängig
                      </button>
                    </>
                  )}
                  {e.state === 'duplicate' && (
                    <button className="btn btn-sm" onClick={() => addCopy(e)}>
                      + Exemplar
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
