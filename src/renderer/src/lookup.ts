import type { BookInput, IsbnResult, SearchHit } from '@shared/types'
import { mergeResults } from '@shared/merge'

export interface LookupOutcome {
  data: Partial<BookInput>
  sources: string[]
  coverFile: string
}

async function withCover(results: IsbnResult[]): Promise<LookupOutcome> {
  const data = mergeResults(results)
  let coverFile = ''
  for (const r of results) {
    if (!r.coverUrl) continue
    try {
      coverFile = await window.bibcraft.covers.download(r.coverUrl)
      break
    } catch {
      /* nächste Quelle versuchen */
    }
  }
  return { data, sources: results.map((r) => r.source), coverFile }
}

/**
 * ISBN, ISSN oder Barcode nachschlagen, Treffer zusammenführen und das erste
 * verfügbare Cover lokal speichern. Die Medienart ergibt sich aus der Quelle.
 */
export async function fetchMediaData(code: string): Promise<LookupOutcome> {
  return withCover(await window.bibcraft.media.lookupCode(code))
}

/** Vollständige Daten zu einem Treffer der Titelsuche laden */
export async function fetchHitData(hit: SearchHit): Promise<LookupOutcome> {
  return withCover([await window.bibcraft.media.details(hit)])
}
