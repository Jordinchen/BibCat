import { useEffect, useState, type ReactNode } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { READ_STATUSES, type CountRow, type Statistics } from '@shared/types'
import { localeOf } from '@shared/i18n'
import type { Filter } from './Sidebar'
import { useI18n } from '../i18n'

interface Props {
  /** Ändert sich bei jeder Katalogänderung, damit die Zahlen neu geladen werden */
  version: unknown
  onNavigate: (f: Filter) => void
}

interface Tip {
  x: number
  y: number
  label: string
  value: string
}

/** Rundet auf eine „schöne" Achsenobergrenze (1, 2, 5 × 10^n) */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 5, 10]) if (m * exp >= v) return m * exp
  return 10 * exp
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const show = (e: React.MouseEvent, label: string, value: string) =>
    setTip({ x: e.clientX, y: e.clientY, label, value })
  return { tip, show, hide: () => setTip(null) }
}

function Card({
  title,
  hint,
  rows,
  wide,
  children
}: {
  title: string
  hint?: string
  rows: { label: string; count: number }[]
  wide?: boolean
  children: ReactNode
}) {
  const { t, lang } = useI18n()
  const [table, setTable] = useState(false)
  const total = rows.reduce((a, r) => a + r.count, 0)
  const nf = new Intl.NumberFormat(localeOf(lang))
  const pf = new Intl.NumberFormat(localeOf(lang), { style: 'percent', maximumFractionDigits: 0 })
  return (
    <section className={`st-card ${wide ? 'wide' : ''}`}>
      <header className="st-card-head">
        <div>
          <h3>{title}</h3>
          {hint && <span className="muted">{hint}</span>}
        </div>
        {rows.length > 0 && (
          <button
            className="st-toggle"
            onClick={() => setTable((v) => !v)}
            title={table ? t('stats.showChart') : t('stats.showTable')}
          >
            {table ? <BarChart3 size={14} /> : <Table2 size={14} />}
            {table ? t('stats.showChart') : t('stats.showTable')}
          </button>
        )}
      </header>
      {rows.length === 0 || total === 0 ? (
        <div className="st-empty">{t('stats.noData')}</div>
      ) : table ? (
        <table className="st-table">
          <thead>
            <tr>
              <th>{t('stats.category')}</th>
              <th className="num">{t('stats.count')}</th>
              <th className="num">{t('stats.share')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td className="num">{nf.format(r.count)}</td>
                <td className="num">{pf.format(r.count / total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </section>
  )
}

/** Waagerechte Balken: Name links, Wert an der Balkenspitze */
function HBars({
  rows,
  colorOf,
  onPick,
  tip
}: {
  rows: (CountRow & { display: string })[]
  colorOf?: (r: CountRow) => string | undefined
  onPick?: (r: CountRow) => void
  tip: ReturnType<typeof useTip>
}) {
  const { lang } = useI18n()
  const nf = new Intl.NumberFormat(localeOf(lang))
  const max = Math.max(...rows.map((r) => r.count), 1)
  const total = rows.reduce((a, r) => a + r.count, 0)
  return (
    <div className="hbars" onMouseLeave={tip.hide}>
      {rows.map((r, i) => {
        const color = colorOf?.(r)
        const share = Math.round((r.count / total) * 100)
        return (
          <button
            key={i}
            className={`hbar-row ${onPick && r.key !== null ? 'pickable' : ''}`}
            onClick={() => onPick && r.key !== null && onPick(r)}
            onMouseMove={(e) => tip.show(e, r.display, `${nf.format(r.count)} · ${share} %`)}
            tabIndex={onPick && r.key !== null ? 0 : -1}
          >
            <span className="hbar-label">
              {color && <span className="dot" style={{ background: color }} />}
              <span className={r.key === null ? 'muted' : ''}>{r.display}</span>
            </span>
            <span className="hbar-track">
              {r.count > 0 && (
                <span
                  className="hbar"
                  style={{ width: `${(r.count / max) * 100}%`, background: color ?? 'var(--chart-bar)' }}
                />
              )}
              <span className="hbar-val">{nf.format(r.count)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Säulen über eine Zeitachse, mit Hilfslinien und Achsenbeschriftung */
function Columns({
  rows,
  tip,
  maxLabels = 12
}: {
  rows: (CountRow & { display: string; short: string })[]
  tip: ReturnType<typeof useTip>
  /** Höchstens so viele Achsenbeschriftungen, damit nichts ineinanderläuft */
  maxLabels?: number
}) {
  const { lang } = useI18n()
  const nf = new Intl.NumberFormat(localeOf(lang))
  const top = niceMax(Math.max(...rows.map((r) => r.count)))
  // Nur ganzzahlige Hilfslinien – es werden Bücher gezählt
  const ticks = Number.isInteger(top / 2) ? [0, top / 2, top] : [0, top]
  const every = rows.length > maxLabels ? Math.ceil(rows.length / maxLabels) : 1
  const maxIdx = rows.reduce((best, r, i) => (r.count > rows[best].count ? i : best), 0)
  return (
    <div className="cols" onMouseLeave={tip.hide}>
      <div className="cols-plot">
        {ticks.map((v) => (
          <div key={v} className="cols-grid" style={{ bottom: `${(v / top) * 100}%` }}>
            <span>{nf.format(v)}</span>
          </div>
        ))}
        <div className="cols-bars">
          {rows.map((r, i) => (
            <div key={i} className="col-slot" onMouseMove={(e) => tip.show(e, r.display, nf.format(r.count))}>
              {i === maxIdx && r.count > 0 && (
                <span className="col-cap" style={{ bottom: `${(r.count / top) * 100}%` }}>
                  {nf.format(r.count)}
                </span>
              )}
              <div className="col" style={{ height: `${(r.count / top) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="cols-x">
        {rows.map((r, i) => (
          <span key={i}>{i % every === 0 ? r.short : ''}</span>
        ))}
      </div>
    </div>
  )
}

function StatusBar({
  s,
  onPick,
  tip
}: {
  s: Statistics
  onPick: (f: Filter) => void
  tip: ReturnType<typeof useTip>
}) {
  const { t, lang } = useI18n()
  const nf = new Intl.NumberFormat(localeOf(lang))
  const total = s.total || 1
  return (
    <div className="st-status">
      <div className="seg" onMouseLeave={tip.hide}>
        {READ_STATUSES.filter((st) => s.byStatus[st] > 0).map((st) => {
          const share = s.byStatus[st] / total
          return (
            <button
              key={st}
              className={`seg-part seg-${st}`}
              style={{ flexGrow: s.byStatus[st] }}
              onClick={() => onPick({ kind: 'status', status: st })}
              onMouseMove={(e) =>
                tip.show(e, t(`status.${st}`), `${nf.format(s.byStatus[st])} · ${Math.round(share * 100)} %`)
              }
              aria-label={`${t(`status.${st}`)}: ${s.byStatus[st]}`}
            >
              {share >= 0.08 && <span>{Math.round(share * 100)} %</span>}
            </button>
          )
        })}
      </div>
      <ul className="legend">
        {READ_STATUSES.map((st) => (
          <li key={st}>
            <span className={`legend-key seg-${st}`} />
            {t(`status.${st}`)}
            <span className="muted">{nf.format(s.byStatus[st])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function StatisticsView({ version, onNavigate }: Props) {
  const { t, lang } = useI18n()
  const [s, setS] = useState<Statistics | null>(null)
  const tip = useTip()
  const locale = localeOf(lang)

  useEffect(() => {
    window.bibcraft.books.statistics().then(setS)
  }, [version])

  if (!s) return null
  const nf = new Intl.NumberFormat(locale)
  const year = new Date().getFullYear()
  const readShare = s.total ? s.byStatus.read / s.total : 0
  const none = t('stats.none')
  const named = (rows: CountRow[]) => rows.map((r) => ({ ...r, display: r.key === null ? none : r.label }))
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthLong = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const months = s.addedByMonth.map((r) => {
    const d = new Date(`${r.label}-01T12:00:00`)
    return { ...r, display: monthLong.format(d), short: monthFmt.format(d) }
  })
  const years = s.readByYear.map((r) => ({ ...r, display: r.label, short: `'${r.label.slice(2)}` }))
  const decades = s.byDecade.map((r) => ({
    ...r,
    display: t('stats.decade', { d: r.label }),
    short: r.label
  }))
  const langName = (code: string) => {
    try {
      return (
        new Intl.DisplayNames([locale], { type: 'language' }).of(
          code.length === 3 ? code.slice(0, 2) : code
        ) ?? code
      )
    } catch {
      return code
    }
  }
  // MARC-Sprachcodes (ger, eng, fre …) auf Namen abbilden
  const marc: Record<string, string> = {
    ger: 'de',
    eng: 'en',
    fre: 'fr',
    lat: 'la',
    ita: 'it',
    spa: 'es',
    dut: 'nl',
    gre: 'el',
    rus: 'ru'
  }
  const languages = s.byLanguage.map((r) => ({ ...r, display: langName(marc[r.label] ?? r.label) }))
  const ratings = [5, 4, 3, 2, 1].map((n) => ({
    key: n,
    label: n === 1 ? t('stats.stars.one') : t('stats.stars.other', { n }),
    display: '★'.repeat(n),
    count: s.ratings[n - 1]
  }))

  return (
    <div className="stats">
      <div className="content-head">
        <h1>{t('stats.title')}</h1>
        <span className="muted">{t('stats.subtitle')}</span>
      </div>

      <div className="st-figures">
        <div className="st-hero">
          <span className="st-label">{t('stats.titles')}</span>
          <span className="st-hero-value">{nf.format(s.total)}</span>
          <span className="muted">{t('stats.copies', { n: nf.format(s.copies) })}</span>
        </div>
        <div className="st-tile">
          <span className="st-label">{t('stats.readShare')}</span>
          <span className="st-value">
            {new Intl.NumberFormat(locale, { style: 'percent' }).format(readShare)}
          </span>
          <span className="muted">
            {t('stats.readOf', { n: nf.format(s.byStatus.read), total: nf.format(s.total) })}
          </span>
        </div>
        <div className="st-tile">
          <span className="st-label">{t('stats.pagesRead')}</span>
          <span className="st-value">{nf.format(s.pagesRead)}</span>
        </div>
        <div className="st-tile">
          <span className="st-label">{t('stats.avgRating')}</span>
          <span className="st-value">
            {s.avgRating === null
              ? '–'
              : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(s.avgRating)}
            {s.avgRating !== null && <span className="st-star"> ★</span>}
          </span>
          <span className="muted">{t('stats.ratedOf', { n: nf.format(s.ratedCount) })}</span>
        </div>
        <div className="st-tile">
          <span className="st-label">{t('stats.addedThisYear', { year })}</span>
          <span className="st-value">{nf.format(s.addedThisYear)}</span>
        </div>
        <div className="st-tile">
          <span className="st-label">{t('stats.readThisYear', { year })}</span>
          <span className="st-value">{nf.format(s.readThisYear)}</span>
        </div>
      </div>

      <div className="st-grid">
        <Card
          title={t('stats.byStatus')}
          wide
          rows={READ_STATUSES.map((st) => ({ label: t(`status.${st}`), count: s.byStatus[st] }))}
        >
          <StatusBar s={s} onPick={onNavigate} tip={tip} />
        </Card>
        <Card
          title={t('stats.bySubject')}
          rows={named(s.bySubject).map((r) => ({ label: r.display, count: r.count }))}
        >
          <HBars
            rows={named(s.bySubject)}
            colorOf={(r) => (r.key === null ? 'var(--chart-none)' : r.color)}
            onPick={(r) => onNavigate({ kind: 'subject', id: r.key as number })}
            tip={tip}
          />
        </Card>
        <Card
          title={t('stats.byLocation')}
          hint={t('stats.byLocationHint')}
          rows={named(s.byLocation).map((r) => ({ label: r.display, count: r.count }))}
        >
          <HBars
            rows={named(s.byLocation)}
            colorOf={(r) => (r.key === null ? 'var(--chart-none)' : undefined)}
            onPick={(r) => onNavigate({ kind: 'location', id: r.key as number })}
            tip={tip}
          />
        </Card>
        <Card
          title={t('stats.addedByMonth')}
          hint={t('stats.addedByMonthHint')}
          rows={months.map((r) => ({ label: r.display, count: r.count }))}
        >
          <Columns rows={months} tip={tip} />
        </Card>
        <Card
          title={t('stats.readByYear')}
          hint={t('stats.readByYearHint')}
          rows={years.map((r) => ({ label: r.display, count: r.count }))}
        >
          <Columns rows={years} tip={tip} maxLabels={8} />
        </Card>
        <Card
          title={t('stats.topAuthors')}
          rows={s.topAuthors.map((r) => ({ label: r.label, count: r.count }))}
        >
          <HBars rows={s.topAuthors.map((r) => ({ ...r, display: r.label }))} tip={tip} />
        </Card>
        <Card title={t('stats.byDecade')} rows={decades.map((r) => ({ label: r.display, count: r.count }))}>
          <Columns rows={decades} tip={tip} maxLabels={5} />
        </Card>
        <Card
          title={t('stats.byLanguage')}
          rows={languages.map((r) => ({ label: r.display, count: r.count }))}
        >
          <HBars rows={languages} tip={tip} />
        </Card>
        <Card title={t('stats.ratings')} rows={ratings.map((r) => ({ label: r.label, count: r.count }))}>
          <HBars rows={ratings} tip={tip} />
        </Card>
      </div>

      {tip.tip && (
        <div className="st-tip" style={{ left: tip.tip.x + 14, top: tip.tip.y + 14 }} role="tooltip">
          <strong>{tip.tip.label}</strong>
          <span>{tip.tip.value}</span>
        </div>
      )}
    </div>
  )
}
