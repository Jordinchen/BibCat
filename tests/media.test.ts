import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyCode, isValidEan, isValidIssn, issnFromEan } from '@shared/media'
import { EMPTY_BOOK, type BookInput } from '@shared/types'
import { Catalog, MIGRATIONS } from '../src/main/db'
import {
  mbReleaseToBook,
  mbSearchToHits,
  tmdbSearchToHits,
  tmdbToBook,
  wdEntitiesToHits,
  wdToBook,
  wdTypeOf
} from '../src/main/media-lookup'

const book = (p: Partial<BookInput>): BookInput => ({ ...EMPTY_BOOK, ...p })

describe('Codes erkennen', () => {
  it('prüft EAN-13, EAN-8, UPC-A und ISSN', () => {
    expect(isValidEan('4006381333931')).toBe(true)
    expect(isValidEan('4006381333932')).toBe(false)
    expect(isValidEan('036000291452')).toBe(true) // UPC-A
    expect(isValidEan('73513537')).toBe(true) // EAN-8
    expect(isValidIssn('0317-8471')).toBe(true)
    expect(isValidIssn('0317-8472')).toBe(false)
  })

  it('ordnet Codes ein', () => {
    expect(classifyCode('978-3-16-148410-0')).toBe('isbn')
    expect(classifyCode('3-499-13599-X')).toBe('isbn')
    expect(classifyCode('0317-8471')).toBe('issn')
    expect(classifyCode('4006381333931')).toBe('ean')
    expect(classifyCode('036000291452')).toBe('ean')
    expect(classifyCode('4006381333932')).toBe('invalid')
    expect(classifyCode('abc')).toBe('invalid')
  })

  it('liest die ISSN aus einer Zeitschriften-EAN', () => {
    // 977 + ISSN ohne Prüfziffer + 00 + EAN-Prüfziffer
    const core = '977031784700'
    const ean = [...Array(10).keys()].map((d) => core + d).find(isValidEan)!
    expect(classifyCode(ean)).toBe('issn')
    expect(issnFromEan(ean)).toBe('0317-8471')
  })
})

describe('Datenbank mit Medienarten', () => {
  it('stellt eine Bibliothek aus Version 0.5 um, ohne Daten zu verlieren', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bibcraft-')), 'katalog.sqlite')
    const old = new DatabaseSync(file)
    old.exec(MIGRATIONS[0])
    old.exec(MIGRATIONS[1])
    old.exec('PRAGMA user_version = 2')
    old.exec("INSERT INTO books (title, authors, isbn) VALUES ('Faust', 'Goethe', '9783150000014')")
    old.close()

    const c = new Catalog(file)
    const [b] = c.listBooks()
    expect(b).toMatchObject({ title: 'Faust', mediaType: 'book', duration: null, tracks: '', ageRating: '' })
    expect(c.listBooks({ text: 'goethe' })).toHaveLength(1)
    c.updateBook(b.id, { ...b, tracks: 'Osterspaziergang' })
    expect(c.listBooks({ text: 'osterspazier' })).toHaveLength(1)
    c.close()
  })

  it('filtert, ändert und zählt nach Medienart', () => {
    const c = new Catalog(':memory:')
    const a = c.createBook(book({ title: 'Roman', pages: 300, readStatus: 'read' }))
    c.createBook(book({ title: 'Matrix', mediaType: 'film', duration: 136, readStatus: 'read', pages: 999 }))
    c.createBook(book({ title: 'Abbey Road', mediaType: 'music', tracks: '1. Come Together\n2. Something' }))
    expect(c.listBooks({ mediaType: 'film' }).map((x) => x.title)).toEqual(['Matrix'])
    expect(c.listBooks({ text: 'something' }).map((x) => x.title)).toEqual(['Abbey Road'])
    expect(c.stats().byMedia).toEqual({ book: 1, film: 1, music: 1 })
    const s = c.statistics()
    expect(s.pagesRead).toBe(300) // Filme zählen nicht als gelesene Seiten
    expect(s.byMedia.map((r) => [r.key, r.count])).toEqual([
      ['book', 1],
      ['film', 1],
      ['music', 1]
    ])
    c.bulkUpdate([a.id], { mediaType: 'comic' })
    expect(c.getBook(a.id)!.mediaType).toBe('comic')
    // Unbekannte Art wird abgelehnt bzw. auf Buch gesetzt
    expect(c.createBook(book({ title: 'X', mediaType: 'vhs' as never })).mediaType).toBe('book')
  })
})

describe('MusicBrainz', () => {
  const release = {
    id: 'b84ee12a-09ef-421b-82de-0441a926375b',
    title: 'Abbey Road',
    date: '1969-09-26',
    'artist-credit': [{ name: 'The Beatles', joinphrase: '' }],
    'label-info': [{ label: { name: 'Apple Records' } }],
    'text-representation': { language: 'eng' },
    'release-group': { 'primary-type': 'Album', 'secondary-types': [] },
    'cover-art-archive': { front: true },
    media: [
      {
        format: 'CD',
        tracks: [
          { number: '1', title: 'Come Together', length: 259000 },
          { number: '2', title: 'Something', length: 182000 }
        ]
      }
    ]
  }

  it('bildet eine Veröffentlichung ab', () => {
    const r = mbReleaseToBook(release)!
    expect(r.data).toMatchObject({
      mediaType: 'music',
      title: 'Abbey Road',
      authors: 'The Beatles',
      publisher: 'Apple Records',
      year: '1969',
      binding: 'CD',
      duration: 7,
      tracks: '1. Come Together (4:19)\n2. Something (3:02)',
      keywords: 'Album'
    })
    expect(r.coverUrl).toBe(
      'https://coverartarchive.org/release/b84ee12a-09ef-421b-82de-0441a926375b/front-500'
    )
  })

  it('markiert mehrere Medien und liefert Suchtreffer', () => {
    const two = {
      ...release,
      media: [release.media[0], { format: '12" Vinyl', tracks: [{ number: 'A1', title: 'X' }] }]
    }
    const r = mbReleaseToBook(two)!
    expect(r.data.binding).toBe('2× CD + LP')
    expect(r.data.tracks).toContain('— CD 1 —')
    const hits = mbSearchToHits({ releases: [{ ...release, country: 'GB' }] })
    expect(hits[0]).toMatchObject({
      source: 'musicbrainz',
      title: 'Abbey Road',
      year: '1969',
      mediaType: 'music'
    })
    expect(hits[0].detail).toBe('The Beatles · CD · GB')
  })
})

describe('TMDb', () => {
  it('Film mit Regie, Darstellern, FSK und Poster', () => {
    const r = tmdbToBook('movie', {
      id: 603,
      title: 'Matrix',
      original_title: 'The Matrix',
      release_date: '1999-03-30',
      runtime: 136,
      original_language: 'en',
      overview: 'Ein Hacker …',
      poster_path: '/abc.jpg',
      genres: [{ name: 'Action' }, { name: 'Science Fiction' }],
      production_companies: [{ name: 'Warner Bros.' }],
      belongs_to_collection: { name: 'Matrix Filmreihe' },
      credits: {
        cast: [{ name: 'Keanu Reeves' }, { name: 'Carrie-Anne Moss' }],
        crew: [
          { job: 'Director', name: 'Lana Wachowski' },
          { job: 'Director', name: 'Lilly Wachowski' },
          { job: 'Producer', name: 'Joel Silver' }
        ]
      },
      release_dates: {
        results: [{ iso_3166_1: 'DE', release_dates: [{ certification: '' }, { certification: '16' }] }]
      }
    })!
    expect(r.data).toMatchObject({
      mediaType: 'film',
      title: 'Matrix',
      subtitle: 'The Matrix',
      authors: 'Lana Wachowski; Lilly Wachowski',
      contributors: 'Keanu Reeves; Carrie-Anne Moss',
      publisher: 'Warner Bros.',
      year: '1999',
      duration: 136,
      ageRating: 'FSK 16',
      keywords: 'Action, Science Fiction',
      series: 'Matrix Filmreihe'
    })
    expect(r.coverUrl).toBe('https://image.tmdb.org/t/p/w500/abc.jpg')
  })

  it('Serie und Suchtreffer', () => {
    const r = tmdbToBook('tv', {
      id: 1399,
      name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      created_by: [{ name: 'David Benioff' }],
      networks: [{ name: 'HBO' }],
      episode_run_time: [60],
      content_ratings: { results: [{ iso_3166_1: 'DE', rating: '16' }] }
    })!
    expect(r.data).toMatchObject({
      title: 'Game of Thrones',
      authors: 'David Benioff',
      duration: 60,
      ageRating: 'FSK 16',
      series: 'Game of Thrones'
    })
    const hits = tmdbSearchToHits({
      results: [
        {
          media_type: 'movie',
          id: 603,
          title: 'Matrix',
          original_title: 'The Matrix',
          release_date: '1999-03-30',
          poster_path: '/a.jpg'
        },
        { media_type: 'person', id: 6384, name: 'Keanu Reeves' },
        {
          media_type: 'tv',
          id: 1399,
          name: 'Game of Thrones',
          original_name: 'Game of Thrones',
          first_air_date: '2011-04-17'
        }
      ]
    })
    expect(hits.map((h) => h.id)).toEqual(['movie:603', 'tv:1399'])
    expect(hits[0]).toMatchObject({
      detail: 'Film · The Matrix',
      imageUrl: 'https://image.tmdb.org/t/p/w185/a.jpg'
    })
    expect(hits[1].detail).toBe('Serie')
  })
})

describe('Wikidata', () => {
  const ref = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } })
  const film = {
    id: 'Q83495',
    labels: { de: { value: 'Matrix' }, en: { value: 'The Matrix' } },
    descriptions: { de: { value: 'Film von 1999' } },
    claims: {
      P31: [ref('Q11424')],
      P577: [{ mainsnak: { datavalue: { value: { time: '+1999-03-31T00:00:00Z' } } } }],
      P57: [ref('Q9545711'), ref('Q9544977')],
      P161: [ref('Q43416')],
      P272: [ref('Q126399')],
      P2047: [
        {
          mainsnak: { datavalue: { value: { amount: '+136', unit: 'http://www.wikidata.org/entity/Q7727' } } }
        }
      ],
      P1981: [ref('Q20660629')],
      P3383: [{ mainsnak: { datavalue: { value: 'The Matrix Poster.jpg' } } }]
    }
  }
  const names = {
    Q9545711: 'Lana Wachowski',
    Q9544977: 'Lilly Wachowski',
    Q43416: 'Keanu Reeves',
    Q126399: 'Warner Bros.',
    Q20660629: 'FSK 16'
  }

  it('erkennt die Art und bildet einen Film ab', () => {
    expect(wdTypeOf(film)).toBe('film')
    const r = wdToBook(film, names, 'de')!
    expect(r.data).toMatchObject({
      mediaType: 'film',
      title: 'Matrix',
      year: '1999',
      authors: 'Lana Wachowski; Lilly Wachowski',
      contributors: 'Keanu Reeves',
      publisher: 'Warner Bros.',
      duration: 136,
      ageRating: 'FSK 16'
    })
    expect(r.coverUrl).toContain('Special:FilePath/The%20Matrix%20Poster.jpg')
  })

  it('bildet Spiele ab und filtert Suchtreffer nach Art', () => {
    const game = {
      id: 'Q17097',
      labels: { de: { value: 'Die Siedler von Catan' } },
      claims: {
        P31: [ref('Q131436')],
        P178: [ref('Q1')],
        P123: [ref('Q2')],
        P1872: [{ mainsnak: { datavalue: { value: { amount: '+3' } } } }],
        P1873: [{ mainsnak: { datavalue: { value: { amount: '+4' } } } }]
      }
    }
    const r = wdToBook(game, { Q1: 'Klaus Teuber', Q2: 'Kosmos' }, 'de')!
    expect(r.data).toMatchObject({
      mediaType: 'game',
      authors: 'Klaus Teuber',
      publisher: 'Kosmos',
      players: '3–4'
    })
    const hits = wdEntitiesToHits({ Q83495: film, Q17097: game }, ['Q83495', 'Q17097'], 'game', 'de')
    expect(hits.map((h) => h.id)).toEqual(['Q17097'])
    expect(wdTypeOf({ claims: { P31: [ref('Q5')] } })).toBeNull()
  })
})

describe('Robustheit', () => {
  it('legt Einträge mit fehlenden Feldern an', () => {
    const c = new Catalog(':memory:')
    const b = c.createBook({ title: 'Nur Titel', mediaType: 'periodical' } as BookInput)
    expect(b).toMatchObject({ title: 'Nur Titel', mediaType: 'periodical', authors: '', copies: 1 })
  })
})
