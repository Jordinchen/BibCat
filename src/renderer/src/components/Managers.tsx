import { useMemo, useState } from 'react'
import type { Location, Subject } from '@shared/types'
import { Modal } from './Modal'
import { flattenLocations } from '../util'

const COLORS = ['#b45309', '#15803d', '#0369a1', '#7c3aed', '#be123c', '#0f766e', '#a16207', '#4b5563']

export function SubjectManager({
  subjects,
  onClose,
  onChanged
}: {
  subjects: Subject[]
  onClose: () => void
  onChanged: () => void
}) {
  const [edit, setEdit] = useState<{ id?: number; name: string; notation: string; color: string } | null>(
    null
  )
  const [error, setError] = useState('')

  async function save() {
    if (!edit) return
    try {
      await window.bibcat.subjects.save(edit)
      setEdit(null)
      setError('')
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal title="Fachgebiete" onClose={onClose}>
      <p className="muted">
        Fachgebiete gliedern deinen Bestand thematisch. Optional kannst du eine Notation aus einer Systematik
        vergeben (z. B. DDC <span className="mono">830</span> für deutsche Literatur).
      </p>
      <ul className="manage-list">
        {subjects.map((s) => (
          <li key={s.id}>
            <span className="dot" style={{ background: s.color }} />
            {s.notation && <span className="mono muted">{s.notation}</span>}
            <span className="grow">{s.name}</span>
            <span className="muted">{s.bookCount} Bücher</span>
            <button className="btn btn-sm" onClick={() => setEdit({ ...s })}>
              Ändern
            </button>
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={async () => {
                const msg = s.bookCount
                  ? `„${s.name}" löschen? ${s.bookCount} Bücher verlieren dabei ihr Fachgebiet.`
                  : `„${s.name}" löschen?`
                if (confirm(msg)) {
                  await window.bibcat.subjects.remove(s.id)
                  onChanged()
                }
              }}
            >
              Löschen
            </button>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="manage-form">
          <input
            placeholder="Notation"
            className="w-notation"
            value={edit.notation}
            onChange={(e) => setEdit({ ...edit, notation: e.target.value })}
          />
          <input
            placeholder="Name, z. B. Philosophie"
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
                aria-label={`Farbe ${c}`}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={save}>
            Speichern
          </button>
          <button className="btn btn-ghost" onClick={() => setEdit(null)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          className="btn"
          onClick={() => setEdit({ name: '', notation: '', color: COLORS[subjects.length % COLORS.length] })}
        >
          + Fachgebiet hinzufügen
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
  const nodes = useMemo(() => flattenLocations(locations), [locations])
  const [edit, setEdit] = useState<{ id?: number; name: string; parentId: number | null } | null>(null)
  const [error, setError] = useState('')

  async function save() {
    if (!edit) return
    try {
      await window.bibcat.locations.save(edit)
      setEdit(null)
      setError('')
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal title="Standorte" onClose={onClose}>
      <p className="muted">
        Standorte lassen sich verschachteln, z. B. <em>Arbeitszimmer › Regal 2 › Fach 3</em>. Ein Klick auf
        einen Raum zeigt später alle Bücher darin – auch die in den Regalen.
      </p>
      <ul className="manage-list">
        {nodes.map((l) => (
          <li key={l.id} style={{ paddingLeft: 8 + l.depth * 20 }}>
            <span className="grow">
              {l.depth > 0 && <span className="muted">└ </span>}
              {l.name}
            </span>
            <span className="muted">{l.bookCount} Bücher</span>
            <button className="btn btn-sm" onClick={() => setEdit({ name: '', parentId: l.id })}>
              + Unterort
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setEdit({ id: l.id, name: l.name, parentId: l.parentId })}
            >
              Ändern
            </button>
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={async () => {
                if (
                  confirm(
                    `„${l.name}" und alle Unterorte löschen? Die Bücher bleiben erhalten, verlieren aber ihren Standort.`
                  )
                ) {
                  await window.bibcat.locations.remove(l.id)
                  onChanged()
                }
              }}
            >
              Löschen
            </button>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="manage-form">
          <input
            placeholder="Name, z. B. Wohnzimmer oder Regal 1"
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
            <option value="">(oberste Ebene)</option>
            {nodes
              .filter((n) => n.id !== edit.id)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  in: {n.path}
                </option>
              ))}
          </select>
          <button className="btn btn-primary" onClick={save}>
            Speichern
          </button>
          <button className="btn btn-ghost" onClick={() => setEdit(null)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <button className="btn" onClick={() => setEdit({ name: '', parentId: null })}>
          + Raum / Standort hinzufügen
        </button>
      )}
      {error && <div className="notice notice-error">{error}</div>}
    </Modal>
  )
}
