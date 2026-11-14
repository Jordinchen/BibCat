import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
  safeStorage,
  shell,
  systemPreferences,
  type IpcMainInvokeEvent
} from 'electron'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Catalog } from './db'
import { lookupIsbn, lookupIssn } from './lookup'
import { mediaDetails, musicByBarcode, searchMedia, tmdbCheckKey, Unreachable } from './media-lookup'
import { classifyCode, issnFromEan, isMediaType } from '@shared/media'
import { cleanIsbn } from '@shared/isbn'
import { booksToCsv } from './csv'
import { Updater } from './updater'
import { DB_FILE, folderName, freeFolder, libraryDirFrom, Profile, samePath } from './libraries'
import { AppError, isLang, langFromLocale, translator, type Lang } from '@shared/i18n'
import type { LibraryInfo } from '@shared/types'

protocol.registerSchemesAsPrivileged([
  { scheme: 'cover', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

// Eigenes Profil (z. B. für Tests oder portable Nutzung)
if (process.env.BIBCRAFT_PROFILE_DIR) app.setPath('userData', process.env.BIBCRAFT_PROFILE_DIR)

/** Farben der Titelleiste (müssen zu --titlebar in styles.css passen) */
const TITLEBAR = { color: '#F58092', symbolColor: '#3b0a17', height: 40 }

let profile: Profile
let updater: Updater
let catalog: Catalog
let coverDir: string
let dataDirPath: string
let libraryName = ''
let migratedFromBibCat = false
let libraryFallback: string | null = null
let mainWindow: BrowserWindow | null = null
let lang: Lang = 'de'
const t = (...a: Parameters<ReturnType<typeof translator>>) => translator(lang)(...a)

/** TMDb-Schlüssel aus dem Profil lesen (verschlüsselt, falls das System es anbietet) */
function tmdbKey(): string | null {
  const stored = profile.tmdbKey
  if (!stored) return null
  try {
    if (stored.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    if (stored.startsWith('plain:')) return stored.slice(6)
  } catch {
    /* Schlüssel nicht lesbar (z. B. anderes Benutzerkonto) – wie „nicht eingetragen" behandeln */
  }
  return null
}

function storeTmdbKey(key: string): boolean {
  if (!key) {
    profile.setTmdbKey(undefined)
    return true
  }
  const encrypted = safeStorage.isEncryptionAvailable()
  profile.setTmdbKey(encrypted ? 'enc:' + safeStorage.encryptString(key).toString('base64') : 'plain:' + key)
  return encrypted
}

const mediaCtx = () => ({ lang, tmdbKey: tmdbKey() })

/** Ordner, in dem BibCraft neue Bibliotheken standardmäßig anlegt */
const librariesRoot = () => join(app.getPath('userData'), 'Bibliotheken')

/**
 * Ordner der ersten Bibliothek. Bis Version 0.1 hieß die App „BibCat" und speicherte unter
 * …/BibCat/Katalog. Gibt es dort einen Katalog und unter BibCraft noch keinen,
 * wird er einmalig kopiert (das Original bleibt als Rückfallebene erhalten).
 */
function defaultLibraryDir(): string {
  const custom = process.env.BIBCRAFT_DATA_DIR || process.env.BIBCAT_DATA_DIR
  const dir = custom || join(app.getPath('userData'), 'Katalog')
  if (!custom) {
    const legacy = join(app.getPath('appData'), 'BibCat', 'Katalog')
    if (!existsSync(join(dir, DB_FILE)) && existsSync(join(legacy, DB_FILE))) {
      cpSync(legacy, dir, { recursive: true })
      migratedFromBibCat = true
    }
  }
  return dir
}

/** Liest den Namen einer Bibliothek aus ihrer Datenbank (legt ihn bei Bedarf an). */
function nameOf(c: Catalog, dir: string): string {
  let name = c.getSetting('libraryName')
  if (!name) {
    name = samePath(dir, defaultLibraryDir()) ? t('library.defaultName') : basename(dir)
    c.setSetting('libraryName', name)
  }
  return name
}

/** Öffnet eine Bibliothek. Erst wenn das klappt, wird die bisherige geschlossen. */
function activate(dir: string, create = false): void {
  if (!create && !existsSync(join(dir, DB_FILE))) throw new AppError('err.libraryMissing', { path: dir })
  mkdirSync(join(dir, 'covers'), { recursive: true })
  const next = new Catalog(join(dir, DB_FILE))
  catalog?.close()
  catalog = next
  dataDirPath = dir
  coverDir = join(dir, 'covers')
  libraryName = nameOf(next, dir)
  profile.upsert(dir, libraryName)
  profile.setCurrent(dir)
}

/** Kurz öffnen, etwas tun, schließen – für Bibliotheken, die gerade nicht aktiv sind */
function withCatalog<T>(dir: string, fn: (c: Catalog) => T): T {
  if (samePath(dir, dataDirPath)) return fn(catalog)
  const c = new Catalog(join(dir, DB_FILE))
  try {
    return fn(c)
  } finally {
    c.close()
  }
}

function libraryInfo(path: string, name: string): LibraryInfo {
  return { path, name, current: samePath(path, dataDirPath), exists: existsSync(join(path, DB_FILE)) }
}

function storeCover(bytes: Buffer, ext: string): string {
  const name = createHash('sha1').update(bytes).digest('hex').slice(0, 20) + ext
  const target = join(coverDir, name)
  if (!existsSync(target)) writeFileSync(target, bytes)
  return name
}

/** Registriert einen IPC-Handler; AppError wird in der aktuellen Sprache an die Oberfläche gemeldet. */
function handle(channel: string, fn: (e: IpcMainInvokeEvent, ...args: any[]) => unknown): void {
  ipcMain.handle(channel, async (e, ...args) => {
    try {
      return await fn(e, ...args)
    } catch (err) {
      if (err instanceof AppError) throw new Error(t(err.key, err.params))
      throw err
    }
  })
}

function registerIpc(): void {
  handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    language: lang,
    dataDir: dataDirPath,
    migratedFromBibCat,
    library: libraryInfo(dataDirPath, libraryName),
    libraryFallback
  }))
  handle('app:setLanguage', (_e, l: unknown) => {
    if (!isLang(l)) return
    lang = l
    profile.setLanguage(l)
  })

  // ---------- Updates ----------

  handle('updates:state', () => updater.current)
  handle('updates:check', () => updater.check(true))
  handle('updates:install', () => updater.install())
  handle('updates:openReleases', () => updater.openReleases())
  handle('updates:setAuto', (_e, on: boolean) => updater.setAuto(!!on))

  // ---------- Bibliotheken ----------

  handle('libraries:list', () =>
    profile.libraries
      .map((l) => libraryInfo(l.path, l.name))
      .sort((a, b) => a.name.localeCompare(b.name, lang))
  )
  handle('libraries:create', (_e, rawName: string, parentDir?: string | null) => {
    const name = String(rawName ?? '').trim()
    if (!name) throw new AppError('err.libraryName')
    const parent = parentDir || librariesRoot()
    mkdirSync(parent, { recursive: true })
    const dir = freeFolder(parent, name)
    mkdirSync(join(dir, 'covers'), { recursive: true })
    const c = new Catalog(join(dir, DB_FILE))
    c.setSetting('libraryName', name)
    c.close()
    profile.upsert(dir, name)
    return libraryInfo(dir, name)
  })
  handle('libraries:pickLocation', async () => {
    const r = await dialog.showOpenDialog({
      title: t('main.chooseLibraryLocation'),
      properties: ['openDirectory', 'createDirectory']
    })
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
  handle('libraries:openDialog', async () => {
    const r = await dialog.showOpenDialog({
      title: t('main.openLibraryTitle'),
      properties: ['openDirectory']
    })
    if (r.canceled || !r.filePaths[0]) return null
    const dir = libraryDirFrom(r.filePaths[0])
    if (!dir) throw new AppError('err.notALibrary')
    const name = withCatalog(dir, (c) => nameOf(c, dir))
    profile.upsert(dir, name)
    return libraryInfo(dir, name)
  })
  handle('libraries:switchTo', (_e, dir: string) => {
    if (samePath(dir, dataDirPath)) return
    activate(dir)
    libraryFallback = null
    migratedFromBibCat = false
  })
  handle('libraries:rename', (_e, dir: string, rawName: string) => {
    const name = String(rawName ?? '').trim()
    if (!name) throw new AppError('err.libraryName')
    if (!existsSync(join(dir, DB_FILE))) throw new AppError('err.libraryMissing', { path: dir })
    withCatalog(dir, (c) => c.setSetting('libraryName', name))
    profile.upsert(dir, name)
    if (samePath(dir, dataDirPath)) libraryName = name
  })
  handle('libraries:forget', (_e, dir: string) => {
    if (samePath(dir, dataDirPath)) throw new AppError('err.forgetCurrent')
    profile.forget(dir)
  })
  handle('libraries:reveal', (_e, dir: string) => {
    if (existsSync(join(dir, DB_FILE))) shell.showItemInFolder(join(dir, DB_FILE))
    else shell.openPath(dir)
  })

  // ---------- Bücher, Fachgebiete, Standorte ----------

  handle('books:list', (_e, q) => catalog.listBooks(q))
  handle('books:get', (_e, id: number) => catalog.getBook(id))
  handle('books:create', (_e, b) => catalog.createBook(b))
  handle('books:update', (_e, id: number, b) => catalog.updateBook(id, b))
  handle('books:remove', (_e, id: number) => catalog.deleteBook(id))
  handle('books:findByIsbn', (_e, isbn: string) => catalog.findByIsbn(isbn))
  handle('books:stats', () => catalog.stats())
  handle('books:statistics', () => catalog.statistics())
  handle('books:bulkUpdate', (_e, ids: number[], patch) => catalog.bulkUpdate(ids, patch))
  handle('books:removeMany', (_e, ids: number[]) => catalog.deleteBooks(ids))
  handle('books:restore', (_e, books) => catalog.restoreBooks(books))

  handle('subjects:list', () => catalog.listSubjects())
  handle('subjects:save', (_e, s) => catalog.saveSubject(s))
  handle('subjects:remove', (_e, id: number) => catalog.deleteSubject(id))

  handle('locations:list', () => catalog.listLocations())
  handle('locations:save', (_e, l) => catalog.saveLocation(l))
  handle('locations:remove', (_e, id: number) => catalog.deleteLocation(id))

  handle('isbn:lookup', (_e, isbn: string) => lookupIsbn(isbn))

  // ---------- Filme, Musik, Spiele, Zeitschriften ----------

  handle('media:lookupCode', async (_e, raw: string) => {
    const code = cleanIsbn(String(raw ?? ''))
    switch (classifyCode(code)) {
      case 'isbn':
        return lookupIsbn(code)
      case 'issn': {
        const issn = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : issnFromEan(code)
        const r = issn ? await lookupIssn(issn) : []
        return r.map((x) => ({ ...x, data: { ...x.data, isbn: code } }))
      }
      case 'ean':
        return musicByBarcode(code)
      default:
        throw new AppError('err.invalidCode')
    }
  })
  handle('media:search', async (_e, q: string, type: unknown) => {
    try {
      return await searchMedia(String(q ?? ''), isMediaType(type) ? type : 'film', mediaCtx())
    } catch (err) {
      if (err instanceof Unreachable) throw new AppError('err.unreachable')
      throw err
    }
  })
  handle('media:details', async (_e, hit) => {
    const r = await mediaDetails(hit, mediaCtx())
    if (!r) throw new AppError('err.noDetails')
    return r
  })

  handle('settings:tmdb', () => ({
    configured: !!tmdbKey(),
    encrypted: (profile.tmdbKey ?? '').startsWith('enc:')
  }))
  handle('settings:setTmdbKey', async (_e, raw: string) => {
    const key = String(raw ?? '').trim()
    storeTmdbKey(key)
    if (!key) return { ok: true }
    return (await tmdbCheckKey(key)) ? { ok: true } : { ok: false, message: t('settings.tmdbUnverified') }
  })

  handle('covers:download', async (_e, url: string) => {
    if (!/^https:\/\//.test(url)) throw new AppError('err.httpsOnly')
    const res = await net.fetch(url, { signal: AbortSignal.timeout(15000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) throw new AppError('err.noCover')
    const bytes = Buffer.from(await res.arrayBuffer())
    // Platzhalterbilder (z. B. 1×1-GIFs) aussortieren
    if (bytes.length < 1500) throw new AppError('err.noCover')
    const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg'
    return storeCover(bytes, ext)
  })

  handle('covers:pick', async () => {
    const r = await dialog.showOpenDialog({
      title: t('main.coverTitle'),
      properties: ['openFile'],
      filters: [{ name: t('main.images'), extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    const file = r.filePaths[0]
    return storeCover(readFileSync(file), extname(file).toLowerCase() || '.jpg')
  })

  // ---------- Export und Sicherung ----------

  handle('data:exportCsv', async () => {
    const r = await dialog.showSaveDialog({
      title: t('main.exportTitle'),
      defaultPath: `${folderName(libraryName)} – ${t('main.exportFile', { date: new Date().toISOString().slice(0, 10) })}`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (r.canceled || !r.filePath) return null
    const csv = booksToCsv(catalog.listBooks({}), catalog.listSubjects(), catalog.listLocations(), t)
    writeFileSync(r.filePath, csv, 'utf8')
    return r.filePath
  })

  handle('data:backup', async () => {
    const r = await dialog.showOpenDialog({
      title: t('main.backupTitle'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (r.canceled || !r.filePaths[0]) return null
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
    const target = join(r.filePaths[0], `${folderName(libraryName)} – ${t('main.backupFolder', { stamp })}`)
    mkdirSync(join(target, 'covers'), { recursive: true })
    catalog.backupTo(join(target, DB_FILE))
    for (const b of catalog.listBooks({})) {
      if (b.coverFile && existsSync(join(coverDir, b.coverFile))) {
        copyFileSync(join(coverDir, b.coverFile), join(target, 'covers', b.coverFile))
      }
    }
    return target
  })

  handle('data:openFolder', () => shell.openPath(dataDirPath))
}

function createWindow(): void {
  const mac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: 'BibCraft',
    backgroundColor: TITLEBAR.color,
    // Eigene Titelleiste wie in Office; Windows/Linux zeichnen nur die Fensterknöpfe darüber
    titleBarStyle: 'hidden',
    ...(mac ? { trafficLightPosition: { x: 14, y: 13 } } : { titleBarOverlay: TITLEBAR }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  win.once('ready-to-show', () => win.show())
  // Externe Links im Standardbrowser öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Nur ein BibCraft-Fenster pro Profil: ein zweiter Start holt das vorhandene nach vorn
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    profile = new Profile(join(app.getPath('userData'), 'profile.json'))
    const fallbackDir = defaultLibraryDir()

    // Bis Version 0.3 lag die Sprache in der Datenbank – vor dem Benennen der Bibliothek übernehmen
    if (!profile.language) {
      let legacy: string | null = null
      if (existsSync(join(fallbackDir, DB_FILE))) {
        const c = new Catalog(join(fallbackDir, DB_FILE))
        legacy = c.getSetting('language')
        c.close()
      }
      profile.setLanguage(isLang(legacy) ? legacy : langFromLocale(app.getLocale()))
    }
    lang = profile.language!

    const explicit = !!(process.env.BIBCRAFT_DATA_DIR || process.env.BIBCAT_DATA_DIR)
    const target = explicit ? fallbackDir : (profile.current ?? fallbackDir)
    try {
      activate(target, samePath(target, fallbackDir))
    } catch {
      activate(fallbackDir, true)
      libraryFallback = libraryName
    }

    protocol.handle('cover', (req) => {
      const name = decodeURIComponent(new URL(req.url).hostname)
      if (!/^[\w.-]+$/.test(name)) return new Response('Bad request', { status: 400 })
      return net.fetch(pathToFileURL(join(coverDir, name)).toString())
    })

    // Kamera nur für den Barcode-Scanner freigeben
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      if (permission === 'media') {
        if (process.platform === 'darwin') {
          systemPreferences.askForMediaAccess('camera').then(callback)
        } else {
          callback(true)
        }
        return
      }
      callback(false)
    })

    updater = new Updater(profile)
    registerIpc()
    createWindow()
    updater.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => catalog?.close())
}
