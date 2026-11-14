// Sammelt Name, Version, Lizenz und Lizenztext aller Bibliotheken, die in BibCraft
// eingebaut werden, und schreibt sie nach src/renderer/src/third-party.json.
// Aufruf: node scripts/third-party-licenses.mjs (läuft auch automatisch vor dem Build)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const root = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const require = createRequire(join(root, 'package.json'))

// Direkt in die Oberfläche gebündelte Pakete; ihre Abhängigkeiten werden mit eingesammelt
const ROOTS = ['react', 'react-dom', '@zxing/browser', '@zxing/library', 'lucide-react']

function pkgDir(name, from) {
  let dir = from
  while (true) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function licenseText(dir) {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f))
  const notice = readdirSync(dir).find((f) => /^notice(\.(md|txt))?$/i.test(f))
  let text = file ? readFileSync(join(dir, file), 'utf8').trim() : ''
  if (notice) text += '\n\n' + readFileSync(join(dir, notice), 'utf8').trim()
  return text
}

const seen = new Map()
function visit(name, from) {
  const dir = pkgDir(name, from)
  if (!dir) return
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const key = `${pkg.name}@${pkg.version}`
  if (seen.has(key)) return
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'UNKNOWN')
  seen.set(key, {
    name: pkg.name,
    version: pkg.version,
    license,
    homepage:
      pkg.homepage ?? (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url) ?? '',
    text: licenseText(dir)
  })
  for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir)
}

for (const name of ROOTS) visit(name, root)

// Electron selbst (inkl. Chromium und Node.js) liegt dem Installer mit eigenen Lizenzdateien bei
const electron = JSON.parse(readFileSync(require.resolve('electron/package.json'), 'utf8'))
seen.set('electron', {
  name: 'electron',
  version: electron.version,
  license: electron.license,
  homepage: 'https://www.electronjs.org',
  text: licenseText(dirname(require.resolve('electron/package.json')))
})

const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
const missing = list.filter((l) => !l.text)
if (missing.length) {
  console.error('Lizenztext fehlt für:', missing.map((l) => l.name).join(', '))
  process.exit(1)
}
writeFileSync(join(root, 'src/renderer/src/third-party.json'), JSON.stringify(list, null, 2) + '\n')
console.log(list.map((l) => `${l.name}@${l.version} (${l.license})`).join('\n'))
