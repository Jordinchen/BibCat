import { beforeEach, describe, expect, it } from 'vitest'
import { Catalog, toFtsQuery } from '../src/main/db'
import { EMPTY_BOOK, type BookInput } from '@shared/types'
import { booksToCsv } from '../src/main/csv'
import { translator } from '@shared/i18n'

const book = (p: Partial<BookInput>): BookInput => ({ ...EMPTY_BOOK, ...p })

describe('Catalog', () => {
  let c: Catalog
  beforeEach(() => {
    c = new Catalog(':memory:')
  })

  it('legt Bücher an und normalisiert ISBN und Bewertung', () => {
    const b = c.createBook(book({ title: '  Die Vermessung der Welt ', isbn: '3-499-13599-X', rating: 9 }))
    expect(b.id).toBeGreaterThan(0)
    expect(b.title).toBe('Die Vermessung der Welt')
    expect(b.isbn).toBe('9783499135996')
    expect(b.rating).toBe(5)
    expect(c.findByIsbn('978-3-499-13599-6')?.id).toBe(b.id)
    expect(c.findByIsbn('349913599X')?.id).toBe(b.id)
  })

  it('aktualisiert und löscht Bücher, Volltextindex bleibt konsistent', () => {
    const b = c.createBook(book({ title: 'Faust', authors: 'Goethe, Johann Wolfgang' }))
    expect(c.listBooks({ text: 'goethe' })).toHaveLength(1)
    c.updateBook(b.id, { ...b, authors: 'Schiller, Friedrich' })
    expect(c.listBooks({ text: 'goethe' })).toHaveLength(0)
    expect(c.listBooks({ text: 'schill' })).toHaveLength(1)
    c.deleteBook(b.id)
    expect(c.listBooks({ text: 'schill' })).toHaveLength(0)
  })

  it('findet mit Präfixen, mehreren Wörtern und ohne Umlaute', () => {
    c.createBook(
      book({ title: 'Über die Freiheit', authors: 'Mill, John Stuart', keywords: 'Liberalismus, Ethik' })
    )
    c.createBook(book({ title: 'Der Prozess', authors: 'Kafka, Franz', callNumber: 'LIT 830 KAF' }))
    expect(c.listBooks({ text: 'uber' })).toHaveLength(1)
    expect(c.listBooks({ text: 'mill frei' })).toHaveLength(1)
    expect(c.listBooks({ text: 'liberal' })).toHaveLength(1)
    expect(c.listBooks({ text: 'KAF' })).toHaveLength(1)
    expect(c.listBooks({ text: '"' })).toHaveLength(2)
    expect(toFtsQuery('a "b')).toBe('"a"* "b"*')
  })

  it('filtert Standorte einschließlich Unterorten', () => {
    const room = c.saveLocation({ name: 'Arbeitszimmer', parentId: null })
    const shelf = c.saveLocation({ name: 'Regal 1', parentId: room.id })
    const board = c.saveLocation({ name: 'Fach 3', parentId: shelf.id })
    const other = c.saveLocation({ name: 'Wohnzimmer', parentId: null })
    c.createBook(book({ title: 'A', locationId: board.id }))
    c.createBook(book({ title: 'B', locationId: shelf.id }))
    c.createBook(book({ title: 'C', locationId: other.id }))
    expect(c.listBooks({ locationId: room.id }).map((b) => b.title)).toEqual(['A', 'B'])
    expect(c.listBooks({ locationId: board.id }).map((b) => b.title)).toEqual(['A'])
  })

  it('speichert Einstellungen und meldet übersetzbare Fehler', () => {
    expect(c.getSetting('language')).toBeNull()
    c.setSetting('language', 'en')
    c.setSetting('language', 'de')
    expect(c.getSetting('language')).toBe('de')
    expect(() => c.saveSubject({ name: ' ', notation: '', color: '#000' })).toThrow('err.subjectName')
  })

  it('verhindert Kreise in der Standorthierarchie', () => {
    const room = c.saveLocation({ name: 'Raum', parentId: null })
    const shelf = c.saveLocation({ name: 'Regal', parentId: room.id })
    expect(() => c.saveLocation({ id: room.id, name: 'Raum', parentId: shelf.id })).toThrow()
    expect(() => c.saveLocation({ id: room.id, name: 'Raum', parentId: room.id })).toThrow()
  })

  it('löscht Standorte samt Unterorten; Bücher bleiben erhalten', () => {
    const room = c.saveLocation({ name: 'Raum', parentId: null })
    const shelf = c.saveLocation({ name: 'Regal', parentId: room.id })
    const b = c.createBook(book({ title: 'X', locationId: shelf.id }))
    c.deleteLocation(room.id)
    expect(c.listLocations()).toHaveLength(0)
    expect(c.getBook(b.id)?.locationId).toBeNull()
  })

  it('verwaltet Fachgebiete, Lesestatus und Statistik', () => {
    const s = c.saveSubject({ name: 'Philosophie', notation: '100', color: '#000' })
    c.createBook(book({ title: 'A', subjectId: s.id, readStatus: 'read', rating: 5, copies: 2 }))
    c.createBook(book({ title: 'B', readStatus: 'reading', rating: 3 }))
    expect(c.listSubjects()[0].bookCount).toBe(1)
    expect(c.listBooks({ subjectId: s.id })).toHaveLength(1)
    expect(c.listBooks({ readStatus: 'reading' })[0].title).toBe('B')
    expect(c.listBooks({ minRating: 4 })[0].title).toBe('A')
    expect(c.listBooks({ sort: 'rating', desc: true }).map((b) => b.title)).toEqual(['A', 'B'])
    expect(c.stats()).toEqual({
      total: 2,
      copies: 3,
      byStatus: { unread: 0, reading: 1, read: 1, abandoned: 0 }
    })
    c.deleteSubject(s.id)
    expect(c.listBooks({ text: 'A' })[0].subjectId).toBeNull()
  })

  it('exportiert CSV mit Standortpfad und Escaping', () => {
    const room = c.saveLocation({ name: 'Büro', parentId: null })
    const shelf = c.saveLocation({ name: 'Regal 2', parentId: room.id })
    c.createBook(book({ title: 'Titel; mit "Zeichen"', locationId: shelf.id }))
    const csv = booksToCsv(c.listBooks(), c.listSubjects(), c.listLocations(), translator('de'))
    expect(csv.startsWith('﻿Signatur;Titel')).toBe(true)
    expect(csv).toContain('"Titel; mit ""Zeichen"""')
    expect(csv).toContain('Büro › Regal 2')
    expect(csv).toContain(';Ungelesen;')
    const en = booksToCsv(c.listBooks(), c.listSubjects(), c.listLocations(), translator('en'))
    expect(en.startsWith('\uFEFFCall number;Title')).toBe(true)
    expect(en).toContain(';Unread;')
  })
})
