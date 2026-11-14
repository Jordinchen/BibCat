import { describe, expect, it } from 'vitest'
import { cleanIsbn, isbn10to13, isbn13to10, isValidIsbn, toIsbn13 } from '@shared/isbn'

describe('ISBN', () => {
  it('bereinigt Eingaben', () => {
    expect(cleanIsbn('978-3-16-148410-0')).toBe('9783161484100')
    expect(cleanIsbn(' 3-499-13599-x ')).toBe('349913599X')
  })

  it('prüft ISBN-10 und ISBN-13', () => {
    expect(isValidIsbn('978-3-16-148410-0')).toBe(true)
    expect(isValidIsbn('978-3-16-148410-1')).toBe(false)
    expect(isValidIsbn('3-499-13599-X')).toBe(true)
    expect(isValidIsbn('0-306-40615-2')).toBe(true)
    expect(isValidIsbn('0-306-40615-3')).toBe(false)
    expect(isValidIsbn('123')).toBe(false)
  })

  it('wandelt zwischen ISBN-10 und ISBN-13 um', () => {
    expect(isbn10to13('0306406152')).toBe('9780306406157')
    expect(isbn13to10('9780306406157')).toBe('0306406152')
    expect(isbn13to10('9783499135996')).toBe('349913599X')
    expect(isbn13to10('9791234567896')).toBeNull()
    expect(toIsbn13('3-499-13599-X')).toBe('9783499135996')
    expect(toIsbn13('kein isbn')).toBeNull()
  })
})
