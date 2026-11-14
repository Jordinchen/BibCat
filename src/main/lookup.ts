import type { BookInput, IsbnResult } from '@shared/types'
import { isbn13to10, toIsbn13 } from '@shared/isbn'
import { AppError } from '@shared/i18n'

const TIMEOUT_MS = 12000

export async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'BibCraft (https://github.com/Jordinchen/BibCat)' }
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/** Entfernt ISBD-Satzzeichen am Ende ("Titel /", "Ort :", "Verlag,"). */
function trimIsbd(s: string): string {
  // ISBD-Deskriptionszeichen stehen nach einem Leerzeichen; Abkürzungspunkte ("Aufl.") bleiben
  return s
    .replace(/\s+[/:;=]\s*$/, '')
    .replace(/,\s*$/, '')
    .replace(/^\s*\[|\]\s*$/g, '')
    .trim()
}

function decodeXml(s: string): string {
  return (
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&amp;/g, '&')
      // MARC-Nichtsortierzeichen (DNB nutzt U+0098/U+009C)
      .replace(/[\u0098\u009c]/g, '')
  )
}

interface MarcField {
  tag: string
  ind1: string
  ind2: string
  sub: [string, string][]
}

/** Minimaler MARC21-XML-Parser für den ersten Datensatz einer SRU-Antwort. */
export function parseMarcXml(xml: string): MarcField[] {
  const rec = xml.match(/<record[^>]*type="Bibliographic"[^>]*>([\s\S]*?)<\/record>/)
  const body = rec ? rec[1] : xml
  const fields: MarcField[] = []
  const re = /<datafield([^>]*)>([\s\S]*?)<\/datafield>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const attrs = m[1]
    const tag = /tag="(\d+)"/.exec(attrs)?.[1] ?? ''
    const ind1 = /ind1="(.)"/.exec(attrs)?.[1] ?? ' '
    const ind2 = /ind2="(.)"/.exec(attrs)?.[1] ?? ' '
    const sub: [string, string][] = []
    const sre = /<subfield code="(.)">([\s\S]*?)<\/subfield>/g
    let s: RegExpExecArray | null
    while ((s = sre.exec(m[2]))) sub.push([s[1], decodeXml(s[2])])
    fields.push({ tag, ind1, ind2, sub })
  }
  return fields
}

/** "Kehlmann, Daniel" bleibt, Lebensdaten u. ä. fallen weg. */
function personName(f: MarcField): string {
  const a = f.sub.find(([c]) => c === 'a')?.[1] ?? ''
  return trimIsbd(a)
}

export function marcToBook(fields: MarcField[]): Partial<BookInput> | null {
  if (!fields.length) return null
  const all = (tag: string) => fields.filter((f) => f.tag === tag)
  const first = (tag: string) => fields.find((f) => f.tag === tag)
  const sf = (f: MarcField | undefined, code: string) => f?.sub.find(([c]) => c === code)?.[1]

  const out: Partial<BookInput> = {}

  const t = first('245')
  if (t) {
    out.title = trimIsbd(sf(t, 'a') ?? '')
    const sub = sf(t, 'b')
    if (sub) out.subtitle = trimIsbd(sub)
    const part = [sf(t, 'n'), sf(t, 'p')].filter(Boolean).join(' ')
    if (part) out.subtitle = [out.subtitle, trimIsbd(part)].filter(Boolean).join(' – ')
  }

  const authors = [
    ...all('100'),
    ...all('700').filter((f) => {
      const roles = f.sub.filter(([c]) => c === '4' || c === 'e').map(([, v]) => v)
      return roles.length === 0 || roles.some((r) => /aut|verfasser/i.test(r))
    })
  ]
    .map(personName)
    .filter(Boolean)
  if (authors.length) out.authors = [...new Set(authors)].join('; ')

  const contributors = all('700')
    .filter((f) => f.sub.some(([c, v]) => (c === '4' || c === 'e') && !/aut|verfasser/i.test(v)))
    .map((f) => {
      const role = f.sub.find(([c]) => c === 'e')?.[1] ?? f.sub.find(([c]) => c === '4')?.[1]
      return role ? `${personName(f)} (${trimIsbd(role)})` : personName(f)
    })
  if (contributors.length) out.contributors = contributors.join('; ')

  const pub = all('264').find((f) => f.ind2 === '1') ?? first('264') ?? first('260')
  if (pub) {
    const place = sf(pub, 'a')
    const publisher = sf(pub, 'b')
    const date = sf(pub, 'c')
    if (place) out.place = trimIsbd(place)
    if (publisher) out.publisher = trimIsbd(publisher)
    if (date) out.year = date.match(/\d{4}/)?.[0] ?? trimIsbd(date)
  }

  const ed = sf(first('250'), 'a')
  if (ed) out.edition = trimIsbd(ed)

  const extent = sf(first('300'), 'a')
  if (extent) {
    const n = extent.match(/(\d+)\s*(S\.|Seiten|p\.|pages)/i)
    if (n) out.pages = Number(n[1])
  }

  const series = first('490') ?? first('830')
  if (series) {
    const name = sf(series, 'a')
    const vol = sf(series, 'v')
    if (name) out.series = trimIsbd(name)
    if (vol) out.seriesNumber = trimIsbd(vol)
  }

  const lang = sf(first('041'), 'a')
  if (lang) out.language = lang

  const isbnField = first('020')
  const binding = sf(isbnField, 'q') ?? sf(isbnField, 'c')
  if (binding && !/EUR|€|\d+,\d\d/.test(binding)) out.binding = trimIsbd(binding)

  // Schlagworte: GND-Schlagwortketten (689) und Indexierung (650)
  const kw = [...all('689'), ...all('650')]
    .map((f) => sf(f, 'a'))
    .filter((v): v is string => !!v)
    .map(trimIsbd)
  if (kw.length) out.keywords = [...new Set(kw)].join(', ')

  const summary = sf(first('520'), 'a')
  if (summary) out.description = summary.trim()

  return out.title ? out : null
}

async function fromDnb(isbn: string): Promise<IsbnResult | null> {
  const url =
    'https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve' +
    `&query=num%3D${isbn}&recordSchema=MARC21-xml&maximumRecords=1`
  const xml = await fetchText(url)
  if (!xml || !/<numberOfRecords>[1-9]/.test(xml)) return null
  const data = marcToBook(parseMarcXml(xml))
  if (!data) return null
  return {
    source: 'Deutsche Nationalbibliothek',
    data,
    coverUrl: `https://portal.dnb.de/opac/mvb/cover?isbn=${isbn}`
  }
}

/** Zeitschriften über ihre ISSN bei der Deutschen Nationalbibliothek suchen */
export async function lookupIssn(issn: string): Promise<IsbnResult[]> {
  const url =
    'https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve' +
    `&query=num%3D${encodeURIComponent(issn)}&recordSchema=MARC21-xml&maximumRecords=1`
  const xml = await fetchText(url)
  if (!xml || !/<numberOfRecords>[1-9]/.test(xml)) return []
  const data = marcToBook(parseMarcXml(xml))
  return data ? [{ source: 'Deutsche Nationalbibliothek', data: { ...data, mediaType: 'periodical' } }] : []
}

export function openLibraryToBook(json: unknown, isbn: string): IsbnResult | null {
  const rec = (json as Record<string, any>)?.[`ISBN:${isbn}`]
  if (!rec?.title) return null
  const data: Partial<BookInput> = {
    title: rec.title,
    subtitle: rec.subtitle ?? '',
    authors: (rec.authors ?? []).map((a: { name: string }) => a.name).join('; '),
    publisher: (rec.publishers ?? []).map((p: { name: string }) => p.name).join(', '),
    place: (rec.publish_places ?? []).map((p: { name: string }) => p.name).join(', '),
    year: String(rec.publish_date ?? '').match(/\d{4}/)?.[0] ?? '',
    pages: rec.number_of_pages ?? null,
    keywords: (rec.subjects ?? [])
      .slice(0, 8)
      .map((s: { name: string }) => s.name)
      .join(', ')
  }
  return {
    source: 'Open Library',
    data,
    coverUrl: rec.cover?.large ?? rec.cover?.medium
  }
}

async function fromOpenLibrary(isbn: string): Promise<IsbnResult | null> {
  const txt = await fetchText(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
  if (!txt) return null
  try {
    return openLibraryToBook(JSON.parse(txt), isbn)
  } catch {
    return null
  }
}

export function googleToBook(json: unknown): IsbnResult | null {
  const v = (json as any)?.items?.[0]?.volumeInfo
  if (!v?.title) return null
  const data: Partial<BookInput> = {
    title: v.title,
    subtitle: v.subtitle ?? '',
    authors: (v.authors ?? []).join('; '),
    publisher: v.publisher ?? '',
    year: String(v.publishedDate ?? '').slice(0, 4),
    pages: v.pageCount ?? null,
    language: v.language ?? '',
    description: v.description ?? '',
    keywords: (v.categories ?? []).join(', ')
  }
  const img = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail
  return {
    source: 'Google Books',
    data,
    coverUrl: img
      ? String(img)
          .replace(/^http:/, 'https:')
          .replace('&edge=curl', '')
      : undefined
  }
}

async function fromGoogle(isbn: string): Promise<IsbnResult | null> {
  const txt = await fetchText(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
  if (!txt) return null
  try {
    return googleToBook(JSON.parse(txt))
  } catch {
    return null
  }
}

/** Fragt alle Quellen parallel ab; DNB zuerst, da für deutschsprachige Titel am genauesten. */
export async function lookupIsbn(raw: string): Promise<IsbnResult[]> {
  const isbn = toIsbn13(raw)
  if (!isbn) throw new AppError('err.invalidIsbn')
  const results = await Promise.all([fromDnb(isbn), fromOpenLibrary(isbn), fromGoogle(isbn)])
  const found = results.filter((r): r is IsbnResult => !!r)
  // Open Library kennt manche Bücher nur unter der ISBN-10
  if (!found.some((r) => r.source === 'Open Library')) {
    const isbn10 = isbn13to10(isbn)
    if (isbn10) {
      const txt = await fetchText(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn10}&format=json&jscmd=data`
      )
      try {
        const r = txt ? openLibraryToBook(JSON.parse(txt), isbn10) : null
        if (r) found.push(r)
      } catch {
        /* ignorieren */
      }
    }
  }
  for (const r of found) r.data.isbn = isbn
  return found
}
