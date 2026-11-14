import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownZA,
  ArrowUpAZ,
  BookPlus,
  ChevronUp,
  CopyPlus,
  DatabaseBackup,
  FileSpreadsheet,
  FolderOpen,
  LayoutGrid,
  List,
  MapPin,
  PanelLeft,
  PanelRight,
  Pencil,
  Pin,
  ScanBarcode,
  Tags,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { READ_STATUSES, type Book, type ReadStatus, type SortField } from '@shared/types'
import { LANGUAGES, type Lang, type TKey } from '@shared/i18n'
import { Stars } from './Stars'
import { STATUS_ICONS } from './Sidebar'
import { useI18n } from '../i18n'

export type RibbonTab = 'file' | 'home' | 'catalog' | 'view'
const TABS: RibbonTab[] = ['file', 'home', 'catalog', 'view']
const SORTS: SortField[] = ['title', 'authors', 'year', 'createdAt', 'rating', 'callNumber']

export interface RibbonProps {
  selected: Book | null
  onQuick: () => void
  onNew: () => void
  onEdit: () => void
  onDelete: () => void
  onAddCopy: () => void
  onStatus: (s: ReadStatus) => void
  onRating: (n: number) => void
  onSubjects: () => void
  onLocations: () => void
  sort: SortField
  desc: boolean
  onSort: (s: SortField) => void
  onDesc: (d: boolean) => void
  view: 'grid' | 'table'
  onView: (v: 'grid' | 'table') => void
  navPane: boolean
  detailPane: boolean
  onNavPane: (v: boolean) => void
  onDetailPane: (v: boolean) => void
  lang: Lang
  onLang: (l: Lang) => void
  onExport: () => void
  onBackup: () => void
  onOpenFolder: () => void
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}
function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignorieren */
  }
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rb-group">
      <div className="rb-group-body">{children}</div>
      <div className="rb-group-label">{label}</div>
    </div>
  )
}

interface BtnProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}

function Big({ icon: Icon, label, onClick, disabled, active, title }: BtnProps) {
  return (
    <button
      className={`rb-big ${active ? 'on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label.replace('\n', '')}
      aria-pressed={active}
    >
      <Icon size={28} strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  )
}

function Small({ icon: Icon, label, onClick, disabled, active, title }: BtnProps) {
  return (
    <button
      className={`rb-small ${active ? 'on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={active}
    >
      <Icon size={16} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  )
}

const Stack = ({ children }: { children: ReactNode }) => <div className="rb-stack">{children}</div>

export function Ribbon(p: RibbonProps) {
  const { t } = useI18n()
  const [tab, setTab] = useState<RibbonTab>(() => load('ribbon.tab', 'home'))
  const [collapsed, setCollapsed] = useState<boolean>(() => load('ribbon.collapsed', false))
  // Bei eingeklapptem Menüband: Registerkarte vorübergehend aufklappen
  const [peek, setPeek] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => store('ribbon.tab', tab), [tab])
  useEffect(() => store('ribbon.collapsed', collapsed), [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setCollapsed((c) => !c)
        setPeek(false)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (peek && root.current && !root.current.contains(e.target as Node)) setPeek(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [peek])

  const sel = p.selected
  const showPanel = !collapsed || peek

  return (
    <div className={`ribbon ${collapsed ? 'collapsed' : ''}`} ref={root}>
      <div className="rb-tabs" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`rb-tab ${id === 'file' ? 'rb-tab-file' : ''} ${tab === id && showPanel ? 'active' : ''}`}
            onClick={() => {
              setTab(id)
              if (collapsed) setPeek((v) => (tab === id ? !v : true))
            }}
            onDoubleClick={() => {
              setCollapsed((c) => !c)
              setPeek(false)
            }}
          >
            {t(`tab.${id}` as TKey)}
          </button>
        ))}
      </div>

      {showPanel && (
        <div
          className={`rb-panel ${peek ? 'peek' : ''}`}
          role="tabpanel"
          onClick={(e) => {
            if (peek && (e.target as HTMLElement).closest('button')) setPeek(false)
          }}
        >
          {tab === 'file' && (
            <>
              <Group label={t('group.export')}>
                <Big icon={FileSpreadsheet} label={t('cmd.exportCsv')} onClick={p.onExport} />
              </Group>
              <Group label={t('group.backup')}>
                <Big icon={DatabaseBackup} label={t('cmd.backup')} onClick={p.onBackup} />
                <Big icon={FolderOpen} label={t('cmd.openFolder')} onClick={p.onOpenFolder} />
              </Group>
            </>
          )}

          {tab === 'home' && (
            <>
              <Group label={t('group.capture')}>
                <Big icon={ScanBarcode} label={t('cmd.quickCapture')} onClick={p.onQuick} />
                <Big icon={BookPlus} label={t('cmd.newBook')} onClick={p.onNew} />
              </Group>
              <Group label={t('group.book')}>
                <Big
                  icon={Pencil}
                  label={t('cmd.editBook')}
                  onClick={p.onEdit}
                  disabled={!sel}
                  title={sel ? undefined : t('cmd.noSelection')}
                />
                <Stack>
                  <Small icon={CopyPlus} label={t('cmd.addCopy')} onClick={p.onAddCopy} disabled={!sel} />
                  <Small icon={Trash2} label={t('cmd.deleteBook')} onClick={p.onDelete} disabled={!sel} />
                </Stack>
              </Group>
              <Group label={t('group.readStatus')}>
                <div className="rb-grid2">
                  {READ_STATUSES.map((s) => (
                    <Small
                      key={s}
                      icon={STATUS_ICONS[s]}
                      label={t(`status.${s}`)}
                      onClick={() => p.onStatus(s)}
                      disabled={!sel}
                      active={sel?.readStatus === s}
                    />
                  ))}
                </div>
              </Group>
              <Group label={t('group.rating')}>
                <div className={`rb-rating ${sel ? '' : 'disabled'}`}>
                  <Stars value={sel?.rating ?? 0} onChange={sel ? p.onRating : undefined} />
                </div>
              </Group>
            </>
          )}

          {tab === 'catalog' && (
            <>
              <Group label={t('group.organize')}>
                <Big icon={Tags} label={t('cmd.subjects')} onClick={p.onSubjects} />
                <Big icon={MapPin} label={t('cmd.locations')} onClick={p.onLocations} />
              </Group>
              <Group label={t('group.sort')}>
                <Stack>
                  <select
                    className="rb-select"
                    value={p.sort}
                    onChange={(e) => p.onSort(e.target.value as SortField)}
                  >
                    {SORTS.map((s) => (
                      <option key={s} value={s}>
                        {t(`sort.${s}`)}
                      </option>
                    ))}
                  </select>
                  <Small
                    icon={ArrowUpAZ}
                    label={t('cmd.ascending')}
                    onClick={() => p.onDesc(false)}
                    active={!p.desc}
                  />
                  <Small
                    icon={ArrowDownZA}
                    label={t('cmd.descending')}
                    onClick={() => p.onDesc(true)}
                    active={p.desc}
                  />
                </Stack>
              </Group>
            </>
          )}

          {tab === 'view' && (
            <>
              <Group label={t('group.layout')}>
                <Big
                  icon={LayoutGrid}
                  label={t('cmd.grid')}
                  onClick={() => p.onView('grid')}
                  active={p.view === 'grid'}
                />
                <Big
                  icon={List}
                  label={t('cmd.table')}
                  onClick={() => p.onView('table')}
                  active={p.view === 'table'}
                />
              </Group>
              <Group label={t('group.panes')}>
                <Stack>
                  <Small
                    icon={PanelLeft}
                    label={t('cmd.navPane')}
                    onClick={() => p.onNavPane(!p.navPane)}
                    active={p.navPane}
                  />
                  <Small
                    icon={PanelRight}
                    label={t('cmd.detailPane')}
                    onClick={() => p.onDetailPane(!p.detailPane)}
                    active={p.detailPane}
                  />
                </Stack>
              </Group>
              <Group label={t('group.language')}>
                <Stack>
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      className={`rb-small rb-lang ${p.lang === l.code ? 'on' : ''}`}
                      onClick={() => p.onLang(l.code)}
                      aria-pressed={p.lang === l.code}
                    >
                      <span className="rb-lang-code">{l.code.toUpperCase()}</span>
                      <span>{l.label}</span>
                    </button>
                  ))}
                </Stack>
              </Group>
            </>
          )}

          <button
            className="rb-pin"
            onClick={() => {
              setCollapsed((c) => !c)
              setPeek(false)
            }}
            title={collapsed ? t('ribbon.expand') : t('ribbon.collapse')}
            aria-label={collapsed ? t('ribbon.expand') : t('ribbon.collapse')}
          >
            {collapsed ? <Pin size={14} /> : <ChevronUp size={16} />}
          </button>
        </div>
      )}
    </div>
  )
}
