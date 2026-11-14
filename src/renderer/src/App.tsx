import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Book, BookQuery, Location, SortField, Stats, Subject } from '@shared/types'
import { Sidebar, type Filter } from './components/Sidebar'
import { BookGrid, BookTable } from './components/BookViews'
import { BookDetail } from './components/BookDetail'
import { BookEditor } from './components/BookEditor'
import { QuickCapture } from './components/QuickCapture'
import { LocationManager, SubjectManager } from './components/Managers'
import { flattenLocations } from './util'

type View = 'grid' | 'table'
type Dialog =
  | { kind: 'none' }
  | { kind: 'edit'; book: Book | null }
  | { kind: 'quick' }
  | { kind: 'subjects' }
  | { kind: 'locations' }

const SORT_LABELS: Record<SortField, string> = {
  title: 'Titel',
  authors: 'Autor',
  year: 'Erscheinungsjahr',
  createdAt: 'Zuletzt erfasst',
  rating: 'Bewertung',
  callNumber: 'Signatur'
}

function loadPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortField>(() => loadPref('sort', 'title'))
  const [view, setView] = useState<View>(() => loadPref('view', 'grid'))
  const [selected, setSelected] = useState<Book | null>(null)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  // Bearbeiten aus der Schnellerfassung heraus: Schnellerfassung bleibt darunter offen
  const [stackedEdit, setStackedEdit] = useState<Book | null>(null)
  const [toast, setToast] = useState('')

  const query = useMemo<BookQuery>(() => {
    const q: BookQuery = { text: search, sort, desc: sort === 'createdAt' || sort === 'rating' }
    if (filter.kind === 'status') q.readStatus = filter.status
    if (filter.kind === 'subject') q.subjectId = filter.id
    if (filter.kind === 'location') q.locationId = filter.id
    if (filter.kind === 'favorites') q.minRating = 4
    return q
  }, [filter, search, sort])

  const refresh = useCallback(async () => {
    const [b, s, l, st] = await Promise.all([
      window.bibcat.books.list(query),
      window.bibcat.subjects.list(),
      window.bibcat.locations.list(),
      window.bibcat.books.stats()
    ])
    setBooks(b)
    setSubjects(s)
    setLocations(l)
    setStats(st)
    setSelected((cur) => (cur ? (b.find((x) => x.id === cur.id) ?? null) : null))
  }, [query])

  useEffect(() => {
    const t = setTimeout(refresh, 120)
    return () => clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    try {
      localStorage.setItem('sort', sort)
      localStorage.setItem('view', view)
    } catch {
      /* ignorieren */
    }
  }, [sort, view])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // Tastenkürzel: Strg/Cmd+N neues Buch, Strg/Cmd+F Suche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setDialog({ kind: 'edit', book: null })
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        document.getElementById('search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const locationNodes = useMemo(() => new Map(flattenLocations(locations).map((l) => [l.id, l])), [locations])

  async function patch(b: Book, p: Partial<Book>) {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = { ...b, ...p }
    const saved = await window.bibcat.books.update(id, rest)
    setSelected(saved)
    refresh()
  }

  async function remove(b: Book) {
    if (!confirm(`„${b.title}" wirklich aus dem Katalog löschen?`)) return
    await window.bibcat.books.remove(b.id)
    setSelected(null)
    refresh()
  }

  const heading = (() => {
    switch (filter.kind) {
      case 'all':
        return 'Alle Bücher'
      case 'favorites':
        return 'Lieblingsbücher'
      case 'status':
        return { unread: 'Ungelesen', reading: 'Lese ich gerade', read: 'Gelesen', abandoned: 'Abgebrochen' }[
          filter.status
        ]
      case 'subject':
        return subjectMap.get(filter.id)?.name ?? 'Fachgebiet'
      case 'location':
        return locationNodes.get(filter.id)?.path ?? 'Standort'
    }
  })()

  const emptyCatalog = stats?.total === 0

  return (
    <div className={`app ${selected ? 'with-detail' : ''}`}>
      <Sidebar
        filter={filter}
        onFilter={(f) => {
          setFilter(f)
          setSelected(null)
        }}
        stats={stats}
        subjects={subjects}
        locations={locations}
        onNew={() => setDialog({ kind: 'edit', book: null })}
        onQuick={() => setDialog({ kind: 'quick' })}
        onManageSubjects={() => setDialog({ kind: 'subjects' })}
        onManageLocations={() => setDialog({ kind: 'locations' })}
        onExport={async () => {
          const f = await window.bibcat.data.exportCsv()
          if (f) setToast(`Exportiert nach ${f}`)
        }}
        onBackup={async () => {
          const f = await window.bibcat.data.backup()
          if (f) setToast(`Sicherung erstellt: ${f}`)
        }}
      />

      <main className="main">
        <header className="toolbar">
          <div className="toolbar-title">
            <h1>{heading}</h1>
            <span className="muted">
              {books.length} {books.length === 1 ? 'Titel' : 'Titel'}
            </span>
          </div>
          <div className="search">
            <span className="search-icon">⌕</span>
            <input
              id="search"
              type="search"
              placeholder="Titel, Autor, Schlagwort, Signatur, ISBN …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortField)} aria-label="Sortierung">
            {(Object.keys(SORT_LABELS) as SortField[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="segmented">
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
              title="Raster"
            >
              ▦
            </button>
            <button
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
              title="Liste"
            >
              ☰
            </button>
          </div>
        </header>

        <div className="content">
          {emptyCatalog ? (
            <div className="empty">
              <div className="empty-mark">📚</div>
              <h2>Willkommen bei BibCat</h2>
              <p>
                Lege zuerst deine Standorte (Räume, Regale) an und erfasse dann Bücher – am schnellsten per
                Barcode.
              </p>
              <div className="row gap-sm center">
                <button className="btn" onClick={() => setDialog({ kind: 'locations' })}>
                  Standorte anlegen
                </button>
                <button className="btn btn-primary" onClick={() => setDialog({ kind: 'quick' })}>
                  Bücher scannen
                </button>
              </div>
            </div>
          ) : books.length === 0 ? (
            <div className="empty">
              <p className="muted">Keine Bücher gefunden.</p>
            </div>
          ) : view === 'grid' ? (
            <BookGrid
              books={books}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onOpen={(b) => setDialog({ kind: 'edit', book: b })}
              subjects={subjectMap}
            />
          ) : (
            <BookTable
              books={books}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onOpen={(b) => setDialog({ kind: 'edit', book: b })}
              subjects={subjectMap}
            />
          )}
        </div>
      </main>

      {selected && (
        <BookDetail
          key={selected.id}
          book={selected}
          subject={selected.subjectId != null ? subjectMap.get(selected.subjectId) : undefined}
          location={selected.locationId != null ? locationNodes.get(selected.locationId) : undefined}
          onEdit={() => setDialog({ kind: 'edit', book: selected })}
          onDelete={() => remove(selected)}
          onPatch={(p) => patch(selected, p)}
          onClose={() => setSelected(null)}
        />
      )}

      {dialog.kind === 'edit' && (
        <BookEditor
          book={dialog.book}
          subjects={subjects}
          locations={locations}
          onClose={() => setDialog({ kind: 'none' })}
          onSaved={(b) => {
            setDialog({ kind: 'none' })
            setSelected(b)
            refresh()
          }}
        />
      )}
      {dialog.kind === 'quick' && (
        <QuickCapture
          subjects={subjects}
          locations={locations}
          onClose={() => setDialog({ kind: 'none' })}
          onChanged={refresh}
          onEdit={(b) => setStackedEdit(b)}
        />
      )}
      {stackedEdit && (
        <BookEditor
          book={stackedEdit}
          subjects={subjects}
          locations={locations}
          onClose={() => setStackedEdit(null)}
          onSaved={() => {
            setStackedEdit(null)
            refresh()
          }}
        />
      )}
      {dialog.kind === 'subjects' && (
        <SubjectManager subjects={subjects} onClose={() => setDialog({ kind: 'none' })} onChanged={refresh} />
      )}
      {dialog.kind === 'locations' && (
        <LocationManager
          locations={locations}
          onClose={() => setDialog({ kind: 'none' })}
          onChanged={refresh}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
