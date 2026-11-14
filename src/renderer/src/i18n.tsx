import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { localeOf, translator, type Lang, type Translate } from '@shared/i18n'

interface I18n {
  lang: Lang
  t: Translate
  /** Datum (YYYY-MM-DD) im Format der gewählten Sprache */
  date: (iso: string) => string
}

const Ctx = createContext<I18n>({ lang: 'de', t: translator('de'), date: (d) => d })

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18n>(() => {
    const locale = localeOf(lang)
    return {
      lang,
      t: translator(lang),
      date: (iso) => (iso ? new Date(iso).toLocaleDateString(locale) : '')
    }
  }, [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
