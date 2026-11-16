import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { redact } from '@tanstack/redact/vite'

const config = defineConfig({
  // Redact has to redirect React imports inside server dependencies too.
  ssr: { noExternal: true },
  resolve: { tsconfigPaths: true },
  // The Cloudflare plugin turns on sourcemaps for the worker build, but
  // vite:css-post reads the top-level flag and skips its map when that is
  // off (SOURCEMAP_BROKEN). Enable it here and keep the client build as it was.
  build: { sourcemap: true },
  environments: {
    client: {
      build: {
        sourcemap: false,
        rolldownOptions: {
          output: {
            // The messages group names its chunks after every part of the
            // site that uses them; the hash is enough to tell them apart.
            chunkFileNames: (chunk) =>
              chunk.name.startsWith('messages~')
                ? 'assets/messages-[hash].js'
                : 'assets/[name]-[hash].js',
            // The editor route pulls in large libraries; give them their own
            // cacheable chunks instead of one oversized route chunk.
            codeSplitting: {
              groups: [
                {
                  // Redact replaces react and react-dom at build time.
                  name: 'react',
                  test: /node_modules[\\/](react|react-dom|scheduler|@tanstack[\\/]redact)[\\/]/,
                },
                {
                  // Without what only some files load: the merge view for
                  // comparisons, and the Markdown and SQL grammars.
                  name: 'codemirror',
                  test: /node_modules[\\/](@codemirror[\\/](?!(merge|lang-markdown|lang-sql)[\\/])|@lezer[\\/](?!markdown[\\/])|crelt[\\/]|style-mod[\\/]|w3c-keyname[\\/])/,
                },
                {
                  name: 'tanstack-db',
                  test: /node_modules[\\/](@tanstack[\\/](db|db-ivm|react-db|query-db-collection)|fractional-indexing)[\\/]/,
                },
                { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
                // The workspace opens its database with a top-level await,
                // which stops the bundler from folding small shared modules
                // into the chunks that use them. Left alone, each icon and
                // message shared by two parts of the site is a request of
                // its own. These three groups put them back together.
                //
                // What every page starts with: the router and the frame.
                { name: 'shell', tags: ['$initial'] },
                // Every icon is a few hundred bytes; all of them, a few kB.
                { name: 'icons', test: /node_modules[\\/]@tabler[\\/]/ },
                {
                  // Kept by the parts that use them, so no page loads every
                  // message, with the smallest sets joined to their nearest.
                  name: 'messages',
                  test: /[\\/]src[\\/]paraglide[\\/]messages[\\/]/,
                  entriesAware: true,
                  entriesAwareMergeThreshold: 10_000,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['url', 'baseLocale'],
    }),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    // Swaps react and react-dom for the TanStack Redact runtime.
    redact(),
  ],
})

export default config
