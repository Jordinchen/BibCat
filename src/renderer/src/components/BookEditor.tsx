import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import {
  EMPTY_BOOK,
  READ_STATUS_LABELS,
  type Book,
  type BookInput,
  type Location,
  type ReadStatus,
  type Subject
} from '@shared/types'
import { cleanIsbn, isValidIsbn } from '@shared/isbn'
import { Modal } from './Modal'
import { Stars } from './Stars'
import { Cover } from './Cover'
import { flattenLocations } from '../util'
import { fetchBookData } from '../lookup'

// Der Barcode-Leser ist groß und wird erst bei Bedarf geladen
const Scanner = lazy(() => import('./Scanner').then((m) => ({ default: m.Scanner })))

interface Props {
  book: Book | null
  subjects: Subject[]
  locations: Location[]
  onClose: () => void
  onSaved: (b: Book) => void
}

function toInput(b: Book | null): BookInput {
  if (!b) return { ...EMPTY_BOOK }
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = b
  return rest
}

function Field({
  label,
  children,
  span = 1,
  hint
}: {
  label: string
  children: ReactNode
  span?: number
  hint?: string
}) {
  return (
    <label className="field" style={{ gridColumn: `span ${span}` }}>
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function BookEditor({ book, subjects, locations, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BookInput>(() => toInput(book))
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'info' | 'warn' | 'error'; text: string } | null>(null)
  const locs = useMemo(() => flattenLocations(locations), [locations])

  const set = <K extends keyof BookInput>(k: K, v: BookInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const text = (k: keyof BookInput) => ({
    value: (form[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(k, e.target.value as never)
  })

  async function lookup(raw = form.isbn) {
    const isbn = cleanIsbn(raw)
    if (!isValidIsbn(isbn)) {
      setMsg({ kind: 'error', text: 'Die ISBN ist ungültig (Prüfziffer stimmt nicht).' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const dup = await window.bibcat.books.findByIsbn(isbn)
      const { data, sources, coverFile } = await fetchBookData(isbn)
      if (!sources.length) {
        setForm((f) => ({ ...f, isbn }))
        setMsg({ kind: 'warn', text: 'Keine Daten gefunden. Bitte manuell erfassen.' })
        return
      }
      // Bereits ausgefüllte Felder bleiben erhalten
      setForm((f) => {
        const next = { ...f, isbn }
        for (const [k, v] of Object.entries(data)) {
          const cur = (f as Record<string, unknown>)[k]
          if (cur === '' || cur === null || cur === undefined) (next as Record<string, unknown>)[k] = v
        }
        if (!f.coverFile && coverFile) next.coverFile = coverFile
        return next
      })
      const dupNote =
        dup && dup.id !== book?.id ? ` Achtung: Diese ISBN ist bereits als „${dup.title}" erfasst.` : ''
      setMsg({
        kind: dupNote ? 'warn' : 'info',
        text: `Daten übernommen aus: ${sources.join(', ')}.${dupNote}`
      })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!form.title.trim()) {
      setMsg({ kind: 'error', text: 'Bitte mindestens einen Titel angeben.' })
      return
    }
    setBusy(true)
    try {
      const saved = book
        ? await window.bibcat.books.update(book.id, form)
        : await window.bibcat.books.create(form)
      onSaved(saved)
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={book ? 'Buch bearbeiten' : 'Neues Buch'}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Speichern
          </button>
        </>
      }
    >
      <div className="editor">
        <aside className="editor-side">
          <Cover book={form} className="cover-lg" />
          <div className="row gap-sm">
            <button
              className="btn btn-sm"
              onClick={async () => {
                const f = await window.bibcat.covers.pick()
                if (f) set('coverFile', f)
              }}
            >
              Bild wählen…
            </button>
            {form.coverFile && (
              <button className="btn btn-sm btn-ghost" onClick={() => set('coverFile', '')}>
                Entfernen
              </button>
            )}
          </div>
          <div className="side-block">
            <span className="field-label">Bewertung</span>
            <Stars value={form.rating} onChange={(v) => set('rating', v)} />
          </div>
          <div className="side-block">
            <span className="field-label">Lesestatus</span>
            <div className="segmented vertical">
              {(Object.keys(READ_STATUS_LABELS) as ReadStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={form.readStatus === s ? 'active' : ''}
                  onClick={() => set('readStatus', s)}
                >
                  {READ_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          {(form.readStatus === 'read' || form.readDate) && (
            <Field label="Gelesen am">
              <input type="date" {...text('readDate')} />
            </Field>
          )}
        </aside>

        <div className="editor-main">
          <div className="isbn-bar">
            <input
              className="isbn-input"
              placeholder="ISBN eingeben oder scannen"
              value={form.isbn}
              onChange={(e) => set('isbn', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              autoFocus={!book}
            />
            <button className="btn" onClick={() => lookup()} disabled={busy || !form.isbn}>
              {busy ? 'Suche…' : 'Daten abrufen'}
            </button>
            <button className={`btn ${scan ? 'btn-active' : ''}`} onClick={() => setScan((s) => !s)}>
              📷 Scannen
            </button>
          </div>
          {scan && (
            <Suspense fallback={null}>
              <Scanner
                onIsbn={(isbn) => {
                  setScan(false)
                  set('isbn', isbn)
                  lookup(isbn)
                }}
              />
            </Suspense>
          )}
          {msg && <div className={`notice notice-${msg.kind}`}>{msg.text}</div>}

          <section>
            <h3>Titel und Verantwortlichkeit</h3>
            <div className="grid">
              <Field label="Titel" span={4}>
                <input {...text('title')} />
              </Field>
              <Field label="Untertitel" span={4}>
                <input {...text('subtitle')} />
              </Field>
              <Field label="Autor(en)" span={2} hint="Nachname, Vorname; …">
                <input {...text('authors')} />
              </Field>
              <Field label="Weitere Beteiligte" span={2} hint="Hrsg., Übers. …">
                <input {...text('contributors')} />
              </Field>
            </div>
          </section>

          <section>
            <h3>Veröffentlichung</h3>
            <div className="grid">
              <Field label="Verlag" span={2}>
                <input {...text('publisher')} />
              </Field>
              <Field label="Ort">
                <input {...text('place')} />
              </Field>
              <Field label="Jahr">
                <input {...text('year')} inputMode="numeric" />
              </Field>
              <Field label="Auflage">
                <input {...text('edition')} />
              </Field>
              <Field label="Seiten">
                <input
                  type="number"
                  min={0}
                  value={form.pages ?? ''}
                  onChange={(e) => set('pages', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Einband">
                <input {...text('binding')} list="bindings" />
              </Field>
              <Field label="Sprache">
                <input {...text('language')} list="languages" />
              </Field>
              <Field label="Reihe" span={3}>
                <input {...text('series')} />
              </Field>
              <Field label="Band">
                <input {...text('seriesNumber')} />
              </Field>
            </div>
          </section>

          <section>
            <h3>Erschließung und Bestand</h3>
            <div className="grid">
              <Field label="Fachgebiet" span={2}>
                <select
                  value={form.subjectId ?? ''}
                  onChange={(e) => set('subjectId', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— keines —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.notation ? `${s.notation} ` : ''}
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Signatur" span={2}>
                <input {...text('callNumber')} placeholder="z. B. LIT 120 KEH" />
              </Field>
              <Field label="Schlagworte" span={4} hint="kommagetrennt">
                <input {...text('keywords')} />
              </Field>
              <Field label="Standort" span={2}>
                <select
                  value={form.locationId ?? ''}
                  onChange={(e) => set('locationId', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— nicht zugeordnet —</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {'  '.repeat(l.depth)}
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Exemplare">
                <input
                  type="number"
                  min={0}
                  value={form.copies}
                  onChange={(e) => set('copies', Number(e.target.value))}
                />
              </Field>
              <Field label="Erworben am">
                <input type="date" {...text('acquiredDate')} />
              </Field>
            </div>
          </section>

          <section>
            <h3>Inhalt und Notizen</h3>
            <div className="grid">
              <Field label="Beschreibung" span={4}>
                <textarea rows={3} {...text('description')} />
              </Field>
              <Field label="Eigene Notizen" span={4}>
                <textarea rows={3} {...text('notes')} />
              </Field>
            </div>
          </section>
        </div>
      </div>
      <datalist id="bindings">
        <option value="Hardcover" />
        <option value="Taschenbuch" />
        <option value="Broschur" />
        <option value="Leinen" />
        <option value="Halbleder" />
      </datalist>
      <datalist id="languages">
        <option value="ger" label="Deutsch" />
        <option value="eng" label="Englisch" />
        <option value="fre" label="Französisch" />
        <option value="lat" label="Latein" />
      </datalist>
    </Modal>
  )
}
