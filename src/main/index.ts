import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
  shell,
  systemPreferences
} from 'electron'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Catalog } from './db'
import { lookupIsbn } from './lookup'
import { booksToCsv } from './csv'

protocol.registerSchemesAsPrivileged([
  { scheme: 'cover', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let catalog: Catalog
let coverDir: string

function dataDir(): string {
  // BIBCAT_DATA_DIR erlaubt einen eigenen Speicherort (z. B. portable Nutzung oder Tests)
  const dir = process.env.BIBCAT_DATA_DIR || join(app.getPath('userData'), 'Katalog')
  mkdirSync(join(dir, 'covers'), { recursive: true })
  return dir
}

function storeCover(bytes: Buffer, ext: string): string {
  const name = createHash('sha1').update(bytes).digest('hex').slice(0, 20) + ext
  const target = join(coverDir, name)
  if (!existsSync(target)) writeFileSync(target, bytes)
  return name
}

function registerIpc(): void {
  ipcMain.handle('books:list', (_e, q) => catalog.listBooks(q))
  ipcMain.handle('books:get', (_e, id: number) => catalog.getBook(id))
  ipcMain.handle('books:create', (_e, b) => catalog.createBook(b))
  ipcMain.handle('books:update', (_e, id: number, b) => catalog.updateBook(id, b))
  ipcMain.handle('books:remove', (_e, id: number) => catalog.deleteBook(id))
  ipcMain.handle('books:findByIsbn', (_e, isbn: string) => catalog.findByIsbn(isbn))
  ipcMain.handle('books:stats', () => catalog.stats())

  ipcMain.handle('subjects:list', () => catalog.listSubjects())
  ipcMain.handle('subjects:save', (_e, s) => catalog.saveSubject(s))
  ipcMain.handle('subjects:remove', (_e, id: number) => catalog.deleteSubject(id))

  ipcMain.handle('locations:list', () => catalog.listLocations())
  ipcMain.handle('locations:save', (_e, l) => catalog.saveLocation(l))
  ipcMain.handle('locations:remove', (_e, id: number) => catalog.deleteLocation(id))

  ipcMain.handle('isbn:lookup', (_e, isbn: string) => lookupIsbn(isbn))

  ipcMain.handle('covers:download', async (_e, url: string) => {
    if (!/^https:\/\//.test(url)) throw new Error('Nur HTTPS-Adressen erlaubt')
    const res = await net.fetch(url, { signal: AbortSignal.timeout(15000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) throw new Error('Kein Cover gefunden')
    const bytes = Buffer.from(await res.arrayBuffer())
    // Platzhalterbilder (z. B. 1×1-GIFs) aussortieren
    if (bytes.length < 1500) throw new Error('Kein Cover gefunden')
    const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg'
    return storeCover(bytes, ext)
  })

  ipcMain.handle('covers:pick', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Cover auswählen',
      properties: ['openFile'],
      filters: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    const file = r.filePaths[0]
    return storeCover(readFileSync(file), extname(file).toLowerCase() || '.jpg')
  })

  ipcMain.handle('data:exportCsv', async () => {
    const r = await dialog.showSaveDialog({
      title: 'Katalog als CSV exportieren',
      defaultPath: `BibCat-Export-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (r.canceled || !r.filePath) return null
    const csv = booksToCsv(catalog.listBooks({}), catalog.listSubjects(), catalog.listLocations())
    writeFileSync(r.filePath, csv, 'utf8')
    return r.filePath
  })

  ipcMain.handle('data:backup', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Ordner für die Sicherung wählen',
      properties: ['openDirectory', 'createDirectory']
    })
    if (r.canceled || !r.filePaths[0]) return null
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
    const target = join(r.filePaths[0], `BibCat-Sicherung-${stamp}`)
    mkdirSync(join(target, 'covers'), { recursive: true })
    catalog.backupTo(join(target, 'katalog.sqlite'))
    for (const b of catalog.listBooks({})) {
      if (b.coverFile && existsSync(join(coverDir, b.coverFile))) {
        copyFileSync(join(coverDir, b.coverFile), join(target, 'covers', b.coverFile))
      }
    }
    return target
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 600,
    show: false,
    title: 'BibCat',
    backgroundColor: '#f7f6f3',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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
  const dir = dataDir()
  coverDir = join(dir, 'covers')
  catalog = new Catalog(join(dir, 'katalog.sqlite'))

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
