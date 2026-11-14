import type { BibCatApi } from '@shared/types'

declare global {
  interface Window {
    bibcat: BibCatApi
  }
}

export {}
