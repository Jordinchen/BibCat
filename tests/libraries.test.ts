import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DB_FILE, folderName, freeFolder, libraryDirFrom, Profile, samePath } from '../src/main/libraries'

const tmp = () => mkdtempSync(join(tmpdir(), 'bibcraft-'))

describe('Profil mit Bibliotheksliste', () => {
  it('merkt sich Bibliotheken, aktuelle Auswahl und Sprache dauerhaft', () => {
    const dir = tmp()
    const file = join(dir, 'profile.json')
    const p = new Profile(file)
    expect(p.libraries).toEqual([])
    p.upsert(join(dir, 'A'), 'Privat')
    p.upsert(join(dir, 'B'), 'Verein')
    p.upsert(join(dir, 'A') + '/', 'Zuhause') // gleicher Ordner, neuer Name
    p.setCurrent(join(dir, 'B'))
    p.setLanguage('en')

    const again = new Profile(file)
    expect(again.libraries.map((l) => l.name)).toEqual(['Zuhause', 'Verein'])
    expect(samePath(again.current!, join(dir, 'B'))).toBe(true)
    expect(again.language).toBe('en')

    again.forget(join(dir, 'B'))
    expect(again.current).toBeNull()
    expect(new Profile(file).libraries).toHaveLength(1)
  })

  it('übersteht eine beschädigte Profildatei', () => {
    const file = join(tmp(), 'profile.json')
    writeFileSync(file, '{ kaputt')
    const p = new Profile(file)
    expect(p.libraries).toEqual([])
    p.upsert('/x', 'X')
    expect(JSON.parse(readFileSync(file, 'utf8')).libraries).toHaveLength(1)
  })
})

describe('Ordnernamen', () => {
  it('macht Namen dateisystemtauglich', () => {
    expect(folderName('  Bücher: Privat/Alt?  ')).toBe('Bücher PrivatAlt')
    expect(folderName('Ende...')).toBe('Ende')
    expect(folderName('***')).toBe('Bibliothek')
  })

  it('findet einen freien Ordner', () => {
    const parent = tmp()
    expect(freeFolder(parent, 'Verein')).toBe(join(parent, 'Verein'))
    mkdirSync(join(parent, 'Verein'))
    mkdirSync(join(parent, 'Verein 2'))
    expect(freeFolder(parent, 'Verein')).toBe(join(parent, 'Verein 3'))
  })

  it('erkennt Bibliotheksordner und Datenbankdateien', () => {
    const dir = tmp()
    expect(libraryDirFrom(dir)).toBeNull()
    writeFileSync(join(dir, DB_FILE), '')
    expect(libraryDirFrom(dir)).toBe(dir)
    expect(libraryDirFrom(join(dir, DB_FILE))).toBe(dir)
  })
})
