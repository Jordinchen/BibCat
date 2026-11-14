import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import type { AppInfo, Book, BookQuery, BulkPatch, Location, SortField, Stats, Subject } from '@shared/types'
import type { Lang } from '@shared/i18n'
import { DND_BOOKS, Sidebar, type Filter } from './components/Sidebar'
import { Ribbon } from './components/Ribbon'
import { BookGrid, BookTable } from './components/BookViews'
import { BookDetail } from './components/BookDetail'
import { BulkPanel } from './components/BulkPanel'
import { BookEditor } from './components/BookEditor'
import { QuickCapture } from './components/QuickCapture'
import { StatisticsView } from './components/StatisticsView'
import { LocationManager, SubjectManager } from './components/Managers'
import { AboutDialog } from './components/About'
import { UpdateNotice } from './components/UpdateNotice'
import { LibraryManager, LibrarySwitcher, NewLibraryDialog, openLibraryDialog } from './components/Libraries'
import { errMsg, flattenLocations } from './util'
import { I18nProvider, useI18n } from './i18n'

type View = 'grid' | 'table'
type Dialog =
  | { kind: 'none' }
  | { kind: 'edit'; book: Book | null }
  | { kind: 'quick' }
  | { kind: 'subjects' }
  | { kind: 'locations' }
  | { kind: 'newLibrary' }
  | { kind: 'libraries' }
  | { kind: 'about' }

interface Toast {
  text: string
  undo?: () => Promise<void>
}

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

const isTyping = () => {
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
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
  const [version, setVersion] = useState(0)
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [sort, setSort] = usePref<SortField>('sort', 'title')
  const [desc, setDesc] = usePref('desc', false)
  const [view, setView] = usePref<View>('view', 'grid')
  const [navPane, setNavPane] = usePref('navPane', true)
  const [detailPane, setDetailPane] = usePref('detailPane', true)
  // Auswahl als ID-Liste; der Anker ist der Ausgangspunkt für Umschalt+Klick
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const anchor = useRef<number | null>(null)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  // Bearbeiten aus der Schnellerfassung heraus: Schnellerfassung bleibt darunter offen
  const [stackedEdit, setStackedEdit] = useState<Book | null>(null)
  const [toast, setToast] = useState<Toast | null>(() =>
    info.libraryFallback
      ? { text: t('msg.libraryFallback', { name: info.libraryFallback }) }
      : info.migratedFromBibCat
        ? { text: t('msg.migrated') }
        : null
  )

  useEffect(() => {
    document.title = `${info.library.name} – BibCraft`
  }, [info.library.name])

  const openLibrary = () => openLibraryDialog().catch((e) => setToast({ text: errMsg(e) }))

  const showStats = filter.kind === 'statistics'

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
    setVersion((v) => v + 1)
    // Ausgewählte Bücher, die nicht mehr sichtbar sind, fallen aus der Auswahl
    const visible = new Set(b.map((x) => x.id))
    setSelectedIds((ids) => {
      const next = ids.filter((id) => visible.has(id))
      return next.length === ids.length ? ids : next
    })
  }, [query])

  useEffect(() => {
    const timer = setTimeout(refresh, 120)
    return () => clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.undo ? 9000 : 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const selection = useMemo(
    () => selectedIds.map((id) => byId.get(id)).filter((b): b is Book => !!b),
    [selectedIds, byId]
  )
  const single = selection.length === 1 ? selection[0] : null

  const selectOnly = (ids: number[]) => {
    setSelectedIds(ids)
    anchor.current = ids.length === 1 ? ids[0] : anchor.current
  }

  function onSelect(b: Book, e: React.MouseEvent) {
    if (e.shiftKey && anchor.current !== null) {
      const from = books.findIndex((x) => x.id === anchor.current)
      const to = books.findIndex((x) => x.id === b.id)
      if (from >= 0 && to >= 0) {
        const [a, z] = from < to ? [from, to] : [to, from]
        const range = books.slice(a, z + 1).map((x) => x.id)
        setSelectedIds((ids) => (e.ctrlKey || e.metaKey ? [...new Set([...ids, ...range])] : range))
        return
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((ids) => (ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id]))
      anchor.current = b.id
      return
    }
    selectOnly([b.id])
  }

  function onDragStart(b: Book, e: React.DragEvent) {
    const ids = selectedIds.includes(b.id) ? selectedIds : [b.id]
    if (!selectedIds.includes(b.id)) selectOnly([b.id])
    e.dataTransfer.setData(DND_BOOKS, JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
    // Kleines Etikett mit der Anzahl als Zieh-Vorschau
    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.textContent = ids.length === 1 ? b.title : t('dnd.count', { n: ids.length })
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 12, 12)
    setTimeout(() => ghost.remove(), 0)
  }

  // Tastenkürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const modalOpen = !!document.querySelector('.modal')
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setDialog({ kind: 'edit', book: null })
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        document.getElementById('search')?.focus()
      }
      if (mod && e.key.toLowerCase() === 'a' && !isTyping() && !modalOpen && !showStats) {
        e.preventDefault()
        setSelectedIds(books.map((b) => b.id))
      }
      if (e.key === 'Escape' && !modalOpen && !isTyping()) setSelectedIds([])
      if (e.key === 'Delete' && !modalOpen && !isTyping() && selection.length) removeMany(selection)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const locationNodes = useMemo(() => new Map(flattenLocations(locations).map((l) => [l.id, l])), [locations])

  async function patch(b: Book, p: Partial<Book>) {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = { ...b, ...p }
    try {
      await window.bibcraft.books.update(id, rest)
      refresh()
    } catch (e) {
      setToast({ text: errMsg(e) })
    }
  }

  /** Sammeländerung mit Rückgängig-Möglichkeit */
  async function bulk(targets: Book[], p: BulkPatch, message?: string) {
    if (!targets.length) return
    const before = targets.map((b) => ({ ...b }))
    try {
      const n = await window.bibcraft.books.bulkUpdate(
        targets.map((b) => b.id),
        p
      )
      await refresh()
      setToast({
        text: message ?? t('msg.bulkDone', { n }),
        undo: async () => {
          await window.bibcraft.books.restore(before)
          await refresh()
        }
      })
    } catch (e) {
      setToast({ text: errMsg(e) })
    }
  }

  async function removeMany(targets: Book[]) {
    if (!targets.length) return
    const ok =
      targets.length === 1
        ? confirm(t('confirm.deleteBook', { title: targets[0].title }))
        : confirm(t('confirm.deleteMany', { n: targets.length }))
    if (!ok) return
    const before = targets.map((b) => ({ ...b }))
    await window.bibcraft.books.removeMany(targets.map((b) => b.id))
    setSelectedIds([])
    await refresh()
    setToast({
      text:
        targets.length === 1
          ? t('msg.deleted.one', { title: targets[0].title })
          : t('msg.deleted.other', { n: targets.length }),
      undo: async () => {
        await window.bibcraft.books.restore(before)
        setSelectedIds(before.map((b) => b.id))
        await refresh()
      }
    })
  }

  function onDropBooks(target: Filter, ids: number[]) {
    const targets = ids.map((id) => byId.get(id)).filter((b): b is Book => !!b)
    if (target.kind === 'location') {
      bulk(
        targets,
        { locationId: target.id },
        t('msg.moved', { n: targets.length, target: locationNodes.get(target.id)?.path ?? '' })
      )
    } else if (target.kind === 'subject') {
      bulk(
        targets,
        { subjectId: target.id },
        t('msg.moved', { n: targets.length, target: subjectMap.get(target.id)?.name ?? '' })
      )
    } else if (target.kind === 'status') {
      bulk(
        targets,
        { readStatus: target.status },
        t('msg.moved', { n: targets.length, target: t(`status.${target.status}`) })
      )
    }
  }

  const heading = (() => {
    switch (filter.kind) {
      case 'all':
        return t('nav.all')
      case 'favorites':
        return t('nav.favorites')
      case 'statistics':
        return t('nav.statistics')
      case 'status':
        return t(`status.${filter.status}`)
      case 'subject':
        return subjectMap.get(filter.id)?.name ?? t('heading.subject')
      case 'location':
        return locationNodes.get(filter.id)?.path ?? t('heading.location')
    }
  })()

  const emptyCatalog = stats?.total === 0
  const showSide = !showStats && detailPane && selection.length > 0
  const goTo = (f: Filter) => {
    setFilter(f)
    setSelectedIds([])
  }

  return (
    <div className="shell">
      <header className="titlebar">
        <div className="titlebar-brand">
          <span className="brand-mark">B</span>
          <span>BibCraft</span>
          <LibrarySwitcher
            current={info.library}
            onNew={() => setDialog({ kind: 'newLibrary' })}
            onOpen={openLibrary}
            onManage={() => setDialog({ kind: 'libraries' })}
            onError={(text) => setToast({ text })}
          />
        </div>
        <div className="titlebar-search">
          <Search size={15} className="search-icon" />
          <input
            id="search"
            type="search"
            placeholder={t('search.placeholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (showStats) setFilter({ kind: 'all' })
            }}
          />
        </div>
        <div className="titlebar-end" />
      </header>

      <Ribbon
        selection={selection}
        onSelectAll={() => {
          if (showStats) setFilter({ kind: 'all' })
          setSelectedIds(books.map((b) => b.id))
        }}
        onSelectNone={() => setSelectedIds([])}
        statsActive={showStats}
        onStats={() => goTo(showStats ? { kind: 'all' } : { kind: 'statistics' })}
        onQuick={() => setDialog({ kind: 'quick' })}
        onNew={() => setDialog({ kind: 'edit', book: null })}
        onEdit={() => {
          if (single) setDialog({ kind: 'edit', book: single })
          else if (selection.length > 1) setDetailPane(true)
        }}
        onDelete={() => removeMany(selection)}
        onAddCopy={() => bulk(selection, { copiesDelta: 1 })}
        onStatus={(readStatus) => bulk(selection, { readStatus })}
        onRating={(rating) => bulk(selection, { rating })}
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
        onView={(v) => {
          setView(v)
          if (showStats) setFilter({ kind: 'all' })
        }}
        navPane={navPane}
        detailPane={detailPane}
        onNavPane={setNavPane}
        onDetailPane={setDetailPane}
        lang={lang}
        onLang={onLang}
        onExport={async () => {
          const f = await window.bibcraft.data.exportCsv()
          if (f) setToast({ text: t('msg.exported', { path: f }) })
        }}
        onBackup={async () => {
          const f = await window.bibcraft.data.backup()
          if (f) setToast({ text: t('msg.backupDone', { path: f }) })
        }}
        onOpenFolder={() => window.bibcraft.data.openFolder()}
        onNewLibrary={() => setDialog({ kind: 'newLibrary' })}
        onOpenLibrary={openLibrary}
        onManageLibraries={() => setDialog({ kind: 'libraries' })}
        onAbout={() => setDialog({ kind: 'about' })}
        onCheckUpdates={() => window.bibcraft.updates.check()}
      />

      <div className={`workspace ${navPane ? 'with-nav' : ''} ${showSide ? 'with-detail' : ''}`}>
        {navPane && (
          <Sidebar
            filter={filter}
            onFilter={goTo}
            stats={stats}
            subjects={subjects}
            locations={locations}
            onManageSubjects={() => setDialog({ kind: 'subjects' })}
            onManageLocations={() => setDialog({ kind: 'locations' })}
            onDropBooks={onDropBooks}
          />
        )}

        <main className="main">
          <div
            className="content"
            onClick={(e) => {
              // Klick ins Leere hebt die Auswahl auf
              if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('book-grid'))
                setSelectedIds([])
            }}
          >
            {showStats ? (
              <StatisticsView version={version} onNavigate={goTo} />
            ) : (
              <>
                <div className="content-head">
                  <h1>{heading}</h1>
                  <span className="muted">
                    {books.length === 1
                      ? t('common.titles.one')
                      : t('common.titles.other', { n: books.length })}
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
                    selected={new Set(selectedIds)}
                    onSelect={onSelect}
                    onOpen={(b) => setDialog({ kind: 'edit', book: b })}
                    onDragStart={onDragStart}
                    subjects={subjectMap}
                  />
                ) : (
                  <BookTable
                    books={books}
                    selected={new Set(selectedIds)}
                    onSelect={onSelect}
                    onOpen={(b) => setDialog({ kind: 'edit', book: b })}
                    onDragStart={onDragStart}
                    subjects={subjectMap}
                  />
                )}
              </>
            )}
          </div>
        </main>

        {showSide && single && (
          <BookDetail
            key={single.id}
            book={single}
            subject={single.subjectId != null ? subjectMap.get(single.subjectId) : undefined}
            location={single.locationId != null ? locationNodes.get(single.locationId) : undefined}
            onEdit={() => setDialog({ kind: 'edit', book: single })}
            onDelete={() => removeMany([single])}
            onPatch={(p) => patch(single, p)}
            onClose={() => setSelectedIds([])}
          />
        )}
        {showSide && selection.length > 1 && (
          <BulkPanel
            books={selection}
            subjects={subjects}
            locations={locations}
            onApply={(p) => bulk(selection, p)}
            onDelete={() => removeMany(selection)}
            onClose={() => setSelectedIds([])}
          />
        )}
      </div>

      <footer className="statusbar">
        <span>{t('statusbar.books', { n: stats?.total ?? 0 })}</span>
        <span>{t('statusbar.copies', { n: stats?.copies ?? 0 })}</span>
        <span>{t('statusbar.read', { n: stats?.byStatus.read ?? 0 })}</span>
        <span className="spacer" />
        {selection.length > 1 && (
          <span className="statusbar-sel">{t('bulk.title', { n: selection.length })}</span>
        )}
        {!showStats && <span>{t('statusbar.shown', { n: books.length })}</span>}
        <div className="statusbar-views">
          <button
            className={view === 'grid' && !showStats ? 'on' : ''}
            onClick={() => {
              setView('grid')
              if (showStats) setFilter({ kind: 'all' })
            }}
            title={t('cmd.grid')}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={view === 'table' && !showStats ? 'on' : ''}
            onClick={() => {
              setView('table')
              if (showStats) setFilter({ kind: 'all' })
            }}
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
            selectOnly([b.id])
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
      {dialog.kind === 'about' && (
        <AboutDialog version={info.version} onClose={() => setDialog({ kind: 'none' })} />
      )}
      {dialog.kind === 'newLibrary' && <NewLibraryDialog onClose={() => setDialog({ kind: 'none' })} />}
      {dialog.kind === 'libraries' && (
        <LibraryManager
          onClose={() => setDialog({ kind: 'none' })}
          onNew={() => setDialog({ kind: 'newLibrary' })}
        />
      )}
      {dialog.kind === 'locations' && (
        <LocationManager
          locations={locations}
          onClose={() => setDialog({ kind: 'none' })}
          onChanged={refresh}
        />
      )}

      <UpdateNotice />
      {toast && (
        <div className="toast" role="status">
          <span className="toast-text">{toast.text}</span>
          {toast.undo && (
            <button
              className="toast-action"
              onClick={async () => {
                const u = toast.undo!
                setToast(null)
                await u()
              }}
            >
              {t('common.undo')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
