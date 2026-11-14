import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
  shell,
  systemPreferences,
  type IpcMainInvokeEvent
} from 'electron'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Catalog } from './db'
import { lookupIsbn } from './lookup'
import { booksToCsv } from './csv'
import { AppError, isLang, langFromLocale, translator, type Lang } from '@shared/i18n'

protocol.registerSchemesAsPrivileged([
  { scheme: 'cover', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

/** Farben der Titelleiste (müssen zu --titlebar in styles.css passen) */
const TITLEBAR = { color: '#F58092', symbolColor: '#3b0a17', height: 40 }

let catalog: Catalog
let coverDir: string
let dataDirPath: string
let migratedFromBibCat = false
let lang: Lang = 'de'
const t = (...a: Parameters<ReturnType<typeof translator>>) => translator(lang)(...a)

/**
 * Datenordner bestimmen. Bis Version 0.1 hieß die App „BibCat" und speicherte unter
 * …/BibCat/Katalog. Gibt es dort einen Katalog und unter BibCraft noch keinen,
 * wird er einmalig kopiert (das Original bleibt als Rückfallebene erhalten).
 */
function resolveDataDir(): string {
  const custom = process.env.BIBCRAFT_DATA_DIR || process.env.BIBCAT_DATA_DIR
  const dir = custom || join(app.getPath('userData'), 'Katalog')
  if (!custom) {
    const legacy = join(app.getPath('appData'), 'BibCat', 'Katalog')
    if (!existsSync(join(dir, 'katalog.sqlite')) && existsSync(join(legacy, 'katalog.sqlite'))) {
      cpSync(legacy, dir, { recursive: true })
      migratedFromBibCat = true
    }
  }
  mkdirSync(join(dir, 'covers'), { recursive: true })
  return dir
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
      if (err instanceof AppError) throw new Error(t(err.key))
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
    migratedFromBibCat
  }))
  handle('app:setLanguage', (_e, l: unknown) => {
    if (!isLang(l)) return
    lang = l
    catalog.setSetting('language', l)
  })

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

  handle('data:exportCsv', async () => {
    const r = await dialog.showSaveDialog({
      title: t('main.exportTitle'),
      defaultPath: t('main.exportFile', { date: new Date().toISOString().slice(0, 10) }),
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
    const target = join(r.filePaths[0], t('main.backupFolder', { stamp }))
    mkdirSync(join(target, 'covers'), { recursive: true })
    catalog.backupTo(join(target, 'katalog.sqlite'))
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

app.whenReady().then(() => {
  dataDirPath = resolveDataDir()
  coverDir = join(dataDirPath, 'covers')
  catalog = new Catalog(join(dataDirPath, 'katalog.sqlite'))
  const saved = catalog.getSetting('language')
  lang = isLang(saved) ? saved : langFromLocale(app.getLocale())

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

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => catalog?.close())
