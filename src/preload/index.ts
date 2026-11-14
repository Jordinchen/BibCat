import { contextBridge, ipcRenderer } from 'electron'
import type { BibCraftApi, UpdateState } from '@shared/types'

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const api: BibCraftApi = {
  app: { info: call('app:info'), setLanguage: call('app:setLanguage') },
  updates: {
    state: call('updates:state'),
    check: call('updates:check'),
    install: call('updates:install'),
    openReleases: call('updates:openReleases'),
    setAuto: call('updates:setAuto'),
    onState: (cb: (s: UpdateState) => void) => {
      const listener = (_e: unknown, s: UpdateState) => cb(s)
      ipcRenderer.on('updates:state', listener)
      return () => ipcRenderer.removeListener('updates:state', listener)
    }
  },
  libraries: {
    list: call('libraries:list'),
    create: call('libraries:create'),
    pickLocation: call('libraries:pickLocation'),
    openDialog: call('libraries:openDialog'),
    switchTo: call('libraries:switchTo'),
    rename: call('libraries:rename'),
    forget: call('libraries:forget'),
    reveal: call('libraries:reveal')
  },
  books: {
    list: call('books:list'),
    get: call('books:get'),
    create: call('books:create'),
    update: call('books:update'),
    remove: call('books:remove'),
    findByIsbn: call('books:findByIsbn'),
    stats: call('books:stats'),
    statistics: call('books:statistics'),
    bulkUpdate: call('books:bulkUpdate'),
    removeMany: call('books:removeMany'),
    restore: call('books:restore')
  },
  subjects: {
    list: call('subjects:list'),
    save: call('subjects:save'),
    remove: call('subjects:remove')
  },
  locations: {
    list: call('locations:list'),
    save: call('locations:save'),
    remove: call('locations:remove')
  },
  isbn: { lookup: call('isbn:lookup') },
  media: {
    lookupCode: call('media:lookupCode'),
    search: call('media:search'),
    details: call('media:details')
  },
  settings: { tmdb: call('settings:tmdb'), setTmdbKey: call('settings:setTmdbKey') },
  covers: { download: call('covers:download'), pick: call('covers:pick') },
  data: {
    exportCsv: call('data:exportCsv'),
    backup: call('data:backup'),
    openFolder: call('data:openFolder')
  }
} as BibCraftApi

contextBridge.exposeInMainWorld('bibcraft', api)
