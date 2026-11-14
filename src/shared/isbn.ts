/** Entfernt Bindestriche/Leerzeichen und vereinheitlicht ein "x" als Prüfziffer. */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9xX]/g, '').toUpperCase()
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const v = isbn[i] === 'X' ? 10 : Number(isbn[i])
    sum += v * (10 - i)
  }
  return sum % 11 === 0
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  return sum % 10 === 0
}

export function isValidIsbn(raw: string): boolean {
  const s = cleanIsbn(raw)
  return s.length === 10 ? isValidIsbn10(s) : isValidIsbn13(s)
}

export function isbn10to13(isbn10: string): string {
  const core = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  return core + ((10 - (sum % 10)) % 10)
}

export function isbn13to10(isbn13: string): string | null {
  if (!isbn13.startsWith('978')) return null
  const core = isbn13.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i)
  const check = (11 - (sum % 11)) % 11
  return core + (check === 10 ? 'X' : String(check))
}

/** Liefert eine gültige ISBN-13 oder null. */
export function toIsbn13(raw: string): string | null {
  const s = cleanIsbn(raw)
  if (s.length === 10 && isValidIsbn10(s)) return isbn10to13(s)
  if (s.length === 13 && isValidIsbn13(s)) return s
  return null
}
