import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { describeUpdate, useUpdateState } from '../updates'
import licenseText from '../../../../LICENSE?raw'
import thirdParty from '../third-party.json'
import appIcon from '../assets/icon.png'
import { Modal } from './Modal'
import { useI18n } from '../i18n'

const SOURCE_URL = 'https://github.com/Jordinchen/BibCat'
const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html'

/** „Über BibCraft": Version, Lizenzhinweise nach GPL §5d und Fremdlizenzen */
export function AboutDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const { t } = useI18n()
  const [showLicense, setShowLicense] = useState(false)
  const update = useUpdateState()

  return (
    <Modal title={t('about.title')} onClose={onClose}>
      <div className="about-head">
        <img className="about-icon" src={appIcon} alt="" draggable={false} />
        <div>
          <h3 className="about-name">BibCraft</h3>
          <span className="muted">
            {t('about.version', { v: version })} · {t('about.tagline')}
          </span>
        </div>
      </div>

      <p className="about-copy">{t('about.copyright')}</p>
      <p>{t('about.free')}</p>
      <p className="about-warranty">{t('about.warranty')}</p>

      <div className="row gap-sm about-links">
        <a className="btn btn-sm" href={SOURCE_URL} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> {t('about.source')}
        </a>
        <a className="btn btn-sm" href={GPL_URL} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> {t('about.gnu')}
        </a>
        <button className="btn btn-sm" onClick={() => setShowLicense((v) => !v)} aria-expanded={showLicense}>
          {showLicense ? t('about.hideLicense') : t('about.showLicense')}
        </button>
      </div>
      {showLicense && (
        <>
          <p className="muted about-note">{t('about.licenseNote')}</p>
          <pre className="license-text">{licenseText}</pre>
        </>
      )}

      <h3 className="about-section">{t('about.dataSources')}</h3>
      <p className="about-sources">{t('about.dataSourcesText')}</p>
      <p className="muted about-tmdb">{t('about.tmdb')}</p>

      <h3 className="about-section">{t('updates.title')}</h3>
      <div className="about-updates">
        <div className="row gap-sm">
          <span className="grow">
            {t('updates.installed', { v: version })}{' '}
            {update && update.status !== 'idle' && <strong>{describeUpdate(update, t)}</strong>}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => window.bibcraft.updates.check()}
            disabled={update?.status === 'checking' || update?.status === 'downloading'}
          >
            <RefreshCw size={14} className={update?.status === 'checking' ? 'spin' : ''} />{' '}
            {t('updates.check')}
          </button>
          {update?.status === 'ready' && (
            <button className="btn btn-sm btn-primary" onClick={() => window.bibcraft.updates.install()}>
              {t('updates.restart')}
            </button>
          )}
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={update?.auto ?? true}
            onChange={(e) => window.bibcraft.updates.setAuto(e.target.checked)}
          />
          <span>
            {t('updates.auto')}
            <span className="muted check-hint">{t('updates.autoHint')}</span>
          </span>
        </label>
      </div>

      <h3 className="about-section">{t('about.thirdParty')}</h3>
      <p className="muted">{t('about.thirdPartyIntro')}</p>
      <ul className="third-party">
        {thirdParty.map((p) => (
          <li key={p.name}>
            <details>
              <summary>
                <span className="tp-name">{p.name}</span>
                <span className="muted mono">{p.version}</span>
                <span className="tp-license">{p.license}</span>
              </summary>
              <pre className="license-text">{p.text}</pre>
            </details>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
