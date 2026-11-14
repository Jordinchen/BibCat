import type { Book, Location, Subject } from '@shared/types'
import type { Translate, TKey } from '@shared/i18n'

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

const COLUMNS: TKey[] = [
  'csv.mediaType',
  'csv.callNumber',
  'csv.title',
  'csv.subtitle',
  'csv.authors',
  'csv.contributors',
  'csv.publisher',
  'csv.place',
  'csv.year',
  'csv.edition',
  'csv.isbn',
  'csv.language',
  'csv.pages',
  'csv.duration',
  'csv.binding',
  'csv.ageRating',
  'csv.players',
  'csv.series',
  'csv.seriesNumber',
  'csv.subject',
  'csv.notation',
  'csv.keywords',
  'csv.location',
  'csv.copies',
  'csv.rating',
  'csv.readStatus',
  'csv.readDate',
  'csv.acquired',
  'csv.description',
  'csv.notes',
  'csv.tracks'
]

/** CSV mit Semikolon und BOM, damit Excel die Datei direkt öffnet; Spaltennamen in der App-Sprache. */
export function booksToCsv(books: Book[], subjects: Subject[], locations: Location[], t: Translate): string {
  const subj = new Map(subjects.map((s) => [s.id, s]))
  const header = COLUMNS.map((k) => t(k))
  const rows = books.map((b) => {
    const s = b.subjectId != null ? subj.get(b.subjectId) : undefined
    return [
      t(`media.${b.mediaType}`),
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
      b.duration,
      b.binding,
      b.ageRating,
      b.players,
      b.series,
      b.seriesNumber,
      s?.name,
      s?.notation,
      b.keywords,
      locationPath(b.locationId, locations),
      b.copies,
      b.rating || '',
      t(`status.${b.readStatus}`),
      b.readDate,
      b.acquiredDate,
      b.description,
      b.notes,
      b.tracks
    ]
  })
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}
