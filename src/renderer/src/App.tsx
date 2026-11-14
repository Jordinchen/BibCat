import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import type { AppInfo, Book, BookQuery, Location, SortField, Stats, Subject } from '@shared/types'
import type { Lang } from '@shared/i18n'
import { Sidebar, type Filter } from './components/Sidebar'
import { Ribbon } from './components/Ribbon'
import { BookGrid, BookTable } from './components/BookViews'
import { BookDetail } from './components/BookDetail'
import { BookEditor } from './components/BookEditor'
import { QuickCapture } from './components/QuickCapture'
import { LocationManager, SubjectManager } from './components/Managers'
import { errMsg, flattenLocations } from './util'
import { I18nProvider, useI18n } from './i18n'

type View = 'grid' | 'table'
type Dialog =
  | { kind: 'none' }
  | { kind: 'edit'; book: Book | null }
  | { kind: 'quick' }
  | { kind: 'subjects' }
  | { kind: 'locations' }

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}
function savePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignorieren */
  }
}
function usePref<T>(key: string, fallback: T) {
  const [v, setV] = useState<T>(() => loadPref(key, fallback))
  useEffect(() => savePref(key, v), [key, v])
  return [v, setV] as const
}

export default function App({ info }: { info: AppInfo }) {
  const [lang, setLang] = useState<Lang>(info.language)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return (
    <I18nProvider lang={lang}>
      <Shell
        info={info}
        onLang={(l) => {
          setLang(l)
          window.bibcraft.app.setLanguage(l)
        }}
      />
    </I18nProvider>
  )
}

function Shell({ info, onLang }: { info: AppInfo; onLang: (l: Lang) => void }) {
  const { t, lang } = useI18n()
  const [books, setBooks] = useState<Book[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [sort, setSort] = usePref<SortField>('sort', 'title')
  const [desc, setDesc] = usePref('desc', false)
  const [view, setView] = usePref<View>('view', 'grid')
  const [navPane, setNavPane] = usePref('navPane', true)
  const [detailPane, setDetailPane] = usePref('detailPane', true)
  const [selected, setSelected] = useState<Book | null>(null)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  // Bearbeiten aus der Schnellerfassung heraus: Schnellerfassung bleibt darunter offen
  const [stackedEdit, setStackedEdit] = useState<Book | null>(null)
  const [toast, setToast] = useState(() => (info.migratedFromBibCat ? t('msg.migrated') : ''))

  const query = useMemo<BookQuery>(() => {
    const q: BookQuery = { text: search, sort, desc }
    if (filter.kind === 'status') q.readStatus = filter.status
    if (filter.kind === 'subject') q.subjectId = filter.id
    if (filter.kind === 'location') q.locationId = filter.id
    if (filter.kind === 'favorites') q.minRating = 4
    return q
  }, [filter, search, sort, desc])

  const refresh = useCallback(async () => {
    const [b, s, l, st] = await Promise.all([
      window.bibcraft.books.list(query),
      window.bibcraft.subjects.list(),
      window.bibcraft.locations.list(),
      window.bibcraft.books.stats()
    ])
    setBooks(b)
    setSubjects(s)
    setLocations(l)
    setStats(st)
    setSelected((cur) => (cur ? (b.find((x) => x.id === cur.id) ?? null) : null))
  }, [query])

  useEffect(() => {
    const timer = setTimeout(refresh, 120)
    return () => clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
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
    try {
      const saved = await window.bibcraft.books.update(id, rest)
      setSelected(saved)
      refresh()
    } catch (e) {
      setToast(errMsg(e))
    }
  }

  async function remove(b: Book) {
    if (!confirm(t('confirm.deleteBook', { title: b.title }))) return
    await window.bibcraft.books.remove(b.id)
    setSelected(null)
    refresh()
  }

  const heading = (() => {
    switch (filter.kind) {
      case 'all':
        return t('nav.all')
      case 'favorites':
        return t('nav.favorites')
      case 'status':
        return t(`status.${filter.status}`)
      case 'subject':
        return subjectMap.get(filter.id)?.name ?? t('heading.subject')
      case 'location':
        return locationNodes.get(filter.id)?.path ?? t('heading.location')
    }
  })()

  const emptyCatalog = stats?.total === 0
  const showDetail = detailPane && selected

  return (
    <div className="shell">
      <header className="titlebar">
        <div className="titlebar-brand">
          <span className="brand-mark">B</span>
          <span>BibCraft</span>
        </div>
        <div className="titlebar-search">
          <Search size={15} className="search-icon" />
          <input
            id="search"
            type="search"
            placeholder={t('search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="titlebar-end" />
      </header>

      <Ribbon
        selected={selected}
        onQuick={() => setDialog({ kind: 'quick' })}
        onNew={() => setDialog({ kind: 'edit', book: null })}
        onEdit={() => selected && setDialog({ kind: 'edit', book: selected })}
        onDelete={() => selected && remove(selected)}
        onAddCopy={() => selected && patch(selected, { copies: selected.copies + 1 })}
        onStatus={(readStatus) =>
          selected &&
          patch(selected, {
            readStatus,
            readDate:
              readStatus === 'read' && !selected.readDate
                ? new Date().toISOString().slice(0, 10)
                : selected.readDate
          })
        }
        onRating={(rating) => selected && patch(selected, { rating })}
        onSubjects={() => setDialog({ kind: 'subjects' })}
        onLocations={() => setDialog({ kind: 'locations' })}
        sort={sort}
        desc={desc}
        onSort={(s) => {
          setSort(s)
          setDesc(s === 'createdAt' || s === 'rating')
        }}
        onDesc={setDesc}
        view={view}
        onView={setView}
        navPane={navPane}
        detailPane={detailPane}
        onNavPane={setNavPane}
        onDetailPane={setDetailPane}
        lang={lang}
        onLang={onLang}
        onExport={async () => {
          const f = await window.bibcraft.data.exportCsv()
          if (f) setToast(t('msg.exported', { path: f }))
        }}
        onBackup={async () => {
          const f = await window.bibcraft.data.backup()
          if (f) setToast(t('msg.backupDone', { path: f }))
        }}
        onOpenFolder={() => window.bibcraft.data.openFolder()}
      />

      <div className={`workspace ${navPane ? 'with-nav' : ''} ${showDetail ? 'with-detail' : ''}`}>
        {navPane && (
          <Sidebar
            filter={filter}
            onFilter={(f) => {
              setFilter(f)
              setSelected(null)
            }}
            stats={stats}
            subjects={subjects}
            locations={locations}
            onManageSubjects={() => setDialog({ kind: 'subjects' })}
            onManageLocations={() => setDialog({ kind: 'locations' })}
          />
        )}

        <main className="main">
          <div className="content">
            <div className="content-head">
              <h1>{heading}</h1>
              <span className="muted">
                {books.length === 1 ? t('common.titles.one') : t('common.titles.other', { n: books.length })}
              </span>
            </div>
            {emptyCatalog ? (
              <div className="empty">
                <div className="empty-mark">📚</div>
                <h2>{t('empty.welcome')}</h2>
                <p>{t('empty.intro')}</p>
                <div className="row gap-sm center">
                  <button className="btn" onClick={() => setDialog({ kind: 'locations' })}>
                    {t('empty.locations')}
                  </button>
                  <button className="btn btn-primary" onClick={() => setDialog({ kind: 'quick' })}>
                    {t('empty.scan')}
                  </button>
                </div>
              </div>
            ) : books.length === 0 ? (
              <div className="empty">
                <p className="muted">{t('empty.noResults')}</p>
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

        {showDetail && (
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
      </div>

      <footer className="statusbar">
        <span>{t('statusbar.books', { n: stats?.total ?? 0 })}</span>
        <span>{t('statusbar.copies', { n: stats?.copies ?? 0 })}</span>
        <span>{t('statusbar.read', { n: stats?.byStatus.read ?? 0 })}</span>
        <span className="spacer" />
        <span>{t('statusbar.shown', { n: books.length })}</span>
        <div className="statusbar-views">
          <button
            className={view === 'grid' ? 'on' : ''}
            onClick={() => setView('grid')}
            title={t('cmd.grid')}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={view === 'table' ? 'on' : ''}
            onClick={() => setView('table')}
            title={t('cmd.table')}
          >
            <List size={14} />
          </button>
        </div>
      </footer>

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
