import { Book, BookImage, Clapperboard, Disc3, Gamepad2, Newspaper, type LucideIcon } from 'lucide-react'
import type { BookInput, ReadStatus } from '@shared/types'
import { mediaGroup, type MediaType } from '@shared/media'
import type { TKey, Translate } from '@shared/i18n'

export const MEDIA_ICONS: Record<MediaType, LucideIcon> = {
  book: Book,
  comic: BookImage,
  periodical: Newspaper,
  film: Clapperboard,
  music: Disc3,
  game: Gamepad2
}

/** „mixed": Ansicht mit mehreren Medienarten – dann neutrale Statusnamen */
export type StatusKind = MediaType | 'mixed'

const has = (t: Translate, key: string) => t(key as TKey) !== key

/**
 * Beschriftung eines Feldes je Medienart. Gesucht wird von speziell nach allgemein:
 * field.<feld>.<art> → field.<feld>.<gruppe> → field.<feld>
 */
export function fieldLabel(t: Translate, field: string, type: MediaType): string {
  for (const key of [`field.${field}.${type}`, `field.${field}.${mediaGroup(type)}`, `field.${field}`]) {
    if (has(t, key)) return t(key as TKey)
  }
  return field
}

export function statusLabel(t: Translate, status: ReadStatus, kind: StatusKind): string {
  if (kind === 'mixed') return t(`status.mixed.${status}` as TKey)
  const g = mediaGroup(kind)
  return g === 'book' ? t(`status.${status}`) : t(`status.${g}.${status}` as TKey)
}

export function readDateLabel(t: Translate, kind: StatusKind): string {
  if (kind === 'mixed') return t('field.readDate.mixed')
  const g = mediaGroup(kind)
  return g === 'book' ? t('field.readDate') : t(`field.readDate.${g}` as TKey)
}

type Field = keyof BookInput

/** Welche Felder bei welcher Medienart angezeigt werden (alles andere bleibt gespeichert, aber verborgen) */
const HIDDEN: Record<ReturnType<typeof mediaGroup>, Field[]> = {
  book: ['duration', 'ageRating', 'tracks', 'players'],
  film: ['place', 'pages', 'tracks', 'players'],
  music: ['place', 'pages', 'ageRating', 'players', 'series', 'seriesNumber'],
  game: ['place', 'pages', 'tracks', 'contributors']
}

export function shows(type: MediaType, field: Field): boolean {
  return !HIDDEN[mediaGroup(type)].includes(field)
}

/** Vorschläge für das Feld Einband/Format/Plattform */
export function bindingOptions(t: Translate, type: MediaType): string[] {
  switch (mediaGroup(type)) {
    case 'film':
      return ['DVD', 'Blu-ray', '4K UHD Blu-ray', 'VHS', 'Digital']
    case 'music':
      return ['CD', 'LP', 'Single', 'MC', 'SACD', 'Digital']
    case 'game':
      return [
        'PC',
        'PlayStation 5',
        'PlayStation 4',
        'Xbox Series X|S',
        'Nintendo Switch',
        t('binding.boardGame'),
        t('binding.cardGame')
      ]
    default:
      return [
        t('binding.hardcover'),
        t('binding.paperback'),
        t('binding.softcover'),
        t('binding.cloth'),
        t('binding.halfLeather')
      ]
  }
}

/** Medienarten, für die es eine Titelsuche gibt (Bücher laufen über die ISBN) */
export const SEARCHABLE: MediaType[] = ['film', 'music', 'game', 'comic']
