import type { BookInput, IsbnResult, SearchHit } from '@shared/types'
import type { MediaType } from '@shared/media'

// Alle Quellen verlangen einen aussagekräftigen User-Agent; persönliche Daten enthält er nicht
const UA = 'BibCraft (https://github.com/Jordinchen/BibCat)'
const MB = 'https://musicbrainz.org/ws/2'
const TMDB = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p'
const WD = 'https://www.wikidata.org/w/api.php'

type Json = any

/** Wird geworfen, wenn eine Quelle gar nicht erreichbar ist (offline, gesperrt, Zeitüberschreitung) */
export class Unreachable extends Error {}

/** Liefert null bei „nicht gefunden" bzw. Fehlerantwort; wirft Unreachable bei Verbindungsproblemen */
async function getJsonStrict(url: string, headers: Record<string, string> = {}): Promise<Json | null> {
  let res: Response
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }
    })
  } catch {
    throw new Unreachable(url)
  }
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<Json | null> {
  try {
    return await getJsonStrict(url, headers)
  } catch {
    return null
  }
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]
const year = (d: unknown) => String(d ?? '').match(/\d{4}/)?.[0] ?? ''

// ---------------------------------------------------------------------------
// MusicBrainz – Musik über Barcode oder Titel, ohne Schlüssel
// ---------------------------------------------------------------------------

function mbArtists(credit: Json[] | undefined): string {
  return uniq((credit ?? []).map((c: Json) => c?.name ?? c?.artist?.name ?? '')).join('; ')
}

function msToMinSec(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Eine MusicBrainz-Veröffentlichung (mit inc=recordings+artist-credits+labels) auf BibCraft-Felder abbilden */
export function mbReleaseToBook(rel: Json): IsbnResult | null {
  if (!rel?.title) return null
  const media: Json[] = rel.media ?? []
  const multi = media.length > 1
  const lines: string[] = []
  let totalMs = 0
  media.forEach((m, i) => {
    if (multi) lines.push(`— ${m.format ?? 'Medium'} ${i + 1}${m.title ? `: ${m.title}` : ''} —`)
    for (const tr of m.tracks ?? []) {
      const len = tr.length ?? tr.recording?.length
      if (len) totalMs += len
      lines.push(
        `${tr.number ?? tr.position}. ${tr.title ?? tr.recording?.title ?? ''}${len ? ` (${msToMinSec(len)})` : ''}`
      )
    }
  })
  const formats = uniq(media.map((m) => String(m.format ?? '').replace(/^12" Vinyl$|^Vinyl$/, 'LP')))
  const data: Partial<BookInput> = {
    mediaType: 'music',
    title: rel.title,
    authors: mbArtists(rel['artist-credit']),
    publisher: uniq((rel['label-info'] ?? []).map((l: Json) => l?.label?.name ?? '')).join(', '),
    year: year(rel.date),
    binding: formats.length > 1 ? `${media.length}× ${formats.join(' + ')}` : (formats[0] ?? ''),
    duration: totalMs ? Math.round(totalMs / 60000) : null,
    tracks: lines.join('\n'),
    language: rel['text-representation']?.language ?? '',
    keywords: uniq(
      (rel['release-group']?.['secondary-types'] ?? []).concat(rel['release-group']?.['primary-type'] ?? [])
    ).join(', ')
  }
  if (rel.disambiguation) data.subtitle = rel.disambiguation
  return {
    source: 'MusicBrainz',
    data,
    coverUrl:
      rel['cover-art-archive']?.front === false
        ? undefined
        : `https://coverartarchive.org/release/${rel.id}/front-500`
  }
}

export function mbSearchToHits(json: Json): SearchHit[] {
  return (json?.releases ?? []).slice(0, 15).map((r: Json) => ({
    source: 'musicbrainz' as const,
    id: r.id,
    title: r.title,
    year: year(r.date),
    detail: [
      mbArtists(r['artist-credit']),
      uniq((r.media ?? []).map((m: Json) => m.format ?? '')).join(' + '),
      r.country
    ]
      .filter(Boolean)
      .join(' · '),
    imageUrl: `https://coverartarchive.org/release/${r.id}/front-250`,
    mediaType: 'music' as const
  }))
}

async function mbRelease(id: string): Promise<IsbnResult | null> {
  const json = await getJson(
    `${MB}/release/${id}?inc=recordings+artist-credits+labels+release-groups&fmt=json`
  )
  return json ? mbReleaseToBook(json) : null
}

export async function musicByBarcode(code: string): Promise<IsbnResult[]> {
  const json = await getJson(`${MB}/release/?query=barcode:${encodeURIComponent(code)}&fmt=json&limit=3`)
  const first = json?.releases?.[0]
  if (!first?.id) return []
  const r = await mbRelease(first.id)
  return r ? [{ ...r, data: { ...r.data, isbn: code } }] : []
}

// ---------------------------------------------------------------------------
// TMDb – Filme und Serien, mit persönlichem Schlüssel
// ---------------------------------------------------------------------------

function tmdbAuth(key: string): { url: (u: string) => string; headers: Record<string, string> } {
  // Lese-Token (v4, beginnt mit „eyJ") als Bearer, sonst klassischer API-Schlüssel (v3)
  if (key.startsWith('eyJ')) return { url: (u) => u, headers: { Authorization: `Bearer ${key}` } }
  return { url: (u) => `${u}${u.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(key)}`, headers: {} }
}

export async function tmdbCheckKey(key: string): Promise<boolean> {
  const a = tmdbAuth(key)
  return !!(await getJson(a.url(`${TMDB}/configuration`), a.headers))
}

export function tmdbSearchToHits(json: Json): SearchHit[] {
  return (json?.results ?? [])
    .filter((r: Json) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 15)
    .map((r: Json) => ({
      source: 'tmdb' as const,
      id: `${r.media_type}:${r.id}`,
      title: r.title ?? r.name,
      year: year(r.release_date ?? r.first_air_date),
      detail: [
        r.media_type === 'tv' ? 'Serie' : 'Film',
        (r.original_title ?? r.original_name) !== (r.title ?? r.name)
          ? (r.original_title ?? r.original_name)
          : ''
      ]
        .filter(Boolean)
        .join(' · '),
      imageUrl: r.poster_path ? `${TMDB_IMG}/w185${r.poster_path}` : undefined,
      mediaType: 'film' as const
    }))
}

/** TMDb-Details (movie mit credits,release_dates bzw. tv mit credits,content_ratings) abbilden */
export function tmdbToBook(kind: 'movie' | 'tv', d: Json): IsbnResult | null {
  if (!d?.id) return null
  const cast = (d.credits?.cast ?? []).slice(0, 8).map((c: Json) => c.name)
  const genres = (d.genres ?? []).map((g: Json) => g.name)
  let fsk = ''
  if (kind === 'movie') {
    const de = (d.release_dates?.results ?? []).find((r: Json) => r.iso_3166_1 === 'DE')
    fsk = (de?.release_dates ?? []).map((r: Json) => r.certification).find((c: string) => c) ?? ''
  } else {
    fsk = (d.content_ratings?.results ?? []).find((r: Json) => r.iso_3166_1 === 'DE')?.rating ?? ''
  }
  const data: Partial<BookInput> =
    kind === 'movie'
      ? {
          mediaType: 'film',
          title: d.title,
          subtitle: d.original_title && d.original_title !== d.title ? d.original_title : '',
          authors: uniq(
            (d.credits?.crew ?? []).filter((c: Json) => c.job === 'Director').map((c: Json) => c.name)
          ).join('; '),
          publisher: (d.production_companies ?? [])
            .slice(0, 3)
            .map((c: Json) => c.name)
            .join(', '),
          year: year(d.release_date),
          duration: d.runtime || null,
          series: d.belongs_to_collection?.name ?? ''
        }
      : {
          mediaType: 'film',
          title: d.name,
          subtitle: d.original_name && d.original_name !== d.name ? d.original_name : '',
          authors: (d.created_by ?? []).map((c: Json) => c.name).join('; '),
          publisher: (d.networks ?? [])
            .slice(0, 3)
            .map((n: Json) => n.name)
            .join(', '),
          year: year(d.first_air_date),
          duration: d.episode_run_time?.[0] || null,
          series: d.name
        }
  Object.assign(data, {
    contributors: uniq(cast).join('; '),
    language: d.original_language ?? '',
    ageRating: fsk ? `FSK ${fsk}` : '',
    keywords: genres.join(', '),
    description: d.overview ?? ''
  })
  return {
    source: 'TMDb',
    data,
    coverUrl: d.poster_path ? `${TMDB_IMG}/w500${d.poster_path}` : undefined
  }
}

async function tmdbSearch(key: string, q: string, lang: string): Promise<SearchHit[]> {
  const a = tmdbAuth(key)
  const json = await getJsonStrict(
    a.url(`${TMDB}/search/multi?query=${encodeURIComponent(q)}&language=${lang}&include_adult=false`),
    a.headers
  )
  return tmdbSearchToHits(json)
}

async function tmdbDetails(key: string, id: string, lang: string): Promise<IsbnResult | null> {
  const [kind, num] = id.split(':') as ['movie' | 'tv', string]
  const a = tmdbAuth(key)
  const extra = kind === 'movie' ? 'credits,release_dates' : 'credits,content_ratings'
  const json = await getJson(
    a.url(`${TMDB}/${kind}/${num}?language=${lang}&append_to_response=${extra}`),
    a.headers
  )
  return json ? tmdbToBook(kind, json) : null
}

// ---------------------------------------------------------------------------
// Wikidata – Filme, Serien, Alben, Spiele und Comics, frei und ohne Schlüssel
// ---------------------------------------------------------------------------

/** Erlaubte Klassen (P31 „ist ein(e)") je Medienart */
const WD_CLASSES: Partial<Record<MediaType, string[]>> = {
  film: ['Q11424', 'Q5398426', 'Q506240', 'Q202866', 'Q1259759', 'Q526877', 'Q24856', 'Q63952888', 'Q24862'],
  music: ['Q482994', 'Q208569', 'Q209939', 'Q222910', 'Q134556', 'Q169930', 'Q7302866'],
  game: ['Q7889', 'Q131436', 'Q142714', 'Q1272194', 'Q11410', 'Q865493'],
  comic: ['Q1004', 'Q725377', 'Q14406742', 'Q21198342', 'Q8274', 'Q838795', 'Q1760610']
}

const claimIds = (e: Json, p: string): string[] =>
  (e?.claims?.[p] ?? []).map((c: Json) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean)
const claimValue = (e: Json, p: string): Json => e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value
const label = (e: Json, lang: string): string =>
  e?.labels?.[lang]?.value ?? e?.labels?.en?.value ?? e?.labels?.de?.value ?? ''

function wdImage(e: Json, width = 500): string | undefined {
  const file = claimValue(e, 'P3383') ?? claimValue(e, 'P18')
  return typeof file === 'string'
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`
    : undefined
}

/** Dauer in Minuten aus P2047 (Einheit Minute, Stunde oder Sekunde) */
function wdMinutes(e: Json): number | null {
  const v = claimValue(e, 'P2047')
  if (!v?.amount) return null
  const n = Number(v.amount)
  const unit = String(v.unit ?? '')
  if (unit.endsWith('Q11574')) return Math.round(n / 60)
  if (unit.endsWith('Q25235')) return Math.round(n * 60)
  return Math.round(n)
}

export function wdTypeOf(e: Json): MediaType | null {
  const classes = claimIds(e, 'P31')
  for (const [type, ids] of Object.entries(WD_CLASSES)) {
    if (classes.some((c) => ids!.includes(c))) return type as MediaType
  }
  return null
}

export function wdEntitiesToHits(
  entities: Record<string, Json>,
  order: string[],
  type: MediaType,
  lang: string
): SearchHit[] {
  return order
    .map((id) => entities[id])
    .filter((e) => e && wdTypeOf(e) === (type === 'periodical' || type === 'book' ? 'comic' : type))
    .map((e) => ({
      source: 'wikidata' as const,
      id: e.id,
      title: label(e, lang),
      year: year(claimValue(e, 'P577')?.time),
      detail: e.descriptions?.[lang]?.value ?? e.descriptions?.en?.value ?? '',
      imageUrl: wdImage(e, 250),
      mediaType: type
    }))
}

/** Wikidata-Eintrag auf BibCraft-Felder abbilden; `names` löst verknüpfte Einträge (Personen, Firmen …) in Namen auf */
export function wdToBook(e: Json, names: Record<string, string>, lang: string): IsbnResult | null {
  const type = wdTypeOf(e)
  if (!type) return null
  const n = (p: string, max = 8) =>
    uniq(
      claimIds(e, p)
        .slice(0, max)
        .map((id) => names[id] ?? '')
    ).join('; ')
  const data: Partial<BookInput> = {
    mediaType: type,
    title: label(e, lang),
    year: year(claimValue(e, 'P577')?.time),
    duration: wdMinutes(e),
    language: n('P364', 1),
    keywords: n('P136', 5).replace(/; /g, ', '),
    description: e.descriptions?.[lang]?.value ?? '',
    series: n('P179', 1)
  }
  if (type === 'film') {
    Object.assign(data, {
      authors: n('P57'),
      contributors: n('P161'),
      publisher: n('P272', 3).replace(/; /g, ', '),
      ageRating: n('P1981', 1)
    })
  } else if (type === 'music') {
    Object.assign(data, { authors: n('P175'), publisher: n('P264', 2).replace(/; /g, ', ') })
  } else if (type === 'game') {
    const min = claimValue(e, 'P1872')?.amount
    const max = claimValue(e, 'P1873')?.amount
    Object.assign(data, {
      authors: n('P178'),
      publisher: n('P123', 3).replace(/; /g, ', '),
      binding: n('P400', 6).replace(/; /g, ', '),
      ageRating: n('P914', 1) || n('P908', 1),
      players: min || max ? [min, max].filter(Boolean).map(Number).join('–') : ''
    })
  } else if (type === 'comic') {
    Object.assign(data, {
      authors: n('P50'),
      contributors: n('P110'),
      publisher: n('P123', 3).replace(/; /g, ', ')
    })
  }
  return { source: 'Wikidata', data, coverUrl: wdImage(e) }
}

const WD_LINKED = [
  'P57',
  'P161',
  'P272',
  'P1981',
  'P175',
  'P264',
  'P178',
  'P123',
  'P400',
  'P914',
  'P908',
  'P50',
  'P110',
  'P364',
  'P136',
  'P179'
]

async function wdEntities(ids: string[], props: string, lang: string): Promise<Record<string, Json>> {
  const out: Record<string, Json> = {}
  for (let i = 0; i < ids.length; i += 50) {
    const json = await getJson(
      `${WD}?action=wbgetentities&ids=${ids.slice(i, i + 50).join('|')}&props=${props}&languages=${lang}|en&format=json`
    )
    Object.assign(out, json?.entities ?? {})
  }
  return out
}

async function wdSearch(q: string, type: MediaType, lang: string): Promise<SearchHit[]> {
  const s = await getJsonStrict(
    `${WD}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=${lang}&uselang=${lang}&type=item&limit=30&format=json`
  )
  const ids: string[] = (s?.search ?? []).map((r: Json) => r.id)
  if (!ids.length) return []
  const entities = await wdEntities(ids, 'labels|descriptions|claims', lang)
  return wdEntitiesToHits(entities, ids, type, lang)
}

async function wdDetails(id: string, lang: string): Promise<IsbnResult | null> {
  const e = (await wdEntities([id], 'labels|descriptions|claims', lang))[id]
  if (!e) return null
  const linked = uniq(WD_LINKED.flatMap((p) => claimIds(e, p).slice(0, 8)))
  const labels = linked.length ? await wdEntities(linked, 'labels', lang) : {}
  const names = Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, label(v, lang)]))
  return wdToBook(e, names, lang)
}

// ---------------------------------------------------------------------------
// Einstiegspunkte für den Hauptprozess
// ---------------------------------------------------------------------------

export interface MediaLookupContext {
  /** Sprache der Oberfläche (de/en) für Titel und Beschreibungen */
  lang: string
  /** Persönlicher TMDb-Schlüssel oder null */
  tmdbKey: string | null
}

/**
 * Fragt mehrere Quellen ab. Ist keine einzige erreichbar, wird Unreachable geworfen –
 * so kann die Oberfläche „offline" von „nichts gefunden" unterscheiden.
 */
async function anyOf(tasks: (() => Promise<SearchHit[]>)[]): Promise<SearchHit[]> {
  const results = await Promise.allSettled(tasks.map((f) => f()))
  const ok = results.filter((r): r is PromiseFulfilledResult<SearchHit[]> => r.status === 'fulfilled')
  if (!ok.length) throw new Unreachable('all sources')
  return ok.flatMap((r) => r.value)
}

export async function searchMedia(q: string, type: MediaType, ctx: MediaLookupContext): Promise<SearchHit[]> {
  const query = q.trim()
  if (!query) return []
  const tmdbLang = ctx.lang === 'de' ? 'de-DE' : 'en-US'
  if (type === 'music') {
    const mb = await anyOf([
      async () =>
        mbSearchToHits(
          await getJsonStrict(`${MB}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=15`)
        )
    ]).catch(() => [] as SearchHit[])
    return mb.length ? mb : anyOf([() => wdSearch(query, 'music', ctx.lang)])
  }
  if (type === 'film') {
    return anyOf([
      ...(ctx.tmdbKey ? [() => tmdbSearch(ctx.tmdbKey!, query, tmdbLang)] : []),
      () => wdSearch(query, 'film', ctx.lang)
    ])
  }
  return anyOf([() => wdSearch(query, type, ctx.lang)])
}

export async function mediaDetails(hit: SearchHit, ctx: MediaLookupContext): Promise<IsbnResult | null> {
  if (hit.source === 'musicbrainz') return mbRelease(hit.id)
  if (hit.source === 'tmdb') {
    return ctx.tmdbKey ? tmdbDetails(ctx.tmdbKey, hit.id, ctx.lang === 'de' ? 'de-DE' : 'en-US') : null
  }
  const r = await wdDetails(hit.id, ctx.lang)
  // Comics/Zeitschriften behalten die gewählte Art
  if (
    r &&
    hit.mediaType !== r.data.mediaType &&
    (hit.mediaType === 'periodical' || hit.mediaType === 'book')
  ) {
    r.data.mediaType = hit.mediaType
  }
  return r
}
