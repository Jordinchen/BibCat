import { contextBridge, ipcRenderer } from 'electron'
import type { BibCraftApi } from '@shared/types'

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const api: BibCraftApi = {
  app: { info: call('app:info'), setLanguage: call('app:setLanguage') },
  books: {
    list: call('books:list'),
    get: call('books:get'),
    create: call('books:create'),
    update: call('books:update'),
    remove: call('books:remove'),
    findByIsbn: call('books:findByIsbn'),
    stats: call('books:stats')
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
  covers: { download: call('covers:download'), pick: call('covers:pick') },
  data: {
    exportCsv: call('data:exportCsv'),
    backup: call('data:backup'),
    openFolder: call('data:openFolder')
  }
} as BibCraftApi

contextBridge.exposeInMainWorld('bibcraft', api)
