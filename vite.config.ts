import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import routes from './server/routes.json'

/** In `npm run dev`, serve the /api routes from server/routes so live mode works locally. */
function devApi(): Plugin {
  return {
    name: 'whimsy-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = (routes as Record<string, string>)[req.url?.split('?')[0] ?? '']
        if (!name) return next()
        const mod = await server.ssrLoadModule(`/server/routes/${name}.ts`)
        await mod.default(req, res)
      })
    },
  }
}

// `vite build --mode single` produces one self-contained HTML file (dist-single/)
// that can be shared as a link or opened straight from disk.
export default defineConfig(({ mode, command }) => {
  // Accept the names Vercel's Supabase integration sets, as well as our own VITE_ ones.
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'serve') Object.assign(process.env, env)
  const first = (...names: string[]) => JSON.stringify(names.map((n) => env[n]).find(Boolean) ?? '')
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : []), devApi()],
    build: mode === 'single' ? { outDir: 'dist-single' } : undefined,
    define: {
      'import.meta.env.VITE_LIVE': first('VITE_LIVE'),
      'import.meta.env.VITE_SUPABASE_URL': first('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': first('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
      'import.meta.env.VITE_STAFF_EMAILS': first('VITE_STAFF_EMAILS', 'STAFF_EMAILS'),
    },
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  }
})
