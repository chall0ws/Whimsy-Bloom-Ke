// Packages the site for Vercel using the Build Output API (.vercel/output):
// the built shop as static files, and each server route bundled into one file.
// Vercel uses .vercel/output as-is when the build command creates it.
import { build } from 'esbuild'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const out = '.vercel/output'
const routes = JSON.parse(readFileSync('server/routes.json', 'utf8'))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync('dist', join(out, 'static'), { recursive: true })

for (const [path, name] of Object.entries(routes)) {
  const dir = join(out, 'functions', `${path.replace(/^\//, '')}.func`)
  mkdirSync(dir, { recursive: true })
  await build({
    entryPoints: [`server/routes/${name}.ts`],
    outfile: join(dir, 'index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    // Some dependencies still use require(); give the ES module one.
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    logLevel: 'warning',
  })
  writeFileSync(
    join(dir, '.vc-config.json'),
    JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 15 }, null, 2),
  )
  mkdirSync(dirname(dir), { recursive: true })
}

writeFileSync(join(out, 'config.json'), JSON.stringify({ version: 3, routes: [{ handle: 'filesystem' }] }, null, 2))
console.log(`Vercel output ready: static site + ${Object.keys(routes).length} server functions`)
