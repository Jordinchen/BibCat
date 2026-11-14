import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Camera, ImagePlus, Search } from 'lucide-react'
import {
  EMPTY_BOOK,
  READ_STATUSES,
  type Book,
  type BookInput,
  type Location,
  type Subject
} from '@shared/types'
import { classifyCode, MEDIA_TYPES, type MediaType } from '@shared/media'
import { cleanIsbn } from '@shared/isbn'
import { Modal } from './Modal'
import { Stars } from './Stars'
import { Cover } from './Cover'
import { TitleSearch } from './TitleSearch'
import { errMsg, flattenLocations } from '../util'
import { fetchMediaData, type LookupOutcome } from '../lookup'
import {
  bindingOptions,
  fieldLabel,
  MEDIA_ICONS,
  readDateLabel,
  SEARCHABLE,
  shows,
  statusLabel
} from '../media'
import { useI18n } from '../i18n'

// Der Barcode-Leser ist groß und wird erst bei Bedarf geladen
const Scanner = lazy(() => import('./Scanner').then((m) => ({ default: m.Scanner })))

interface Props {
  book: Book | null
  /** Medienart für neue Einträge (z. B. aus dem aktiven Filter) */
  defaultType?: MediaType
  subjects: Subject[]
  locations: Location[]
  onClose: () => void
  onSaved: (b: Book) => void
}

function toInput(b: Book | null, type: MediaType): BookInput {
  if (!b) return { ...EMPTY_BOOK, mediaType: type }
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

const LANG_CODES = ['ger', 'eng', 'fre', 'lat'] as const
const isEmpty = (v: unknown) => v === '' || v === null || v === undefined

export function BookEditor({ book, defaultType = 'book', subjects, locations, onClose, onSaved }: Props) {
  const { t } = useI18n()
  const [form, setForm] = useState<BookInput>(() => toInput(book, defaultType))
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'info' | 'warn' | 'error'; text: string } | null>(null)
  const locs = useMemo(() => flattenLocations(locations), [locations])
  const type = form.mediaType
  const L = (field: string) => fieldLabel(t, field, type)
  const show = (field: keyof BookInput) => shows(type, field)

  const set = <K extends keyof BookInput>(k: K, v: BookInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const text = (k: keyof BookInput) => ({
    value: (form[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(k, e.target.value as never)
  })
  const num = (k: 'pages' | 'duration') => ({
    type: 'number',
    min: 0,
    value: form[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(k, e.target.value ? Number(e.target.value) : null)
  })

  /**
   * Gefundene Daten übernehmen. Bei der Code-Abfrage werden nur leere Felder gefüllt;
   * bei einem bewusst gewählten Suchtreffer ersetzen dessen Angaben die bisherigen.
   */
  function apply(r: LookupOutcome, overwrite: boolean) {
    setForm((f) => {
      const next = { ...f } as Record<string, unknown>
      for (const [k, v] of Object.entries(r.data)) {
        if (k === 'mediaType') continue
        if (isEmpty(v)) continue
        if (overwrite || isEmpty(next[k])) next[k] = v
      }
      // Die Quelle legt die Art fest (z. B. Barcode → Musik), Comics bleiben Comics
      if (r.data.mediaType && r.data.mediaType !== 'book') next.mediaType = r.data.mediaType
      if (r.coverFile && (overwrite || !f.coverFile)) next.coverFile = r.coverFile
      return next as unknown as BookInput
    })
  }

  async function lookup(raw = form.isbn) {
    const code = cleanIsbn(raw)
    if (classifyCode(code) === 'invalid') {
      setMsg({ kind: 'error', text: t('msg.invalidCode') })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const dup = await window.bibcraft.books.findByIsbn(code)
      const r = await fetchMediaData(code)
      if (!r.sources.length) {
        setForm((f) => ({ ...f, isbn: code }))
        setMsg({ kind: 'warn', text: t('msg.noData') })
        return
      }
      apply({ ...r, data: { ...r.data, isbn: code } }, false)
      const isDup = dup && dup.id !== book?.id
      const text =
        t('msg.dataFrom', { sources: r.sources.join(', ') }) +
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
      title={t(book ? 'editor.titleEditType' : 'editor.titleNewType', { type: t(`media.${type}`) })}
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
      <div className="media-picker" role="radiogroup" aria-label={t('field.mediaType')}>
        {MEDIA_TYPES.map((m) => {
          const Icon = MEDIA_ICONS[m]
          return (
            <button
              key={m}
              role="radio"
              aria-checked={type === m}
              className={type === m ? 'on' : ''}
              onClick={() => set('mediaType', m)}
            >
              <Icon size={16} strokeWidth={1.75} />
              {t(`media.${m}`)}
            </button>
          )
        })}
      </div>

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
            <span className="field-label">{t('nav.status')}</span>
            <div className="segmented vertical">
              {READ_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={form.readStatus === s ? 'active' : ''}
                  onClick={() => set('readStatus', s)}
                >
                  {statusLabel(t, s, type)}
                </button>
              ))}
            </div>
          </div>
          {(form.readStatus === 'read' || form.readDate) && (
            <Field label={readDateLabel(t, type)}>
              <input type="date" {...text('readDate')} />
            </Field>
          )}
        </aside>

        <div className="editor-main">
          <div className="isbn-bar">
            <input
              className="isbn-input"
              placeholder={t('editor.codePlaceholder')}
              aria-label={L('code')}
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
            {SEARCHABLE.includes(type) && (
              <button className="btn" onClick={() => setSearching(true)}>
                <Search size={16} /> {t('editor.searchOnline')}
              </button>
            )}
          </div>
          {scan && (
            <Suspense fallback={null}>
              <Scanner
                anyCode
                onIsbn={(code) => {
                  setScan(false)
                  set('isbn', code)
                  lookup(code)
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
              <Field label={L('authors')} span={show('contributors') ? 2 : 4} hint={L('authorsHint')}>
                <input {...text('authors')} />
              </Field>
              {show('contributors') && (
                <Field label={L('contributors')} span={2} hint={L('contributorsHint')}>
                  <input {...text('contributors')} />
                </Field>
              )}
            </div>
          </section>

          <section>
            <h3>{t('editor.secPublication')}</h3>
            <div className="grid">
              <Field label={L('publisher')} span={show('place') ? 2 : 3}>
                <input {...text('publisher')} />
              </Field>
              {show('place') && (
                <Field label={t('field.place')}>
                  <input {...text('place')} />
                </Field>
              )}
              <Field label={t('field.year')}>
                <input {...text('year')} inputMode="numeric" />
              </Field>
              <Field label={L('edition')}>
                <input {...text('edition')} />
              </Field>
              {show('pages') && (
                <Field label={t('field.pages')}>
                  <input {...num('pages')} />
                </Field>
              )}
              {show('duration') && (
                <Field label={L('duration')}>
                  <input {...num('duration')} />
                </Field>
              )}
              <Field label={L('binding')}>
                <input {...text('binding')} list={`bindings-${type}`} />
              </Field>
              <Field label={t('field.language')}>
                <input {...text('language')} list="languages" />
              </Field>
              {show('ageRating') && (
                <Field label={t('field.ageRating')} hint={t('field.ageRatingHint')}>
                  <input {...text('ageRating')} />
                </Field>
              )}
              {show('players') && (
                <Field label={t('field.players')} hint={t('field.playersHint')}>
                  <input {...text('players')} />
                </Field>
              )}
              {show('series') && (
                <Field label={L('series')} span={3}>
                  <input {...text('series')} />
                </Field>
              )}
              {show('seriesNumber') && (
                <Field label={L('seriesNumber')}>
                  <input {...text('seriesNumber')} />
                </Field>
              )}
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
              {show('tracks') && (
                <Field label={t('field.tracks')} span={4} hint={t('field.tracksHint')}>
                  <textarea rows={6} className="mono" {...text('tracks')} />
                </Field>
              )}
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
      {MEDIA_TYPES.map((m) => (
        <datalist key={m} id={`bindings-${m}`}>
          {bindingOptions(t, m).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ))}
      <datalist id="languages">
        {LANG_CODES.map((c) => (
          <option key={c} value={c} label={t(`lang.${c}`)} />
        ))}
      </datalist>
      {searching && (
        <TitleSearch
          type={type}
          initialQuery={[form.title, type === 'music' ? form.authors.split(';')[0] : '']
            .filter(Boolean)
            .join(' ')}
          onClose={() => setSearching(false)}
          onPick={(r) => {
            setSearching(false)
            apply(r, true)
            setMsg({ kind: 'info', text: t('msg.dataFrom', { sources: r.sources.join(', ') }) })
          }}
        />
      )}
    </Modal>
  )
}
