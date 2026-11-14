import { DatabaseSync } from 'node:sqlite'
import type { Book, BookInput, BookQuery, Location, ReadStatus, Stats, Subject } from '@shared/types'
import { cleanIsbn, toIsbn13 } from '@shared/isbn'
import { AppError } from '@shared/i18n'

type Row = Record<string, unknown>

/** Abbildung Feldname (camelCase) -> Spalte (snake_case) */
const BOOK_COLUMNS: Record<keyof BookInput, string> = {
  title: 'title',
  subtitle: 'subtitle',
  authors: 'authors',
  contributors: 'contributors',
  publisher: 'publisher',
  place: 'place',
  year: 'year',
  edition: 'edition',
  isbn: 'isbn',
  language: 'language',
  pages: 'pages',
  binding: 'binding',
  series: 'series',
  seriesNumber: 'series_number',
  subjectId: 'subject_id',
  keywords: 'keywords',
  callNumber: 'call_number',
  locationId: 'location_id',
  copies: 'copies',
  description: 'description',
  notes: 'notes',
  rating: 'rating',
  readStatus: 'read_status',
  readDate: 'read_date',
  acquiredDate: 'acquired_date',
  coverFile: 'cover_file'
}

const SORT_COLUMNS: Record<string, string> = {
  title: 'b.title COLLATE NOCASE',
  authors: 'b.authors COLLATE NOCASE',
  year: 'b.year',
  createdAt: 'b.created_at',
  rating: 'b.rating',
  callNumber: 'b.call_number COLLATE NOCASE'
}

const MIGRATIONS: string[] = [
  `
  CREATE TABLE subjects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    notation TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#6b7280'
  );
  CREATE TABLE locations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES locations(id) ON DELETE CASCADE
  );
  CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    authors TEXT NOT NULL DEFAULT '',
    contributors TEXT NOT NULL DEFAULT '',
    publisher TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '',
    edition TEXT NOT NULL DEFAULT '',
    isbn TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT '',
    pages INTEGER,
    binding TEXT NOT NULL DEFAULT '',
    series TEXT NOT NULL DEFAULT '',
    series_number TEXT NOT NULL DEFAULT '',
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    keywords TEXT NOT NULL DEFAULT '',
    call_number TEXT NOT NULL DEFAULT '',
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    read_status TEXT NOT NULL DEFAULT 'unread'
      CHECK (read_status IN ('unread','reading','read','abandoned')),
    read_date TEXT NOT NULL DEFAULT '',
    acquired_date TEXT NOT NULL DEFAULT '',
    cover_file TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE INDEX books_isbn ON books(isbn);
  CREATE INDEX books_subject ON books(subject_id);
  CREATE INDEX books_location ON books(location_id);

  CREATE VIRTUAL TABLE books_fts USING fts5(
    title, subtitle, authors, contributors, publisher, series, keywords,
    call_number, isbn, description, notes,
    content='books', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER books_ai AFTER INSERT ON books BEGIN
    INSERT INTO books_fts(rowid, title, subtitle, authors, contributors, publisher, series,
      keywords, call_number, isbn, description, notes)
    VALUES (new.id, new.title, new.subtitle, new.authors, new.contributors, new.publisher,
      new.series, new.keywords, new.call_number, new.isbn, new.description, new.notes);
  END;
  CREATE TRIGGER books_ad AFTER DELETE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, subtitle, authors, contributors, publisher,
      series, keywords, call_number, isbn, description, notes)
    VALUES ('delete', old.id, old.title, old.subtitle, old.authors, old.contributors,
      old.publisher, old.series, old.keywords, old.call_number, old.isbn, old.description, old.notes);
  END;
  CREATE TRIGGER books_au AFTER UPDATE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, subtitle, authors, contributors, publisher,
      series, keywords, call_number, isbn, description, notes)
    VALUES ('delete', old.id, old.title, old.subtitle, old.authors, old.contributors,
      old.publisher, old.series, old.keywords, old.call_number, old.isbn, old.description, old.notes);
    INSERT INTO books_fts(rowid, title, subtitle, authors, contributors, publisher, series,
      keywords, call_number, isbn, description, notes)
    VALUES (new.id, new.title, new.subtitle, new.authors, new.contributors, new.publisher,
      new.series, new.keywords, new.call_number, new.isbn, new.description, new.notes);
  END;
  `,
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `
]

function rowToBook(r: Row): Book {
  return {
    id: r.id as number,
    title: r.title as string,
    subtitle: r.subtitle as string,
    authors: r.authors as string,
    contributors: r.contributors as string,
    publisher: r.publisher as string,
    place: r.place as string,
    year: r.year as string,
    edition: r.edition as string,
    isbn: r.isbn as string,
    language: r.language as string,
    pages: (r.pages as number | null) ?? null,
    binding: r.binding as string,
    series: r.series as string,
    seriesNumber: r.series_number as string,
    subjectId: (r.subject_id as number | null) ?? null,
    keywords: r.keywords as string,
    callNumber: r.call_number as string,
    locationId: (r.location_id as number | null) ?? null,
    copies: r.copies as number,
    description: r.description as string,
    notes: r.notes as string,
    rating: r.rating as number,
    readStatus: r.read_status as ReadStatus,
    readDate: r.read_date as string,
    acquiredDate: r.acquired_date as string,
    coverFile: r.cover_file as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string
  }
}

/** Baut aus einer Benutzereingabe eine FTS5-Abfrage mit Präfixsuche je Wort. */
export function toFtsQuery(text: string): string {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/["]/g, '').trim())
    .filter(Boolean)
    .map((t) => `"${t}"*`)
    .join(' ')
}

export class Catalog {
  readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.migrate()
  }

  private migrate(): void {
    const { user_version } = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
    for (let v = user_version; v < MIGRATIONS.length; v++) {
      this.db.exec('BEGIN')
      try {
        this.db.exec(MIGRATIONS[v])
        this.db.exec(`PRAGMA user_version = ${v + 1}`)
        this.db.exec('COMMIT')
      } catch (e) {
        this.db.exec('ROLLBACK')
        throw e
      }
    }
  }

  close(): void {
    this.db.close()
  }

  // ---------- Bücher ----------

  private normalize(b: BookInput): BookInput {
    const isbn = cleanIsbn(b.isbn)
    return {
      ...b,
      title: b.title.trim(),
      isbn: toIsbn13(isbn) ?? isbn,
      rating: Math.max(0, Math.min(5, Math.round(b.rating || 0))),
      copies: Math.max(0, Math.round(b.copies ?? 1)),
      pages: b.pages ? Math.round(b.pages) : null
    }
  }

  private params(b: BookInput): Record<string, string | number | null> {
    const out: Record<string, string | number | null> = {}
    for (const [k, col] of Object.entries(BOOK_COLUMNS)) {
      const v = b[k as keyof BookInput]
      out[col] = v === undefined ? null : (v as string | number | null)
    }
    return out
  }

  listBooks(q: BookQuery = {}): Book[] {
    const where: string[] = []
    const args: Record<string, string | number> = {}

    if (q.text?.trim()) {
      const fts = toFtsQuery(q.text)
      if (fts) {
        where.push('b.id IN (SELECT rowid FROM books_fts WHERE books_fts MATCH $fts)')
        args.fts = fts
      }
    }
    if (q.subjectId) {
      where.push('b.subject_id = $subject')
      args.subject = q.subjectId
    }
    if (q.locationId) {
      where.push(`b.location_id IN (
        WITH RECURSIVE sub(id) AS (
          SELECT $loc UNION ALL SELECT l.id FROM locations l JOIN sub ON l.parent_id = sub.id
        ) SELECT id FROM sub)`)
      args.loc = q.locationId
    }
    if (q.readStatus) {
      where.push('b.read_status = $status')
      args.status = q.readStatus
    }
    if (q.minRating) {
      where.push('b.rating >= $rating')
      args.rating = q.minRating
    }

    const sort = SORT_COLUMNS[q.sort ?? 'title'] ?? SORT_COLUMNS.title
    const dir = q.desc ? 'DESC' : 'ASC'
    const sql = `SELECT b.* FROM books b
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${sort} ${dir}, b.title COLLATE NOCASE ASC`
    return (this.db.prepare(sql).all(args) as Row[]).map(rowToBook)
  }

  getBook(id: number): Book | null {
    const r = this.db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Row | undefined
    return r ? rowToBook(r) : null
  }

  findByIsbn(raw: string): Book | null {
    const cleaned = cleanIsbn(raw)
    const isbn = toIsbn13(cleaned) ?? cleaned
    if (!isbn) return null
    const r = this.db.prepare('SELECT * FROM books WHERE isbn = ? LIMIT 1').get(isbn) as Row | undefined
    return r ? rowToBook(r) : null
  }

  createBook(input: BookInput): Book {
    const p = this.params(this.normalize(input))
    const cols = Object.keys(p)
    const res = this.db
      .prepare(`INSERT INTO books (${cols.join(',')}) VALUES (${cols.map((c) => '$' + c).join(',')})`)
      .run(p)
    return this.getBook(Number(res.lastInsertRowid))!
  }

  updateBook(id: number, input: BookInput): Book {
    const p = this.params(this.normalize(input))
    const sets = Object.keys(p).map((c) => `${c} = $${c}`)
    this.db
      .prepare(
        `UPDATE books SET ${sets.join(', ')},
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = $id`
      )
      .run({ ...p, id })
    const b = this.getBook(id)
    if (!b) throw new AppError('err.bookNotFound')
    return b
  }

  deleteBook(id: number): void {
    this.db.prepare('DELETE FROM books WHERE id = ?').run(id)
  }

  stats(): Stats {
    const t = this.db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(copies),0) AS c FROM books').get() as {
      n: number
      c: number
    }
    const byStatus: Record<ReadStatus, number> = { unread: 0, reading: 0, read: 0, abandoned: 0 }
    for (const r of this.db
      .prepare('SELECT read_status AS s, COUNT(*) AS n FROM books GROUP BY read_status')
      .all() as { s: ReadStatus; n: number }[]) {
      byStatus[r.s] = r.n
    }
    return { total: t.n, copies: t.c, byStatus }
  }

  // ---------- Fachgebiete ----------

  listSubjects(): Subject[] {
    return this.db
      .prepare(
        `SELECT s.id, s.name, s.notation, s.color,
          (SELECT COUNT(*) FROM books b WHERE b.subject_id = s.id) AS bookCount
         FROM subjects s ORDER BY s.notation, s.name COLLATE NOCASE`
      )
      .all() as unknown as Subject[]
  }

  saveSubject(s: { id?: number; name: string; notation: string; color: string }): Subject {
    const name = s.name.trim()
    if (!name) throw new AppError('err.subjectName')
    let id = s.id
    if (id) {
      this.db
        .prepare('UPDATE subjects SET name = ?, notation = ?, color = ? WHERE id = ?')
        .run(name, s.notation.trim(), s.color, id)
    } else {
      id = Number(
        this.db
          .prepare('INSERT INTO subjects (name, notation, color) VALUES (?, ?, ?)')
          .run(name, s.notation.trim(), s.color).lastInsertRowid
      )
    }
    return this.listSubjects().find((x) => x.id === id)!
  }

  deleteSubject(id: number): void {
    this.db.prepare('DELETE FROM subjects WHERE id = ?').run(id)
  }

  // ---------- Standorte ----------

  listLocations(): Location[] {
    return this.db
      .prepare(
        `SELECT l.id, l.name, l.parent_id AS parentId,
          (SELECT COUNT(*) FROM books b WHERE b.location_id = l.id) AS bookCount
         FROM locations l ORDER BY l.name COLLATE NOCASE`
      )
      .all() as unknown as Location[]
  }

  saveLocation(l: { id?: number; name: string; parentId: number | null }): Location {
    const name = l.name.trim()
    if (!name) throw new AppError('err.locationName')
    let id = l.id
    if (id) {
      if (l.parentId && this.isDescendant(l.parentId, id)) {
        throw new AppError('err.locationCycle')
      }
      this.db.prepare('UPDATE locations SET name = ?, parent_id = ? WHERE id = ?').run(name, l.parentId, id)
    } else {
      id = Number(
        this.db.prepare('INSERT INTO locations (name, parent_id) VALUES (?, ?)').run(name, l.parentId)
          .lastInsertRowid
      )
    }
    return this.listLocations().find((x) => x.id === id)!
  }

  /** true, wenn `candidate` gleich `ancestor` ist oder darunter liegt */
  private isDescendant(candidate: number, ancestor: number): boolean {
    const r = this.db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
          SELECT ? UNION ALL SELECT l.id FROM locations l JOIN sub ON l.parent_id = sub.id
        ) SELECT 1 AS hit FROM sub WHERE id = ? LIMIT 1`
      )
      .get(ancestor, candidate)
    return !!r
  }

  deleteLocation(id: number): void {
    this.db.prepare('DELETE FROM locations WHERE id = ?').run(id)
  }

  // ---------- Einstellungen ----------

  getSetting(key: string): string | null {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return r?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }

  /** Erzeugt eine konsistente Kopie der Datenbank (für Backups). */
  backupTo(path: string): void {
    this.db.prepare('VACUUM INTO ?').run(path)
  }
}
