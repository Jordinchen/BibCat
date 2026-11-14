import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { isValidIsbn13 } from '@shared/isbn'
import { isValidEan } from '@shared/media'
import { useI18n } from '../i18n'

interface Props {
  /** Wird mit einer gültigen ISBN-13 aufgerufen */
  onIsbn: (isbn: string) => void
  /** Scanner läuft weiter (Schnellerfassung) statt nach dem ersten Treffer zu stoppen */
  continuous?: boolean
  /** Alle EAN/UPC-Codes annehmen (DVDs, CDs, Spiele) statt nur Buch-ISBNs */
  anyCode?: boolean
}

/**
 * Liest Barcodes über die Kamera. Ohne `anyCode` nur EAN-13 mit Präfix 978/979
 * (Bookland), damit Preis- oder Artikel-Barcodes ignoriert werden.
 */
export function Scanner({ onIsbn, continuous, anyCode }: Props) {
  const { t } = useI18n()
  const tr = useRef(t)
  tr.current = t
  const video = useRef<HTMLVideoElement>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const last = useRef({ code: '', at: 0 })
  const cb = useRef(onIsbn)
  cb.current = onIsbn

  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((d) => {
        setDevices(d)
        if (!d.length) setError(tr.current('scanner.noCamera'))
      })
      .catch(() => setError(tr.current('scanner.noAccess')))
  }, [])

  useEffect(() => {
    if (!video.current) return
    const hints = new Map()
    hints.set(
      DecodeHintType.POSSIBLE_FORMATS,
      anyCode ? [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.EAN_8] : [BarcodeFormat.EAN_13]
    )
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
    let controls: IScannerControls | undefined
    let cancelled = false

    reader
      .decodeFromVideoDevice(deviceId || undefined, video.current, (result, _err, ctl) => {
        if (!result) return
        const code = result.getText()
        const ok = anyCode ? isValidEan(code) : /^97[89]\d{10}$/.test(code) && isValidIsbn13(code)
        if (!ok) return
        const now = Date.now()
        // Gleichen Code nicht mehrfach hintereinander melden
        if (code === last.current.code && now - last.current.at < 3000) return
        last.current = { code, at: now }
        setFlash(true)
        setTimeout(() => setFlash(false), 350)
        cb.current(code)
        if (!continuous) ctl.stop()
      })
      .then((c) => {
        if (cancelled) c.stop()
        else controls = c
        setError('')
      })
      .catch((e: Error) => {
        setError(e?.name === 'NotAllowedError' ? tr.current('scanner.denied') : tr.current('scanner.failed'))
      })

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [deviceId, continuous, anyCode])

  return (
    <div className="scanner">
      <div className={`scanner-view ${flash ? 'flash' : ''}`}>
        <video ref={video} muted playsInline />
        <div className="scanner-frame" />
        {error && <div className="scanner-error">{error}</div>}
      </div>
      <div className="scanner-bar">
        <span className="muted">{t('scanner.hint')}</span>
        {devices.length > 1 && (
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">{t('scanner.default')}</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || t('scanner.camera')}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
