# XML Editor

A browser-based XML, JSON, TXT, SQL and ZPL editor with a synchronized structure tree, file tabs, formatting, comparisons, and reusable profiles. Files and settings are saved in the browser; ZPL previews send label content to Labelary; there are no accounts or server-side document storage.

## Develop

```bash
bun install
bun run dev
```

Open http://localhost:3000. Installation compiles the English and French messages and generates Cloudflare binding types.

## Features

- Edit XML and JSON in CodeMirror, or edit values in the searchable structure tree.
- Open multiple files, retain undo history across tabs, and compare two files.
- Keep formatting settings, tag highlights, pinned fields, defaults, and variables in profiles.
- Open files from disk and save back where the browser supports file handles.
- Archive closed files, export workspace backups, and restore them later.
- Share a document and optional profile settings through a link.

## ZPL and mixed panes

Open up to four editable files side by side through a tab’s **Open side by side** action or a pane’s **Add pane** menu. The selected file controls shared actions and the structure panel. On phones, tabs switch between files. Pane selection survives reloads.

ZPL tools come from `puuid-com/zpl` at `766a928` (v0.35.1): multi-label previews, command explanations, lint warnings, per-file size/density, zoom and synchronized scrolling, visual comparisons, PNG/ZIP/PDF export, base64 decoding and compressed sharing. Labelary requests are queued 350 ms apart; jobs display their first 50 labels.

Both compressed `#zpl=…` and `#base64=…` / `?base64=…` links work, with optional `dpmm`, `w`, and `h`. Existing XML share links and backups remain valid. ZPL settings travel with new shared files and backups. Marked base64 label fields open beside their source document.

## State and persistence

TanStack DB collections keep files, profiles, and rules in IndexedDB and synchronize changes across browser tabs. The route waits for `workspaceReady()` before mounting the editor. Older localStorage workspaces are migrated on startup.

TanStack Store holds UI and session state. CodeMirror owns the live document, selection, and undo history. `editor-session.ts` coordinates file switching, cached editor states, and collection updates; `editor-store.ts` exposes parsed documents and cursor state to the rest of the interface.

Content edits update optimistically and persist after a 400 ms typing pause. Collection mutators expose TanStack transactions when a caller needs to await `isPersisted.promise`; profile creation, cloning, and deletion return promises. Forms retain their drafts on failed writes and confirm saves only after persistence succeeds. Multi-collection operations are not a single atomic IndexedDB transaction; backup restore attempts to roll back completed writes on failure.

## Project layout

```text
src/
  components/
    app/                  Workspace layout, panes, tabs, dialogs, commands, notices
    editor/               CodeMirror setup, sessions, actions, disk saves
    inspector/            Structure tree: search, navigation, row rendering
    pins/                 Pinned fields above the tree
    flat/                 Records table for fixed-width text files
    highlights/           Tag highlight colours and menus
    defaults/, variables/ Default-value rules and variable values
    profiles/             Profile controls and dialogs
    compare/              Document comparisons
    zpl/                  ZPL label previews, settings, exports
    changelog/            Before/after pictures shown on the changelog page
    showcase/             About page feature grid (vendored stageshow kit)
    layout/               Public site header and footer
    ui/                   shadcn/ui components
  hooks/                  TanStack live queries and shared React hooks
  lib/
    store/                Collections, persistence, migration, backups
    xml/                  XML parsing, formatting, editing, variables
    json/                 JSON parsing, formatting, editing
    sql/                  SQL formatting and token roles
    flat/                 Fixed-width record parsing
    zpl/                  ZPL rendering, explanations, sharing, export
    document.ts           One entry point per language: detect, parse, format
  routes/                 Editor and public routes
  site.ts                 Site identity and SEO configuration
  server.ts               Paraglide middleware around TanStack Start
messages/                 English and French translations
public/                   Icons and static assets
```

## Checks and scripts

| Command                   | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `bun run dev`             | Development server on port 3000                             |
| `bun run build`           | Production build                                            |
| `bun run preview`         | Preview the production build                                |
| `bun run test`            | Vitest tests, including IndexedDB and component coverage    |
| `bun run test:watch`      | Watch tests                                                 |
| `bun run typecheck`       | TypeScript validation                                       |
| `bun run lint`            | ESLint                                                      |
| `bun run knip`            | Unused files, exports and dependencies                      |
| `bun run check`           | Prettier validation                                         |
| `bun run format`          | Apply Prettier and ESLint fixes                             |
| `bun run doctor`          | Additional React diagnostics; inspect findings individually |
| `bun run generate-routes` | Regenerate the TanStack route tree                          |
| `bun run i18n:compile`    | Regenerate translated message functions                     |
| `bun run cf-typegen`      | Regenerate Cloudflare binding types                         |
| `bun run icons`           | Render PNG app icons from `public/favicon.svg`              |

CI runs formatting, lint, unused-code checks, type checking, tests, and the production build. Tests use `fake-indexeddb`; editor-session tests exercise independent database connections, remote edits, undo history, and restore rollback. Browser checks still need a reproducible harness.

## Conventions

Use the appropriate TanStack libraries, shadcn/ui, and Tailwind CSS. Follow [Vercel's design guidelines](https://vercel.com/design.md). Check for an existing shadcn component before adding UI; install new primitives with `bunx shadcn@latest add <component>`.

Import application code through `#/`. Add user-facing strings to both `messages/en.json` and `messages/fr.json`. Do not edit generated files in `src/paraglide/`, `src/routeTree.gen.ts`, or `worker-configuration.d.ts`.

Every commit bumps `package.json` and adds a `CHANGELOG.md` entry. Releases with a visible change also get a small static preview in `src/components/changelog/previews.tsx`, keyed by version: a before/after pair for changes, a single shot for new features. See [AGENTS.md](AGENTS.md) for the full release steps.

Public routes set their SEO metadata through `seo()` and belong in `site.sitemapPaths`. To add a locale, update `project.inlang/settings.json`, add its messages, and update `localeNames` in `LocaleSwitcher.tsx`.

## Deploy

Set the production identity and URL in `src/site.ts`, and review `wrangler.jsonc` for the target Worker. Server environment variables are validated in `src/env.server.ts`; use `.dev.vars.example` for local configuration.

```bash
bunx wrangler login
bun run deploy
```

`public/sw.js` removes the old offline service worker and its caches. Keep it until older installs have had time to update.
