import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { Lang } from '@shared/i18n'

export const DB_FILE = 'katalog.sqlite'

export interface LibraryEntry {
  path: string
  name: string
}

interface ProfileData {
  version: 1
  current: string | null
  libraries: LibraryEntry[]
  language?: Lang
}

/** Ordnerpfade vergleichbar machen (Windows/macOS unterscheiden Groß-/Kleinschreibung nicht) */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    const r = resolve(p).replace(/[\\/]+$/, '')
    return process.platform === 'linux' ? r : r.toLowerCase()
  }
  return norm(a) === norm(b)
}

/** Aus einem Namen einen sicheren Ordnernamen machen */
export function folderName(name: string): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  return cleaned.slice(0, 60) || 'Bibliothek'
}

/** Freien Ordner unterhalb von `parent` finden: „Name", „Name 2", „Name 3" … */
export function freeFolder(parent: string, name: string): string {
  const base = folderName(name)
  let candidate = join(parent, base)
  for (let i = 2; existsSync(candidate); i++) candidate = join(parent, `${base} ${i}`)
  return candidate
}

/** Akzeptiert einen Bibliotheksordner oder direkt die Datenbankdatei darin. */
export function libraryDirFrom(picked: string): string | null {
  if (picked.toLowerCase().endsWith('.sqlite')) return existsSync(picked) ? dirname(picked) : null
  return existsSync(join(picked, DB_FILE)) ? picked : null
}

/**
 * Programmweite Einstellungen: Liste der bekannten Bibliotheken, zuletzt geöffnete
 * Bibliothek und Sprache. Gespeichert als JSON im Benutzerprofil von BibCraft.
 */
export class Profile {
  private data: ProfileData

  constructor(private readonly file: string) {
    this.data = { version: 1, current: null, libraries: [] }
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<ProfileData>
      if (Array.isArray(raw.libraries)) {
        this.data.libraries = raw.libraries.filter(
          (l) => typeof l?.path === 'string' && typeof l?.name === 'string'
        )
      }
      if (typeof raw.current === 'string') this.data.current = raw.current
      if (raw.language === 'de' || raw.language === 'en') this.data.language = raw.language
    } catch {
      /* erste Nutzung oder beschädigte Datei: mit leerem Profil beginnen */
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    // Erst in eine Hilfsdatei schreiben, dann umbenennen – so bleibt die Datei bei einem Absturz heil
    const tmp = this.file + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  get libraries(): LibraryEntry[] {
    return this.data.libraries.map((l) => ({ ...l }))
  }

  get current(): string | null {
    return this.data.current
  }

  get language(): Lang | undefined {
    return this.data.language
  }

  setLanguage(lang: Lang): void {
    this.data.language = lang
    this.save()
  }

  find(path: string): LibraryEntry | undefined {
    return this.data.libraries.find((l) => samePath(l.path, path))
  }

  /** Bibliothek aufnehmen oder ihren Namen aktualisieren */
  upsert(path: string, name: string): void {
    const existing = this.find(path)
    if (existing) existing.name = name
    else this.data.libraries.push({ path: resolve(path), name })
    this.save()
  }

  setCurrent(path: string): void {
    const entry = this.find(path)
    this.data.current = entry ? entry.path : resolve(path)
    this.save()
  }

  /** Aus der Liste entfernen (Dateien bleiben unangetastet) */
  forget(path: string): void {
    this.data.libraries = this.data.libraries.filter((l) => !samePath(l.path, path))
    if (this.data.current && samePath(this.data.current, path)) this.data.current = null
    this.save()
  }
}
