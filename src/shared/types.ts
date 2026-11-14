export type ReadStatus = 'unread' | 'reading' | 'read' | 'abandoned'

export const READ_STATUSES: ReadStatus[] = ['unread', 'reading', 'read', 'abandoned']

export interface Book {
  id: number
  title: string
  subtitle: string
  /** Mehrere Personen mit Semikolon getrennt, je "Nachname, Vorname" */
  authors: string
  /** Herausgeber, Übersetzer usw. */
  contributors: string
  publisher: string
  place: string
  year: string
  edition: string
  isbn: string
  language: string
  pages: number | null
  binding: string
  series: string
  seriesNumber: string
  subjectId: number | null
  /** Schlagworte, kommagetrennt */
  keywords: string
  /** Signatur */
  callNumber: string
  locationId: number | null
  copies: number
  description: string
  notes: string
  rating: number
  readStatus: ReadStatus
  readDate: string
  acquiredDate: string
  coverFile: string
  createdAt: string
  updatedAt: string
}

export type BookInput = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>

export const EMPTY_BOOK: BookInput = {
  title: '',
  subtitle: '',
  authors: '',
  contributors: '',
  publisher: '',
  place: '',
  year: '',
  edition: '',
  isbn: '',
  language: '',
  pages: null,
  binding: '',
  series: '',
  seriesNumber: '',
  subjectId: null,
  keywords: '',
  callNumber: '',
  locationId: null,
  copies: 1,
  description: '',
  notes: '',
  rating: 0,
  readStatus: 'unread',
  readDate: '',
  acquiredDate: '',
  coverFile: ''
}

/** Fachgebiet, optional mit Notation einer Systematik (z. B. DDC "500") */
export interface Subject {
  id: number
  name: string
  notation: string
  color: string
  bookCount: number
}

/** Standort, hierarchisch: Raum > Regal > Fach */
export interface Location {
  id: number
  name: string
  parentId: number | null
  bookCount: number
}

export type SortField = 'title' | 'authors' | 'year' | 'createdAt' | 'rating' | 'callNumber'

export interface BookQuery {
  text?: string
  subjectId?: number | null
  /** Schließt untergeordnete Standorte ein */
  locationId?: number | null
  readStatus?: ReadStatus | null
  minRating?: number
  sort?: SortField
  desc?: boolean
}

export interface Stats {
  total: number
  copies: number
  byStatus: Record<ReadStatus, number>
}

/** Ergebnis einer ISBN-Abfrage, bereits auf unsere Felder abgebildet */
export interface IsbnResult {
  source: string
  data: Partial<BookInput>
  coverUrl?: string
}

export interface AppInfo {
  version: string
  platform: string
  language: import('./i18n').Lang
  dataDir: string
  /** true, wenn beim Start ein Katalog aus BibCat übernommen wurde */
  migratedFromBibCat: boolean
}

export interface BibCraftApi {
  app: {
    info(): Promise<AppInfo>
    setLanguage(lang: import('./i18n').Lang): Promise<void>
  }
  books: {
    list(q: BookQuery): Promise<Book[]>
    get(id: number): Promise<Book | null>
    create(b: BookInput): Promise<Book>
    update(id: number, b: BookInput): Promise<Book>
    remove(id: number): Promise<void>
    findByIsbn(isbn: string): Promise<Book | null>
    stats(): Promise<Stats>
  }
  subjects: {
    list(): Promise<Subject[]>
    save(s: { id?: number; name: string; notation: string; color: string }): Promise<Subject>
    remove(id: number): Promise<void>
  }
  locations: {
    list(): Promise<Location[]>
    save(l: { id?: number; name: string; parentId: number | null }): Promise<Location>
    remove(id: number): Promise<void>
  }
  isbn: {
    lookup(isbn: string): Promise<IsbnResult[]>
  }
  covers: {
    /** Lädt ein Cover herunter und gibt den gespeicherten Dateinamen zurück */
    download(url: string): Promise<string>
    /** Öffnet einen Dateidialog und übernimmt ein lokales Bild */
    pick(): Promise<string | null>
  }
  data: {
    exportCsv(): Promise<string | null>
    backup(): Promise<string | null>
    openFolder(): Promise<void>
  }
}
