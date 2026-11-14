// Gibt den Abschnitt einer Version aus CHANGELOG.md aus (für die Release-Beschreibung).
// Aufruf: node scripts/changelog-section.mjs 0.5.0
import { readFileSync } from 'node:fs'

const version = process.argv[2]
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n')
const start = lines.findIndex((l) => l.startsWith(`## ${version} `) || l.trim() === `## ${version}`)
if (start < 0) {
  console.error(`Kein Abschnitt für Version ${version} in CHANGELOG.md`)
  process.exit(1)
}
const end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
console.log(
  lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim()
)
