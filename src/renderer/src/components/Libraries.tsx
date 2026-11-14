import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, FolderOpen, Library, Plus, Settings2, TriangleAlert } from 'lucide-react'
import type { LibraryInfo } from '@shared/types'
import { Modal } from './Modal'
import { errMsg } from '../util'
import { useI18n } from '../i18n'

/** Wechselt die Bibliothek; die Oberfläche startet danach mit der neuen Bibliothek neu. */
export async function switchLibrary(path: string): Promise<void> {
  await window.bibcraft.libraries.switchTo(path)
  window.location.reload()
}

/** Name der geöffneten Bibliothek in der Titelleiste, mit Menü zum Umschalten */
export function LibrarySwitcher({
  current,
  onNew,
  onOpen,
  onManage,
  onError
}: {
  current: LibraryInfo
  onNew: () => void
  onOpen: () => void
  onManage: () => void
  onError: (msg: string) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<LibraryInfo[]>([])
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    window.bibcraft.libraries.list().then(setList)
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="libswitch" ref={root}>
      <button
        className={`libswitch-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={t('library.switch')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Library size={15} />
        <span className="libswitch-name">{current.name}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {list.map((l) => (
            <button
              key={l.path}
              role="menuitemradio"
              aria-checked={l.current}
              className={`menu-item ${l.current ? 'current' : ''}`}
              disabled={!l.exists}
              title={l.exists ? l.path : t('libraries.missing')}
              onClick={run(() => {
                if (!l.current) switchLibrary(l.path).catch((e) => onError(errMsg(e)))
              })}
            >
              <span className="menu-check">{l.current && <Check size={14} />}</span>
              <span className="menu-label">{l.name}</span>
              {!l.exists && <TriangleAlert size={14} className="menu-warn" />}
            </button>
          ))}
          <div className="menu-sep" />
          <button role="menuitem" className="menu-item" onClick={run(onNew)}>
            <span className="menu-check">
              <Plus size={14} />
            </span>
            {t('library.menuNew')}
          </button>
          <button role="menuitem" className="menu-item" onClick={run(onOpen)}>
            <span className="menu-check">
              <FolderOpen size={14} />
            </span>
            {t('library.menuOpen')}
          </button>
          <button role="menuitem" className="menu-item" onClick={run(onManage)}>
            <span className="menu-check">
              <Settings2 size={14} />
            </span>
            {t('library.menuManage')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Neue Bibliothek anlegen und sofort öffnen */
export function NewLibraryDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const lib = await window.bibcraft.libraries.create(name, parent)
      await switchLibrary(lib.path)
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('libraries.newTitle')}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={create} disabled={busy || !name.trim()}>
            {t('libraries.create')}
          </button>
        </>
      }
    >
      <p className="muted">{t('libraries.intro')}</p>
      <div className="form-col">
        <label className="field">
          <span className="field-label">{t('libraries.name')}</span>
          <input
            autoFocus
            value={name}
            placeholder={t('libraries.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()}
          />
        </label>
        <div className="field">
          <span className="field-label">{t('libraries.location')}</span>
          <div className="location-pick">
            <span className={`location-path ${parent ? 'mono' : ''}`}>
              {parent ?? t('libraries.locationDefault')}
            </span>
            <button
              className="btn btn-sm"
              onClick={async () => {
                const p = await window.bibcraft.libraries.pickLocation()
                if (p) setParent(p)
              }}
            >
              {t('libraries.chooseLocation')}
            </button>
            {parent && (
              <button className="btn btn-sm btn-ghost" onClick={() => setParent(null)}>
                {t('libraries.resetLocation')}
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
    </Modal>
  )
}

/** Bestehende Bibliothek per Ordnerauswahl öffnen; gibt eine Fehlermeldung zurück oder wechselt */
export async function openLibraryDialog(): Promise<void> {
  const lib = await window.bibcraft.libraries.openDialog()
  if (lib && !lib.current) await switchLibrary(lib.path)
}

/** Übersicht aller bekannten Bibliotheken */
export function LibraryManager({ onClose, onNew }: { onClose: () => void; onNew: () => void }) {
  const { t } = useI18n()
  const [list, setList] = useState<LibraryInfo[]>([])
  const [editing, setEditing] = useState<{ path: string; name: string } | null>(null)
  const [error, setError] = useState('')

  const load = () => window.bibcraft.libraries.list().then(setList)
  useEffect(() => {
    load()
  }, [])

  const guard = (fn: () => Promise<unknown>) => async () => {
    try {
      setError('')
      await fn()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <Modal title={t('libraries.title')} onClose={onClose} wide>
      <p className="muted">{t('libraries.intro')}</p>
      <ul className="lib-list">
        {list.map((l) => (
          <li key={l.path} className={l.current ? 'current' : ''}>
            <Library size={20} className="lib-icon" />
            <div className="lib-text">
              {editing?.path === l.path ? (
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await guard(async () => {
                        await window.bibcraft.libraries.rename(l.path, editing.name)
                        setEditing(null)
                        if (l.current) document.title = `${editing.name.trim()} – BibCraft`
                        await load()
                      })()
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setEditing(null)
                    }
                  }}
                />
              ) : (
                <strong>
                  {l.name}
                  {l.current && <span className="lib-badge">{t('libraries.current')}</span>}
                  {!l.exists && <span className="lib-badge warn">{t('libraries.missing')}</span>}
                </strong>
              )}
              <span className="mono muted lib-path" title={l.path}>
                {l.path}
              </span>
            </div>
            <div className="lib-actions">
              {!l.current && (
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!l.exists}
                  onClick={guard(() => switchLibrary(l.path))}
                >
                  {t('libraries.open')}
                </button>
              )}
              <button
                className="btn btn-sm"
                disabled={!l.exists}
                onClick={() => setEditing({ path: l.path, name: l.name })}
              >
                {t('libraries.rename')}
              </button>
              <button className="btn btn-sm" onClick={guard(() => window.bibcraft.libraries.reveal(l.path))}>
                {t('libraries.reveal')}
              </button>
              {!l.current && (
                <button
                  className="btn btn-sm btn-ghost btn-danger"
                  onClick={guard(async () => {
                    if (!confirm(t('libraries.confirmForget', { name: l.name }))) return
                    await window.bibcraft.libraries.forget(l.path)
                    await load()
                  })}
                >
                  {t('libraries.forget')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="row gap-sm">
        <button className="btn" onClick={onNew}>
          <Plus size={15} /> {t('library.menuNew')}
        </button>
        <button className="btn" onClick={guard(openLibraryDialog)}>
          <FolderOpen size={15} /> {t('library.menuOpen')}
        </button>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
    </Modal>
  )
}
