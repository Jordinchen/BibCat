import type { BibCraftApi } from '@shared/types'

declare global {
  interface Window {
    bibcraft: BibCraftApi
  }
}

export {}
