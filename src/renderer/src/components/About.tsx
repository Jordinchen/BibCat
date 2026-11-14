import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import licenseText from '../../../../LICENSE?raw'
import thirdParty from '../third-party.json'
import { Modal } from './Modal'
import { useI18n } from '../i18n'

const SOURCE_URL = 'https://github.com/Jordinchen/BibCat'
const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html'

/** „Über BibCraft": Version, Lizenzhinweise nach GPL §5d und Fremdlizenzen */
export function AboutDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const { t } = useI18n()
  const [showLicense, setShowLicense] = useState(false)

  return (
    <Modal title={t('about.title')} onClose={onClose}>
      <div className="about-head">
        <span className="brand-mark about-mark">B</span>
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
