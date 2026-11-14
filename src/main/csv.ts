import type { Book, Location, Subject } from '@shared/types'
import { READ_STATUS_LABELS } from '@shared/types'

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function locationPath(id: number | null, locations: Location[]): string {
  const byId = new Map(locations.map((l) => [l.id, l]))
  const parts: string[] = []
  let cur = id != null ? byId.get(id) : undefined
  const seen = new Set<number>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.name)
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined
  }
  return parts.join(' › ')
}

/** CSV mit Semikolon und BOM, damit Excel (deutsche Einstellungen) die Datei direkt öffnet. */
export function booksToCsv(books: Book[], subjects: Subject[], locations: Location[]): string {
  const subj = new Map(subjects.map((s) => [s.id, s]))
  const header = [
    'Signatur',
    'Titel',
    'Untertitel',
    'Autor(en)',
    'Beteiligte',
    'Verlag',
    'Ort',
    'Jahr',
    'Auflage',
    'ISBN',
    'Sprache',
    'Seiten',
    'Einband',
    'Reihe',
    'Band',
    'Fachgebiet',
    'Notation',
    'Schlagworte',
    'Standort',
    'Exemplare',
    'Bewertung',
    'Lesestatus',
    'Gelesen am',
    'Erworben am',
    'Beschreibung',
    'Notizen'
  ]
  const rows = books.map((b) => {
    const s = b.subjectId != null ? subj.get(b.subjectId) : undefined
    return [
      b.callNumber,
      b.title,
      b.subtitle,
      b.authors,
      b.contributors,
      b.publisher,
      b.place,
      b.year,
      b.edition,
      b.isbn,
      b.language,
      b.pages,
      b.binding,
      b.series,
      b.seriesNumber,
      s?.name,
      s?.notation,
      b.keywords,
      locationPath(b.locationId, locations),
      b.copies,
      b.rating || '',
      READ_STATUS_LABELS[b.readStatus],
      b.readDate,
      b.acquiredDate,
      b.description,
      b.notes
    ]
  })
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}
