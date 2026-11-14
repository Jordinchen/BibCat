import type { BookInput } from '@shared/types'
import { mergeResults } from '@shared/merge'

export interface LookupOutcome {
  data: Partial<BookInput>
  sources: string[]
  coverFile: string
}

/** ISBN abfragen, Treffer zusammenführen und das erste verfügbare Cover lokal speichern. */
export async function fetchBookData(isbn: string): Promise<LookupOutcome> {
  const results = await window.bibcat.isbn.lookup(isbn)
  const data = mergeResults(results)
  let coverFile = ''
  for (const r of results) {
    if (!r.coverUrl) continue
    try {
      coverFile = await window.bibcat.covers.download(r.coverUrl)
      break
    } catch {
      /* nächste Quelle versuchen */
    }
  }
  return { data, sources: results.map((r) => r.source), coverFile }
}
