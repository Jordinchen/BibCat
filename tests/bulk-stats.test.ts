import { beforeEach, describe, expect, it } from 'vitest'
import { Catalog } from '../src/main/db'
import { EMPTY_BOOK, type BookInput } from '@shared/types'

const book = (p: Partial<BookInput>): BookInput => ({ ...EMPTY_BOOK, ...p })

describe('Massenbearbeitung', () => {
  let c: Catalog
  beforeEach(() => {
    c = new Catalog(':memory:')
  })

  it('setzt nur übergebene Felder und pflegt Schlagworte', () => {
    const shelf = c.saveLocation({ name: 'Regal', parentId: null })
    const a = c.createBook(book({ title: 'A', keywords: 'Roman, Alt', rating: 2, notes: 'bleibt' }))
    const b = c.createBook(book({ title: 'B', keywords: 'roman' }))
    const n = c.bulkUpdate([a.id, b.id], {
      locationId: shelf.id,
      readStatus: 'read',
      addKeywords: ['Klassiker', 'ROMAN'],
      removeKeywords: ['alt'],
      copiesDelta: 1
    })
    expect(n).toBe(2)
    const a2 = c.getBook(a.id)!
    expect(a2.locationId).toBe(shelf.id)
    expect(a2.readStatus).toBe('read')
    expect(a2.readDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(a2.keywords).toBe('Roman, Klassiker')
    expect(a2.rating).toBe(2)
    expect(a2.notes).toBe('bleibt')
    expect(a2.copies).toBe(2)
    expect(c.getBook(b.id)!.keywords).toBe('roman, Klassiker')
    // Feld explizit leeren
    c.bulkUpdate([a.id], { locationId: null })
    expect(c.getBook(a.id)!.locationId).toBeNull()
  })

  it('macht Änderungen und Löschungen rückgängig, inkl. Volltextindex', () => {
    const a = c.createBook(book({ title: 'Faust', authors: 'Goethe' }))
    const b = c.createBook(book({ title: 'Werther', authors: 'Goethe' }))
    const before = [c.getBook(a.id)!, c.getBook(b.id)!]
    c.bulkUpdate([a.id, b.id], { rating: 5, addKeywords: ['Sturm'] })
    c.restoreBooks(before)
    expect(c.getBook(a.id)).toEqual(before[0])
    expect(c.listBooks({ text: 'sturm' })).toHaveLength(0)

    c.deleteBooks([a.id, b.id])
    expect(c.listBooks()).toHaveLength(0)
    c.restoreBooks(before)
    expect(c.listBooks().map((x) => x.id)).toEqual([a.id, b.id])
    expect(c.listBooks({ text: 'goethe' })).toHaveLength(2)
  })

  it('bricht bei Fehler komplett ab', () => {
    const a = c.createBook(book({ title: 'A' }))
    expect(() => c.bulkUpdate([a.id], { locationId: 999 })).toThrow()
    expect(c.getBook(a.id)!.locationId).toBeNull()
  })
})

describe('Statistik', () => {
  it('wertet den Bestand aus', () => {
    const c = new Catalog(':memory:')
    const now = new Date()
    const y = now.getFullYear()
    const room = c.saveLocation({ name: 'Büro', parentId: null })
    const shelf = c.saveLocation({ name: 'Regal 1', parentId: room.id })
    const phil = c.saveSubject({ name: 'Philosophie', notation: '100', color: '#7c3aed' })
    c.createBook(
      book({
        title: 'A',
        authors: 'Kant, Immanuel',
        year: '1781',
        subjectId: phil.id,
        locationId: shelf.id,
        readStatus: 'read',
        readDate: `${y - 2}-05-01`,
        pages: 800,
        rating: 5,
        language: 'ger',
        copies: 2
      })
    )
    c.createBook(
      book({
        title: 'B',
        authors: 'Kant, Immanuel; Hume, David',
        year: 'ca. 1790',
        subjectId: phil.id,
        locationId: room.id,
        readStatus: 'read',
        readDate: `${y}-02-01`,
        pages: 200,
        rating: 3,
        language: 'GER'
      })
    )
    c.createBook(
      book({ title: 'C', authors: 'Hume, David', year: '', readStatus: 'unread', language: 'eng' })
    )
    const s = c.statistics(now)
    expect(s).toMatchObject({
      total: 3,
      copies: 4,
      pagesRead: 1000,
      ratedCount: 2,
      avgRating: 4,
      addedThisYear: 3,
      readThisYear: 1
    })
    expect(s.byStatus).toEqual({ unread: 1, reading: 0, read: 2, abandoned: 0 })
    expect(s.bySubject).toEqual([
      { key: phil.id, label: 'Philosophie', count: 2, color: '#7c3aed' },
      { key: null, label: '', count: 1, color: undefined }
    ])
    expect(s.byLocation).toEqual([
      { key: room.id, label: 'Büro', count: 2 },
      { key: null, label: '', count: 1 }
    ])
    expect(s.readByYear.map((r) => [r.label, r.count])).toEqual([
      [`${y - 2}`, 1],
      [`${y - 1}`, 0],
      [`${y}`, 1]
    ])
    expect(s.addedByMonth).toHaveLength(12)
    expect(s.addedByMonth[11]).toMatchObject({ count: 3 })
    expect(s.addedByMonth[0].count).toBe(0)
    expect(s.byDecade.map((r) => [r.key, r.count])).toEqual([
      [1780, 1],
      [1790, 1]
    ])
    expect(s.topAuthors.slice(0, 2).map((r) => [r.label, r.count])).toEqual([
      ['Hume, David', 2],
      ['Kant, Immanuel', 2]
    ])
    expect(s.byLanguage.map((r) => [r.label, r.count])).toEqual([
      ['ger', 2],
      ['eng', 1]
    ])
    expect(s.ratings).toEqual([0, 0, 1, 0, 1])
  })

  it('funktioniert mit leerem Katalog', () => {
    const s = new Catalog(':memory:').statistics()
    expect(s.total).toBe(0)
    expect(s.avgRating).toBeNull()
    expect(s.readByYear).toEqual([])
    expect(s.bySubject).toEqual([])
  })
})
