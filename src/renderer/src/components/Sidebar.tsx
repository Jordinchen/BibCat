import { useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookCheck,
  BookMarked,
  BookOpen,
  BookX,
  Folder,
  Heart,
  Library,
  MapPin
} from 'lucide-react'
import { READ_STATUSES, type Location, type ReadStatus, type Stats, type Subject } from '@shared/types'
import { flattenLocations } from '../util'
import { MEDIA_TYPES, type MediaType } from '@shared/media'
import { MEDIA_ICONS, statusLabel, type StatusKind } from '../media'
import { useI18n } from '../i18n'

export type Filter =
  | { kind: 'all' }
  | { kind: 'status'; status: ReadStatus }
  | { kind: 'subject'; id: number }
  | { kind: 'location'; id: number }
  | { kind: 'favorites' }
  | { kind: 'statistics' }

/** MIME-Typ für gezogene Bücher (Liste von IDs als JSON) */
export const DND_BOOKS = 'application/x-bibcraft-books'

export const STATUS_ICONS: Record<ReadStatus, typeof BookOpen> = {
  unread: BookMarked,
  reading: BookOpen,
  read: BookCheck,
  abandoned: BookX
}

interface Props {
  filter: Filter
  onFilter: (f: Filter) => void
  stats: Stats | null
  subjects: Subject[]
  locations: Location[]
  onManageSubjects: () => void
  onManageLocations: () => void
  /** Bücher wurden auf einen Standort, ein Fachgebiet oder einen Lesestatus gezogen */
  onDropBooks: (target: Filter, ids: number[]) => void
  /** Medienart-Filter (zusätzlich zu den übrigen Filtern) */
  mediaFilter: MediaType | null
  onMediaFilter: (m: MediaType | null) => void
  /** Bücher wurden auf eine Medienart gezogen */
  onDropMedia: (m: MediaType, ids: number[]) => void
  /** Bestimmt die Statusnamen („Gelesen", „Gesehen" …) */
  statusKind: StatusKind
}

/** Navigationsbereich links: Filter nach Lesestatus, Fachgebiet und Standort */
export function Sidebar(p: Props) {
  const { t } = useI18n()
  const locs = useMemo(() => flattenLocations(p.locations), [p.locations])
  const is = (f: Filter) => JSON.stringify(f) === JSON.stringify(p.filter)
  const [dropKey, setDropKey] = useState('')
  // Mehr als nur Bücher im Katalog? Dann gibt es den Medienart-Filter
  const mixed = Object.keys(p.stats?.byMedia ?? {}).some((m) => m !== 'book')
  const accepts = (f: Filter) => f.kind === 'subject' || f.kind === 'location' || f.kind === 'status'

  const Item = ({
    f,
    icon,
    label,
    count,
    depth = 0
  }: {
    f: Filter
    icon: ReactNode
    label: string
    count?: number
    depth?: number
  }) => (
    <button
      className={`nav-item ${is(f) ? 'active' : ''} ${dropKey === JSON.stringify(f) ? 'drop' : ''}`}
      style={{ paddingLeft: 10 + depth * 16 }}
      onClick={() => p.onFilter(f)}
      title={label}
      onDragOver={(e) => {
        if (!accepts(f) || !e.dataTransfer.types.includes(DND_BOOKS)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropKey(JSON.stringify(f))
      }}
      onDragLeave={() => setDropKey('')}
      onDrop={(e) => {
        setDropKey('')
        const raw = e.dataTransfer.getData(DND_BOOKS)
        if (!raw || !accepts(f)) return
        e.preventDefault()
        p.onDropBooks(f, JSON.parse(raw) as number[])
      }}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
    </button>
  )

  return (
    <nav className="sidebar">
      <div className="nav-scroll">
        <div className="nav-group">
          <Item
            f={{ kind: 'all' }}
            icon={<Library size={16} />}
            label={mixed ? t('nav.allMedia') : t('nav.all')}
            count={p.stats?.total}
          />
          <Item f={{ kind: 'favorites' }} icon={<Heart size={16} />} label={t('nav.favorites')} />
          <Item f={{ kind: 'statistics' }} icon={<BarChart3 size={16} />} label={t('nav.statistics')} />
        </div>

        {mixed && (
          <div className="nav-group">
            <div className="nav-heading">{t('nav.media')}</div>
            {MEDIA_TYPES.filter((m) => (p.stats?.byMedia[m] ?? 0) > 0 || p.mediaFilter === m).map((m) => {
              const Icon = MEDIA_ICONS[m]
              return (
                <button
                  key={m}
                  className={`nav-item ${p.mediaFilter === m ? 'active' : ''} ${dropKey === 'media:' + m ? 'drop' : ''}`}
                  onClick={() => p.onMediaFilter(p.mediaFilter === m ? null : m)}
                  aria-pressed={p.mediaFilter === m}
                  title={t(`mediaPlural.${m}`)}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(DND_BOOKS)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDropKey('media:' + m)
                  }}
                  onDragLeave={() => setDropKey('')}
                  onDrop={(e) => {
                    setDropKey('')
                    const raw = e.dataTransfer.getData(DND_BOOKS)
                    if (!raw) return
                    e.preventDefault()
                    p.onDropMedia(m, JSON.parse(raw) as number[])
                  }}
                >
                  <span className="nav-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-label">{t(`mediaPlural.${m}`)}</span>
                  <span className="nav-count">{p.stats?.byMedia[m] ?? 0}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="nav-group">
          <div className="nav-heading">{p.statusKind === 'book' ? t('nav.readStatus') : t('nav.status')}</div>
          {READ_STATUSES.map((s) => {
            const Icon = STATUS_ICONS[s]
            return (
              <Item
                key={s}
                f={{ kind: 'status', status: s }}
                icon={<Icon size={16} />}
                label={statusLabel(t, s, p.statusKind)}
                count={p.stats?.byStatus[s]}
              />
            )
          })}
        </div>

        <div className="nav-group">
          <div className="nav-heading">
            {t('nav.subjects')}
            <button className="link-btn" onClick={p.onManageSubjects}>
              {t('nav.manage')}
            </button>
          </div>
          {p.subjects.length === 0 && (
            <button className="nav-empty" onClick={p.onManageSubjects}>
              {t('nav.addSubject')}
            </button>
          )}
          {p.subjects.map((s) => (
            <Item
              key={s.id}
              f={{ kind: 'subject', id: s.id }}
              icon={<span className="dot" style={{ background: s.color }} />}
              label={s.name}
              count={s.bookCount}
            />
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-heading">
            {t('nav.locations')}
            <button className="link-btn" onClick={p.onManageLocations}>
              {t('nav.manage')}
            </button>
          </div>
          {locs.length === 0 && (
            <button className="nav-empty" onClick={p.onManageLocations}>
              {t('nav.addLocation')}
            </button>
          )}
          {locs.map((l) => (
            <Item
              key={l.id}
              f={{ kind: 'location', id: l.id }}
              icon={l.depth === 0 ? <MapPin size={16} /> : <Folder size={15} />}
              label={l.name}
              count={l.bookCount}
              depth={l.depth}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}
