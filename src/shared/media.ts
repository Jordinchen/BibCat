import { cleanIsbn, isValidIsbn10, isValidIsbn13 } from './isbn'

/** Medienarten, die BibCraft verwalten kann */
export type MediaType = 'book' | 'comic' | 'periodical' | 'film' | 'music' | 'game'

export const MEDIA_TYPES: MediaType[] = ['book', 'comic', 'periodical', 'film', 'music', 'game']

/**
 * Für Feldbeschriftungen und Lesestatus werden die Arten zu Gruppen zusammengefasst:
 * Comics und Zeitschriften verhalten sich wie Bücher (lesen, Seiten, Verlag).
 */
export type MediaGroup = 'book' | 'film' | 'music' | 'game'

export function mediaGroup(t: MediaType): MediaGroup {
  return t === 'comic' || t === 'periodical' ? 'book' : t
}

export function isMediaType(v: unknown): v is MediaType {
  return typeof v === 'string' && (MEDIA_TYPES as string[]).includes(v)
}

/** Zum Lesen gedachte Medien – nur sie zählen bei „Seiten gelesen" */
export const READABLE: MediaType[] = ['book', 'comic', 'periodical']

/** Prüfziffer für EAN-13, EAN-8 und UPC-A (12 Stellen) */
export function isValidEan(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  // Von rechts gewichtet: 3, 1, 3, 1 …
  let sum = 0
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w
  return (10 - (sum % 10)) % 10 === check
}

export function isValidIssn(raw: string): boolean {
  const s = cleanIsbn(raw)
  if (!/^\d{7}[\dX]$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 7; i++) sum += Number(s[i]) * (8 - i)
  const c = (11 - (sum % 11)) % 11
  return s[7] === (c === 10 ? 'X' : String(c))
}

export type CodeKind = 'isbn' | 'issn' | 'ean' | 'invalid'

/**
 * Ordnet einen gescannten oder eingetippten Code ein:
 * ISBN (978/979 bzw. ISBN-10), ISSN (8 Zeichen oder EAN mit Präfix 977), sonstige EAN/UPC.
 */
export function classifyCode(raw: string): CodeKind {
  const s = cleanIsbn(raw)
  if (s.length === 10 && isValidIsbn10(s)) return 'isbn'
  if (s.length === 13 && /^97[89]/.test(s) && isValidIsbn13(s)) return 'isbn'
  if (s.length === 8 && isValidIssn(s)) return 'issn'
  if (s.length === 13 && s.startsWith('977') && isValidEan(s)) return 'issn'
  if (/^\d+$/.test(s) && isValidEan(s)) return 'ean'
  return 'invalid'
}

/** ISSN aus einer Zeitschriften-EAN (977 + 7 Ziffern ISSN ohne Prüfziffer + 2 + Prüfziffer) */
export function issnFromEan(ean: string): string | null {
  if (!/^977\d{10}$/.test(ean)) return null
  const core = ean.slice(3, 10)
  let sum = 0
  for (let i = 0; i < 7; i++) sum += Number(core[i]) * (8 - i)
  const c = (11 - (sum % 11)) % 11
  return `${core.slice(0, 4)}-${core.slice(4)}${c === 10 ? 'X' : c}`
}
