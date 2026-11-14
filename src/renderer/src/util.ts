import type { Location } from '@shared/types'

export interface LocationNode extends Location {
  depth: number
  path: string
}

/** Sortiert Standorte als Baum (Tiefensuche) und berechnet Pfade wie "Arbeitszimmer › Regal 2". */
export function flattenLocations(list: Location[]): LocationNode[] {
  const children = new Map<number | null, Location[]>()
  for (const l of list) {
    const k = l.parentId ?? null
    if (!children.has(k)) children.set(k, [])
    children.get(k)!.push(l)
  }
  const out: LocationNode[] = []
  const walk = (parent: number | null, depth: number, prefix: string) => {
    for (const l of children.get(parent) ?? []) {
      const path = prefix ? `${prefix} › ${l.name}` : l.name
      out.push({ ...l, depth, path })
      walk(l.id, depth + 1, path)
    }
  }
  walk(null, 0, '')
  return out
}

export function primaryAuthor(authors: string): string {
  const first = authors.split(';')[0]?.trim() ?? ''
  const extra = authors.split(';').length > 1 ? ' u. a.' : ''
  return first + extra
}
