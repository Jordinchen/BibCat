import { useMemo, useState } from 'react'
import type { Location, Subject } from '@shared/types'
import { Modal } from './Modal'
import { errMsg, flattenLocations } from '../util'
import { useI18n } from '../i18n'

const COLORS = ['#e05a7a', '#b45309', '#15803d', '#0369a1', '#7c3aed', '#0f766e', '#a16207', '#4b5563']

export function SubjectManager({
  subjects,
  onClose,
  onChanged
}: {
  subjects: Subject[]
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [edit, setEdit] = useState<{ id?: number; name: string; notation: string; color: string } | null>(
    null
  )
  const [error, setError] = useState('')

  async function save() {
    if (!edit) return
    try {
      await window.bibcraft.subjects.save(edit)
      setEdit(null)
      setError('')
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <Modal title={t('subjects.title')} onClose={onClose}>
      <p className="muted">{t('subjects.intro')}</p>
      <ul className="manage-list">
        {subjects.map((s) => (
          <li key={s.id}>
            <span className="dot" style={{ background: s.color }} />
            {s.notation && <span className="mono muted">{s.notation}</span>}
            <span className="grow">{s.name}</span>
            <span className="muted">{t('common.books', { n: s.bookCount })}</span>
            <button className="btn btn-sm" onClick={() => setEdit({ ...s })}>
              {t('common.change')}
            </button>
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={async () => {
                const msg = s.bookCount
                  ? t('subjects.confirmDeleteBooks', { name: s.name, n: s.bookCount })
                  : t('subjects.confirmDelete', { name: s.name })
                if (confirm(msg)) {
                  await window.bibcraft.subjects.remove(s.id)
                  onChanged()
                }
              }}
            >
              {t('common.delete')}
            </button>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="manage-form">
          <input
            placeholder={t('subjects.notation')}
            className="w-notation"
            value={edit.notation}
            onChange={(e) => setEdit({ ...edit, notation: e.target.value })}
          />
          <input
            placeholder={t('subjects.namePlaceholder')}
            className="grow"
            autoFocus
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${edit.color === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setEdit({ ...edit, color: c })}
                aria-label={c}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
          <button className="btn btn-ghost" onClick={() => setEdit(null)}>
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <button
          className="btn"
          onClick={() => setEdit({ name: '', notation: '', color: COLORS[subjects.length % COLORS.length] })}
        >
          {t('subjects.add')}
        </button>
      )}
      {error && <div className="notice notice-error">{error}</div>}
    </Modal>
  )
}

export function LocationManager({
  locations,
  onClose,
  onChanged
}: {
  locations: Location[]
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useI18n()
  const nodes = useMemo(() => flattenLocations(locations), [locations])
  const [edit, setEdit] = useState<{ id?: number; name: string; parentId: number | null } | null>(null)
  const [error, setError] = useState('')

  async function save() {
    if (!edit) return
    try {
      await window.bibcraft.locations.save(edit)
      setEdit(null)
      setError('')
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <Modal title={t('locations.title')} onClose={onClose}>
      <p className="muted">{t('locations.intro')}</p>
      <ul className="manage-list">
        {nodes.map((l) => (
          <li key={l.id} style={{ paddingLeft: 8 + l.depth * 20 }}>
            <span className="grow">
              {l.depth > 0 && <span className="muted">└ </span>}
              {l.name}
            </span>
            <span className="muted">{t('common.books', { n: l.bookCount })}</span>
            <button className="btn btn-sm" onClick={() => setEdit({ name: '', parentId: l.id })}>
              {t('locations.addChild')}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setEdit({ id: l.id, name: l.name, parentId: l.parentId })}
            >
              {t('common.change')}
            </button>
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={async () => {
                if (confirm(t('locations.confirmDelete', { name: l.name }))) {
                  await window.bibcraft.locations.remove(l.id)
                  onChanged()
                }
              }}
            >
              {t('common.delete')}
            </button>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="manage-form">
          <input
            placeholder={t('locations.namePlaceholder')}
            className="grow"
            autoFocus
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <select
            value={edit.parentId ?? ''}
            onChange={(e) => setEdit({ ...edit, parentId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{t('locations.topLevel')}</option>
            {nodes
              .filter((n) => n.id !== edit.id)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {t('locations.inside', { path: n.path })}
                </option>
              ))}
          </select>
          <button className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
          <button className="btn btn-ghost" onClick={() => setEdit(null)}>
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <button className="btn" onClick={() => setEdit({ name: '', parentId: null })}>
          {t('locations.add')}
        </button>
      )}
      {error && <div className="notice notice-error">{error}</div>}
    </Modal>
  )
}
