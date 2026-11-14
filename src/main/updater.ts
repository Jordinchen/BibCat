import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/types'
import type { Profile } from './libraries'

const RELEASES_URL = 'https://github.com/Jordinchen/BibCat/releases'
const RECHECK_MS = 6 * 60 * 60 * 1000

/**
 * Automatische Updates über GitHub Releases.
 * Windows (NSIS) und Linux-AppImage laden und installieren selbst; macOS braucht dafür eine
 * Signierung – bis dahin gibt es dort nur einen Hinweis mit Link zur Download-Seite.
 */
export class Updater {
  private state: UpdateState
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly profile: Profile) {
    const canInstall = process.platform === 'win32' || !!process.env.APPIMAGE
    this.state = {
      status: 'idle',
      canInstall,
      manual: false,
      auto: profile.autoUpdate,
      releasesUrl: RELEASES_URL
    }

    autoUpdater.autoDownload = canInstall
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = null
    // Nur für Tests: eigene Update-Quelle statt GitHub
    if (process.env.BIBCRAFT_UPDATE_FEED) {
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.setFeedURL({ provider: 'generic', url: process.env.BIBCRAFT_UPDATE_FEED })
    }

    autoUpdater.on('checking-for-update', () => this.set({ status: 'checking' }))
    autoUpdater.on('update-not-available', () => this.set({ status: 'none' }))
    autoUpdater.on('update-available', (info) =>
      this.set({ status: canInstall ? 'downloading' : 'available', version: info.version, percent: 0 })
    )
    autoUpdater.on('download-progress', (p) =>
      this.set({ status: 'downloading', percent: Math.round(p.percent) })
    )
    autoUpdater.on('update-downloaded', (info) => this.set({ status: 'ready', version: info.version }))
    autoUpdater.on('error', (err) => {
      // Ein bereits geladenes Update bleibt gültig, auch wenn eine spätere Prüfung scheitert
      if (this.state.status === 'ready') return
      this.set({ status: 'error', error: err?.message ?? String(err) })
    })
  }

  /** Ohne Installation (Entwicklung) gibt es keine Updates – außer mit Test-Quelle */
  private get enabled(): boolean {
    return app.isPackaged || !!process.env.BIBCRAFT_UPDATE_FEED
  }

  get current(): UpdateState {
    return { ...this.state }
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch }
    if (patch.status && patch.status !== 'error') delete this.state.error
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('updates:state', this.current)
  }

  /** Beim Start: nach kurzer Wartezeit prüfen und dann alle 6 Stunden */
  start(): void {
    if (!this.enabled || !this.profile.autoUpdate) return
    setTimeout(() => this.check(false), 8000)
    this.timer = setInterval(() => this.check(false), RECHECK_MS)
  }

  async check(manual = true): Promise<void> {
    if (!this.enabled) {
      this.set({ status: 'none', manual })
      return
    }
    if (this.state.status === 'downloading' || this.state.status === 'ready') {
      this.set({ manual })
      return
    }
    this.set({ manual })
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      /* wird über das 'error'-Ereignis gemeldet */
    }
  }

  install(): void {
    if (this.state.status === 'ready') autoUpdater.quitAndInstall(false, true)
  }

  openReleases(): void {
    shell.openExternal(this.state.version ? `${RELEASES_URL}/tag/v${this.state.version}` : RELEASES_URL)
  }

  setAuto(on: boolean): void {
    this.profile.setAutoUpdate(on)
    this.set({ auto: on })
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (on) this.start()
  }
}
