import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import {
  EMPTY_BOOK,
  READ_STATUSES,
  type Book,
  type BookInput,
  type Location,
  type Subject
} from '@shared/types'
import type { TKey } from '@shared/i18n'
import { cleanIsbn, isValidIsbn } from '@shared/isbn'
import { Modal } from './Modal'
import { Stars } from './Stars'
import { Cover } from './Cover'
import { errMsg, flattenLocations } from '../util'
import { fetchBookData } from '../lookup'
import { useI18n } from '../i18n'

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

const BINDINGS: TKey[] = [
  'binding.hardcover',
  'binding.paperback',
  'binding.softcover',
  'binding.cloth',
  'binding.halfLeather'
]
const LANG_CODES = ['ger', 'eng', 'fre', 'lat'] as const

export function BookEditor({ book, subjects, locations, onClose, onSaved }: Props) {
  const { t } = useI18n()
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
      setMsg({ kind: 'error', text: t('msg.invalidIsbn') })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const dup = await window.bibcraft.books.findByIsbn(isbn)
      const { data, sources, coverFile } = await fetchBookData(isbn)
      if (!sources.length) {
        setForm((f) => ({ ...f, isbn }))
        setMsg({ kind: 'warn', text: t('msg.noData') })
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
      const isDup = dup && dup.id !== book?.id
      const text =
        t('msg.dataFrom', { sources: sources.join(', ') }) +
        (isDup ? ' ' + t('msg.duplicate', { title: dup.title }) : '')
      setMsg({ kind: isDup ? 'warn' : 'info', text })
    } catch (e) {
      setMsg({ kind: 'error', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!form.title.trim()) {
      setMsg({ kind: 'error', text: t('msg.titleRequired') })
      return
    }
    setBusy(true)
    try {
      const saved = book
        ? await window.bibcraft.books.update(book.id, form)
        : await window.bibcraft.books.create(form)
      onSaved(saved)
    } catch (e) {
      setMsg({ kind: 'error', text: errMsg(e) })
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={book ? t('editor.titleEdit') : t('editor.titleNew')}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {t('common.save')}
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
                const f = await window.bibcraft.covers.pick()
                if (f) set('coverFile', f)
              }}
            >
              <ImagePlus size={14} /> {t('editor.pickImage')}
            </button>
            {form.coverFile && (
              <button className="btn btn-sm btn-ghost" onClick={() => set('coverFile', '')}>
                {t('editor.removeImage')}
              </button>
            )}
          </div>
          <div className="side-block">
            <span className="field-label">{t('editor.rating')}</span>
            <Stars value={form.rating} onChange={(v) => set('rating', v)} />
          </div>
          <div className="side-block">
            <span className="field-label">{t('editor.readStatus')}</span>
            <div className="segmented vertical">
              {READ_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={form.readStatus === s ? 'active' : ''}
                  onClick={() => set('readStatus', s)}
                >
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
          </div>
          {(form.readStatus === 'read' || form.readDate) && (
            <Field label={t('editor.readDate')}>
              <input type="date" {...text('readDate')} />
            </Field>
          )}
        </aside>

        <div className="editor-main">
          <div className="isbn-bar">
            <input
              className="isbn-input"
              placeholder={t('editor.isbnPlaceholder')}
              value={form.isbn}
              onChange={(e) => set('isbn', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              autoFocus={!book}
            />
            <button className="btn" onClick={() => lookup()} disabled={busy || !form.isbn}>
              {busy ? t('editor.fetching') : t('editor.fetch')}
            </button>
            <button className={`btn ${scan ? 'btn-active' : ''}`} onClick={() => setScan((s) => !s)}>
              <Camera size={16} /> {t('editor.scan')}
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
            <h3>{t('editor.secTitle')}</h3>
            <div className="grid">
              <Field label={t('field.title')} span={4}>
                <input {...text('title')} />
              </Field>
              <Field label={t('field.subtitle')} span={4}>
                <input {...text('subtitle')} />
              </Field>
              <Field label={t('field.authors')} span={2} hint={t('field.authorsHint')}>
                <input {...text('authors')} />
              </Field>
              <Field label={t('field.contributors')} span={2} hint={t('field.contributorsHint')}>
                <input {...text('contributors')} />
              </Field>
            </div>
          </section>

          <section>
            <h3>{t('editor.secPublication')}</h3>
            <div className="grid">
              <Field label={t('field.publisher')} span={2}>
                <input {...text('publisher')} />
              </Field>
              <Field label={t('field.place')}>
                <input {...text('place')} />
              </Field>
              <Field label={t('field.year')}>
                <input {...text('year')} inputMode="numeric" />
              </Field>
              <Field label={t('field.edition')}>
                <input {...text('edition')} />
              </Field>
              <Field label={t('field.pages')}>
                <input
                  type="number"
                  min={0}
                  value={form.pages ?? ''}
                  onChange={(e) => set('pages', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label={t('field.binding')}>
                <input {...text('binding')} list="bindings" />
              </Field>
              <Field label={t('field.language')}>
                <input {...text('language')} list="languages" />
              </Field>
              <Field label={t('field.series')} span={3}>
                <input {...text('series')} />
              </Field>
              <Field label={t('field.seriesNumber')}>
                <input {...text('seriesNumber')} />
              </Field>
            </div>
          </section>

          <section>
            <h3>{t('editor.secIndexing')}</h3>
            <div className="grid">
              <Field label={t('field.subject')} span={2}>
                <select
                  value={form.subjectId ?? ''}
                  onChange={(e) => set('subjectId', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t('common.none')}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.notation ? `${s.notation} ` : ''}
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('field.callNumber')} span={2}>
                <input {...text('callNumber')} placeholder={t('field.callNumberPlaceholder')} />
              </Field>
              <Field label={t('field.keywords')} span={4} hint={t('field.keywordsHint')}>
                <input {...text('keywords')} />
              </Field>
              <Field label={t('field.location')} span={2}>
                <select
                  value={form.locationId ?? ''}
                  onChange={(e) => set('locationId', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t('common.unassigned')}</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {'  '.repeat(l.depth)}
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('field.copies')}>
                <input
                  type="number"
                  min={0}
                  value={form.copies}
                  onChange={(e) => set('copies', Number(e.target.value))}
                />
              </Field>
              <Field label={t('field.acquired')}>
                <input type="date" {...text('acquiredDate')} />
              </Field>
            </div>
          </section>

          <section>
            <h3>{t('editor.secContent')}</h3>
            <div className="grid">
              <Field label={t('field.description')} span={4}>
                <textarea rows={3} {...text('description')} />
              </Field>
              <Field label={t('field.notes')} span={4}>
                <textarea rows={3} {...text('notes')} />
              </Field>
            </div>
          </section>
        </div>
      </div>
      <datalist id="bindings">
        {BINDINGS.map((k) => (
          <option key={k} value={t(k)} />
        ))}
      </datalist>
      <datalist id="languages">
        {LANG_CODES.map((c) => (
          <option key={c} value={c} label={t(`lang.${c}`)} />
        ))}
      </datalist>
    </Modal>
  )
}
