import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { SearchHit } from '@shared/types'
import type { MediaType } from '@shared/media'
import { Modal } from './Modal'
import { errMsg } from '../util'
import { fetchHitData, type LookupOutcome } from '../lookup'
import { MEDIA_ICONS } from '../media'
import { useI18n } from '../i18n'

const SOURCE_NAMES: Record<SearchHit['source'], string> = {
  tmdb: 'TMDb',
  wikidata: 'Wikidata',
  musicbrainz: 'MusicBrainz'
}

/** Titelsuche bei TMDb, Wikidata und MusicBrainz; ein Klick übernimmt die Daten */
export function TitleSearch({
  type,
  initialQuery,
  onPick,
  onClose
}: {
  type: MediaType
  initialQuery: string
  onPick: (r: LookupOutcome) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [q, setQ] = useState(initialQuery)
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState('')
  const [error, setError] = useState('')
  const [tmdb, setTmdb] = useState(true)
  const ran = useRef(false)

  async function run(query = q) {
    if (!query.trim()) return
    setBusy(true)
    setError('')
    try {
      setHits(await window.bibcraft.media.search(query, type))
    } catch (e) {
      setError(errMsg(e))
      setHits(null)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    window.bibcraft.settings.tmdb().then((s) => setTmdb(s.configured))
    if (!ran.current && initialQuery.trim()) {
      ran.current = true
      run(initialQuery)
    }
  }, [])

  async function pick(hit: SearchHit) {
    setPicking(hit.id)
    setError('')
    try {
      onPick(await fetchHitData(hit))
    } catch (e) {
      setError(errMsg(e))
      setPicking('')
    }
  }

  const Icon = MEDIA_ICONS[type]
  const sources =
    type === 'music' ? 'MusicBrainz, Wikidata' : type === 'film' && tmdb ? 'TMDb, Wikidata' : 'Wikidata'

  return (
    <Modal title={`${t('search.title')} – ${t(`mediaPlural.${type}`)}`} onClose={onClose} wide>
      <div className="isbn-bar">
        <input
          autoFocus
          className="grow"
          value={q}
          placeholder={t('search.titlePlaceholder')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="btn btn-primary" onClick={() => run()} disabled={busy || !q.trim()}>
          <Search size={15} /> {busy ? t('search.loading') : t('search.go')}
        </button>
      </div>
      <p className="muted search-meta">
        {t('search.sources', { sources })}
        {type === 'film' && !tmdb && <> · {t('search.tmdbHint')}</>}
      </p>
      {error && <div className="notice notice-error">{error}</div>}
      {hits && hits.length === 0 && !busy && <div className="empty-small">{t('search.none')}</div>}
      {hits && hits.length > 0 && (
        <ul className="hit-list">
          {hits.map((h) => (
            <li key={`${h.source}:${h.id}`}>
              <button className="hit" onClick={() => pick(h)} disabled={!!picking}>
                <span className={`hit-img ${type === 'music' ? 'square' : ''}`}>
                  {h.imageUrl ? (
                    <img src={h.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <Icon size={20} strokeWidth={1.5} />
                  )}
                </span>
                <span className="hit-text">
                  <strong>
                    {h.title}
                    {h.year && <span className="muted"> ({h.year})</span>}
                  </strong>
                  {h.detail && <span className="muted">{h.detail}</span>}
                </span>
                <span className="hit-source">{SOURCE_NAMES[h.source]}</span>
                <span className="btn btn-sm">
                  {picking === h.id ? t('search.loading') : t('search.pick')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
