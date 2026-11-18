import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const target = resolve(root, manifest.exports['./client'])
const filename = `client-v${manifest.version}.js`
if (target !== resolve(root, filename)) throw new Error('Unexpected client build target')
const body = readFileSync(resolve(root, 'client.js'), 'utf8')
writeFileSync(target, `// Pressure monster client build ${manifest.version}\n${body}`)
for (const file of ['index.js', 'prompts.js', manifest.exports['.'], filename, 'icon.svg', 'cordis.patch.yml', 'locale/en.json', 'locale/zh-CN.json']) {
  if (!existsSync(resolve(root, file))) throw new Error(`Missing packaged resource: ${file}`)
}
console.log(`Built ${filename}`)
