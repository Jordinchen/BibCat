import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { describeUpdate, useUpdateState } from '../updates'
import { useI18n } from '../i18n'

/**
 * Unaufdringlicher Hinweis unten rechts. Erscheint, wenn ein Update gefunden wurde oder
 * bereit ist – und nach einer selbst angestoßenen Suche auch mit „aktuell" oder Fehler.
 */
export function UpdateNotice() {
  const { t } = useI18n()
  const s = useUpdateState()
  const [dismissed, setDismissed] = useState('')

  const key = s ? `${s.status}:${s.version ?? ''}:${s.manual}` : ''
  // Ein neuer Status zeigt den Hinweis wieder an
  useEffect(() => {
    if (s?.status === 'checking') setDismissed('')
  }, [s?.status])
  // „Aktuell" verschwindet nach ein paar Sekunden von selbst
  useEffect(() => {
    if (s?.status !== 'none') return
    const timer = setTimeout(() => setDismissed(key), 5000)
    return () => clearTimeout(timer)
  }, [key, s?.status])

  if (!s || dismissed === key) return null
  const always = s.status === 'available' || s.status === 'downloading' || s.status === 'ready'
  const onRequest = s.manual && (s.status === 'none' || s.status === 'error' || s.status === 'checking')
  if (!always && !onRequest) return null

  return (
    <div className={`update-notice update-${s.status}`} role="status">
      <div className="update-icon">
        {s.status === 'checking' ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
      </div>
      <div className="update-body">
        <strong>{describeUpdate(s, t)}</strong>
        {s.status === 'ready' && <span className="muted">{t('updates.readyHint')}</span>}
        {s.status === 'downloading' && (
          <span className="update-bar">
            <span style={{ width: `${s.percent ?? 0}%` }} />
          </span>
        )}
        {s.status === 'error' && s.error && (
          <span className="muted update-err" title={s.error}>
            {s.error}
          </span>
        )}
        <div className="update-actions">
          {s.status === 'ready' && (
            <button className="btn btn-sm btn-primary" onClick={() => window.bibcraft.updates.install()}>
              {t('updates.restart')}
            </button>
          )}
          {s.status === 'available' && (
            <button className="btn btn-sm btn-primary" onClick={() => window.bibcraft.updates.openReleases()}>
              {t('updates.download')}
            </button>
          )}
          {(s.status === 'ready' || s.status === 'available' || s.status === 'downloading') && (
            <button className="btn btn-sm btn-ghost" onClick={() => window.bibcraft.updates.openReleases()}>
              {t('updates.whatsNew')}
            </button>
          )}
        </div>
      </div>
      <button
        className="icon-btn"
        onClick={() => setDismissed(key)}
        aria-label={t('updates.later')}
        title={t('updates.later')}
      >
        <X size={15} />
      </button>
    </div>
  )
}
