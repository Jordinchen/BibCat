import type { BookInput, IsbnResult } from './types'

/** Führt mehrere Treffer zusammen: erste Quelle gewinnt, leere Felder werden aufgefüllt. */
export function mergeResults(results: IsbnResult[]): Partial<BookInput> {
  const merged: Partial<BookInput> = {}
  for (const r of results) {
    for (const [k, v] of Object.entries(r.data) as [keyof BookInput, unknown][]) {
      const cur = merged[k]
      if ((cur === undefined || cur === '' || cur === null) && v !== '' && v != null) {
        ;(merged as Record<string, unknown>)[k] = v
      }
    }
  }
  return merged
}
