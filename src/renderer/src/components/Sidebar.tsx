import { useMemo, type ReactNode } from 'react'
import { BookCheck, BookMarked, BookOpen, BookX, Folder, Heart, Library, MapPin } from 'lucide-react'
import { READ_STATUSES, type Location, type ReadStatus, type Stats, type Subject } from '@shared/types'
import { flattenLocations } from '../util'
import { useI18n } from '../i18n'

export type Filter =
  | { kind: 'all' }
  | { kind: 'status'; status: ReadStatus }
  | { kind: 'subject'; id: number }
  | { kind: 'location'; id: number }
  | { kind: 'favorites' }

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
}

/** Navigationsbereich links: Filter nach Lesestatus, Fachgebiet und Standort */
export function Sidebar(p: Props) {
  const { t } = useI18n()
  const locs = useMemo(() => flattenLocations(p.locations), [p.locations])
  const is = (f: Filter) => JSON.stringify(f) === JSON.stringify(p.filter)

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
      className={`nav-item ${is(f) ? 'active' : ''}`}
      style={{ paddingLeft: 10 + depth * 16 }}
      onClick={() => p.onFilter(f)}
      title={label}
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
            label={t('nav.all')}
            count={p.stats?.total}
          />
          <Item f={{ kind: 'favorites' }} icon={<Heart size={16} />} label={t('nav.favorites')} />
        </div>

        <div className="nav-group">
          <div className="nav-heading">{t('nav.readStatus')}</div>
          {READ_STATUSES.map((s) => {
            const Icon = STATUS_ICONS[s]
            return (
              <Item
                key={s}
                f={{ kind: 'status', status: s }}
                icon={<Icon size={16} />}
                label={t(`status.${s}`)}
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
