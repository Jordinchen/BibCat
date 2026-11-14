import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { googleToBook, marcToBook, openLibraryToBook, parseMarcXml } from '../src/main/lookup'
import { mergeResults } from '@shared/merge'

describe('DNB MARC21', () => {
  const xml = readFileSync(join(__dirname, 'fixtures/dnb-marc.xml'), 'utf8')

  it('bildet die wichtigsten Felder ab', () => {
    const b = marcToBook(parseMarcXml(xml))!
    expect(b.title).toBe('Die Vermessung der Welt')
    expect(b.subtitle).toBe('Roman')
    expect(b.authors).toBe('Kehlmann, Daniel')
    expect(b.contributors).toBe('Muster, Erika (Illustrator)')
    expect(b.place).toBe('Reinbek bei Hamburg')
    expect(b.publisher).toBe('Rowohlt')
    expect(b.year).toBe('2005')
    expect(b.edition).toBe('12. Aufl.')
    expect(b.pages).toBe(302)
    expect(b.series).toBe('rororo')
    expect(b.seriesNumber).toBe('24100')
    expect(b.language).toBe('ger')
    expect(b.binding).toBeUndefined()
    expect(b.keywords).toBe('Gauß, Carl Friedrich, Humboldt, Alexander von')
  })

  it('liefert null ohne Datensatz', () => {
    expect(marcToBook(parseMarcXml('<searchRetrieveResponse/>'))).toBeNull()
  })
})

describe('Open Library / Google Books', () => {
  it('Open Library', () => {
    const r = openLibraryToBook(
      {
        'ISBN:9780306406157': {
          title: 'Example',
          authors: [{ name: 'Jane Doe' }, { name: 'John Roe' }],
          publishers: [{ name: 'Plenum' }],
          publish_date: 'March 1985',
          number_of_pages: 210,
          cover: { large: 'https://covers.openlibrary.org/b/id/1-L.jpg' }
        }
      },
      '9780306406157'
    )!
    expect(r.data).toMatchObject({
      title: 'Example',
      authors: 'Jane Doe; John Roe',
      year: '1985',
      pages: 210
    })
    expect(r.coverUrl).toContain('covers.openlibrary.org')
  })

  it('Google Books', () => {
    const r = googleToBook({
      items: [
        {
          volumeInfo: {
            title: 'Beispiel',
            authors: ['A. Autor'],
            publishedDate: '2019-04-01',
            language: 'de',
            imageLinks: { thumbnail: 'http://books.google.com/x?id=1&edge=curl' }
          }
        }
      ]
    })!
    expect(r.data).toMatchObject({ title: 'Beispiel', year: '2019', language: 'de' })
    expect(r.coverUrl).toBe('https://books.google.com/x?id=1')
    expect(googleToBook({ totalItems: 0 })).toBeNull()
  })

  it('führt Treffer zusammen, erste Quelle hat Vorrang', () => {
    const m = mergeResults([
      { source: 'A', data: { title: 'Erst', publisher: '' } },
      { source: 'B', data: { title: 'Zweit', publisher: 'Verlag', pages: 100 } }
    ])
    expect(m).toEqual({ title: 'Erst', publisher: 'Verlag', pages: 100 })
  })
})
