import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/types'
import type { Translate } from '@shared/i18n'

/** Aktueller Update-Status, live aktualisiert */
export function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    window.bibcraft.updates.state().then(setState)
    return window.bibcraft.updates.onState(setState)
  }, [])
  return state
}

/** Statuszeile in Worten */
export function describeUpdate(s: UpdateState, t: Translate): string {
  switch (s.status) {
    case 'checking':
      return t('updates.checking')
    case 'none':
      return t('updates.none')
    case 'available':
      return t('updates.available', { v: s.version ?? '' })
    case 'downloading':
      return t('updates.downloading', { v: s.version ?? '', p: s.percent ?? 0 })
    case 'ready':
      return t('updates.ready', { v: s.version ?? '' })
    case 'error':
      return t('updates.error')
    default:
      return ''
  }
}
