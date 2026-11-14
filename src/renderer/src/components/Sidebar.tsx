import { useMemo } from 'react'
import { READ_STATUS_LABELS, type Location, type ReadStatus, type Stats, type Subject } from '@shared/types'
import { flattenLocations } from '../util'

export type Filter =
  | { kind: 'all' }
  | { kind: 'status'; status: ReadStatus }
  | { kind: 'subject'; id: number }
  | { kind: 'location'; id: number }
  | { kind: 'favorites' }

interface Props {
  filter: Filter
  onFilter: (f: Filter) => void
  stats: Stats | null
  subjects: Subject[]
  locations: Location[]
  onNew: () => void
  onQuick: () => void
  onManageSubjects: () => void
  onManageLocations: () => void
  onExport: () => void
  onBackup: () => void
}


export function Sidebar(p: Props) {
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
    icon: React.ReactNode
    label: string
    count?: number
    depth?: number
  }) => (
    <button
      className={`nav-item ${is(f) ? 'active' : ''}`}
      style={{ paddingLeft: 12 + depth * 14 }}
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
      <div className="brand">
        <span className="brand-mark">B</span>
        <span>BibCat</span>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-primary btn-block" onClick={p.onQuick}>
          Schnellerfassung
        </button>
        <button className="btn btn-block" onClick={p.onNew}>
          + Einzelnes Buch
        </button>
      </div>

      <div className="nav-scroll">
        <div className="nav-group">
          <Item f={{ kind: 'all' }} icon="▤" label="Alle Bücher" count={p.stats?.total} />
          <Item f={{ kind: 'favorites' }} icon="★" label="Lieblingsbücher" />
        </div>

        <div className="nav-group">
          <div className="nav-heading">Lesestatus</div>
          {(Object.keys(READ_STATUS_LABELS) as ReadStatus[]).map((s) => (
            <Item
              key={s}
              f={{ kind: 'status', status: s }}
              icon={<span className={`si si-${s}`} />}
              label={READ_STATUS_LABELS[s]}
              count={p.stats?.byStatus[s]}
            />
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-heading">
            Fachgebiete
            <button className="link-btn" onClick={p.onManageSubjects}>
              Verwalten
            </button>
          </div>
          {p.subjects.length === 0 && (
            <button className="nav-empty" onClick={p.onManageSubjects}>
              Fachgebiet anlegen …
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
            Standorte
            <button className="link-btn" onClick={p.onManageLocations}>
              Verwalten
            </button>
          </div>
          {locs.length === 0 && (
            <button className="nav-empty" onClick={p.onManageLocations}>
              Standort anlegen …
            </button>
          )}
          {locs.map((l) => (
            <Item
              key={l.id}
              f={{ kind: 'location', id: l.id }}
              icon={l.depth === 0 ? '⌂' : '▭'}
              label={l.name}
              count={l.bookCount}
              depth={l.depth}
            />
          ))}
        </div>
      </div>

      <div className="sidebar-foot">
        <button className="link-btn" onClick={p.onExport}>
          CSV-Export
        </button>
        <button className="link-btn" onClick={p.onBackup}>
          Sicherung
        </button>
      </div>
    </nav>
  )
}
