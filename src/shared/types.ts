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

/** Sammeländerung für mehrere Bücher; nicht gesetzte Felder bleiben unverändert */
export interface BulkPatch {
  locationId?: number | null
  subjectId?: number | null
  readStatus?: ReadStatus
  rating?: number
  addKeywords?: string[]
  removeKeywords?: string[]
  /** Exemplare erhöhen/verringern (nie unter 0) */
  copiesDelta?: number
}

export interface CountRow {
  /** Schlüssel: Fachgebiets-/Standort-ID, Jahr, Monat, Sprache, Autor … (null = ohne Angabe) */
  key: string | number | null
  label: string
  count: number
  color?: string
}

export interface Statistics {
  total: number
  copies: number
  pagesRead: number
  avgRating: number | null
  ratedCount: number
  addedThisYear: number
  readThisYear: number
  byStatus: Record<ReadStatus, number>
  bySubject: CountRow[]
  byLocation: CountRow[]
  /** Gelesen pro Jahr (nach Lesedatum), lückenlos */
  readByYear: CountRow[]
  /** Erfasst pro Monat, letzte 12 Monate, lückenlos */
  addedByMonth: CountRow[]
  /** Erscheinungsjahr nach Jahrzehnt */
  byDecade: CountRow[]
  topAuthors: CountRow[]
  byLanguage: CountRow[]
  /** Anzahl Bücher mit 1–5 Sternen (Index 0 = 1 Stern) */
  ratings: number[]
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
  /** Die geöffnete Bibliothek */
  library: LibraryInfo
  /** Name der Ersatzbibliothek, wenn die zuletzt geöffnete fehlte */
  libraryFallback: string | null
}

export type UpdateStatus = 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdateState {
  status: UpdateStatus
  /** Version des gefundenen Updates */
  version?: string
  /** Fortschritt beim Herunterladen in Prozent */
  percent?: number
  /** Fehlermeldung (nur bei status = 'error') */
  error?: string
  /** true: BibCraft lädt und installiert selbst (Windows); false: nur Hinweis mit Download-Link */
  canInstall: boolean
  /** true, wenn die Prüfung vom Benutzer angestoßen wurde (dann auch „aktuell" und Fehler melden) */
  manual: boolean
  /** Automatische Suche beim Start eingeschaltet */
  auto: boolean
  /** Seite mit allen Versionen und Neuerungen */
  releasesUrl: string
}

export interface LibraryInfo {
  path: string
  name: string
  current: boolean
  /** false, wenn der Ordner (z. B. ein nicht verbundenes Laufwerk) fehlt */
  exists: boolean
}

export interface BibCraftApi {
  app: {
    info(): Promise<AppInfo>
    setLanguage(lang: import('./i18n').Lang): Promise<void>
  }
  updates: {
    state(): Promise<UpdateState>
    check(): Promise<void>
    /** BibCraft beenden und das heruntergeladene Update installieren */
    install(): Promise<void>
    /** Download-Seite im Browser öffnen */
    openReleases(): Promise<void>
    setAuto(on: boolean): Promise<void>
    /** Meldet jede Statusänderung; gibt eine Abmeldefunktion zurück */
    onState(cb: (s: UpdateState) => void): () => void
  }
  libraries: {
    list(): Promise<LibraryInfo[]>
    /** Neue Bibliothek anlegen; ohne `parentDir` im BibCraft-Datenordner */
    create(name: string, parentDir?: string | null): Promise<LibraryInfo>
    /** Ordnerauswahl für den Speicherort einer neuen Bibliothek */
    pickLocation(): Promise<string | null>
    /** Bestehende Bibliothek per Ordnerauswahl einbinden */
    openDialog(): Promise<LibraryInfo | null>
    /** Bibliothek wechseln; die Oberfläche lädt danach neu */
    switchTo(path: string): Promise<void>
    rename(path: string, name: string): Promise<void>
    forget(path: string): Promise<void>
    reveal(path: string): Promise<void>
  }
  books: {
    list(q: BookQuery): Promise<Book[]>
    get(id: number): Promise<Book | null>
    create(b: BookInput): Promise<Book>
    update(id: number, b: BookInput): Promise<Book>
    remove(id: number): Promise<void>
    findByIsbn(isbn: string): Promise<Book | null>
    stats(): Promise<Stats>
    statistics(): Promise<Statistics>
    bulkUpdate(ids: number[], patch: BulkPatch): Promise<number>
    removeMany(ids: number[]): Promise<void>
    /** Stellt Bücher exakt im übergebenen Zustand wieder her (Rückgängig) */
    restore(books: Book[]): Promise<void>
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
