import { useEffect, useState } from 'react'
import { ExternalLink, KeyRound } from 'lucide-react'
import { Modal } from './Modal'
import { errMsg } from '../util'
import { useI18n } from '../i18n'

const TMDB_URL = 'https://www.themoviedb.org/settings/api'

/** Einstellungen – derzeit die Online-Quellen (TMDb-Schlüssel) */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [state, setState] = useState<{ configured: boolean; encrypted: boolean } | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'info' | 'warn' | 'error'; text: string } | null>(null)

  const load = () => window.bibcraft.settings.tmdb().then(setState)
  useEffect(() => {
    load()
  }, [])

  async function save(value: string) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.bibcraft.settings.setTmdbKey(value)
      if (!value) setMsg({ kind: 'info', text: t('settings.tmdbRemoved') })
      else
        setMsg(
          r.ok ? { kind: 'info', text: t('settings.tmdbSaved') } : { kind: 'warn', text: r.message ?? '' }
        )
      setKey('')
      await load()
    } catch (e) {
      setMsg({ kind: 'error', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <h3 className="settings-h">{t('settings.sources')}</h3>
      <p className="muted">{t('settings.sourcesIntro')}</p>

      <div className="settings-block">
        <label className="field">
          <span className="field-label">
            <KeyRound size={13} /> {t('settings.tmdb')}
          </span>
          <div className="isbn-bar">
            <input
              type="password"
              className="grow mono"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('settings.tmdbPlaceholder')}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && key.trim() && save(key.trim())}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !key.trim()}
              onClick={() => save(key.trim())}
            >
              {t('common.save')}
            </button>
            {state?.configured && (
              <button className="btn btn-ghost btn-danger" disabled={busy} onClick={() => save('')}>
                {t('settings.remove')}
              </button>
            )}
          </div>
        </label>
        {state?.configured && (
          <p className="settings-state">
            ✓ {t('settings.tmdbConfigured')} {state.encrypted && t('settings.tmdbEncrypted')}
          </p>
        )}
        <p className="muted settings-help">{t('settings.tmdbHelp')}</p>
        <a className="btn btn-sm settings-link" href={TMDB_URL} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> {t('settings.tmdbOpen')}
        </a>
        {msg && <div className={`notice notice-${msg.kind}`}>{msg.text}</div>}
      </div>
    </Modal>
  )
}
