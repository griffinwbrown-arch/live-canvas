import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = new URL('../', import.meta.url)
const target = new URL('packaging/app/', root)
await fs.mkdir(target, { recursive: true })
for (const name of ['dist', 'electron']) {
  const destination = fileURLToPath(new URL(name, target))
  const relative = path.relative(fileURLToPath(target), destination)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Invalid staging destination.')
  await fs.rm(destination, { recursive: true, force: true })
  await fs.cp(new URL(name, root), destination, { recursive: true })
}
const original = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'))
await fs.writeFile(
  new URL('package.json', target),
  JSON.stringify(
    {
      name: original.name,
      version: original.version,
      description: 'Live screen capture and drawing for pen displays.',
      author: 'Griffin Brown',
      private: true,
      main: 'electron/main.cjs',
    },
    null,
    2,
  ),
)
console.log('Packaged app staged without development dependencies or environment files.')
