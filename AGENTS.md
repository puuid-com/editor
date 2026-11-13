# Project conventions

These instructions apply to every coding agent (Codex, Claude Code, others). `CLAUDE.md` imports this file.

Website template: TanStack Start on Cloudflare Workers, shadcn/ui, Tailwind v4, Paraglide i18n. Package manager is bun.

## Rules

- Use TanStack libraries (Router, Query, Form, Table, Store, DB) for what they cover, following their docs.
- UI uses shadcn/ui and Tailwind. Before building a component, check whether shadcn has it and install it with `bunx shadcn@latest add <name>`. Don't hand-write a replacement.
- Design follows https://vercel.com/design.md: Geist, monochrome tokens from `src/styles.css`, no decorative gradients or motion.
- Corners: controls `rounded-md`, menus and popovers `rounded-lg`, dialogs and the workspace sheet `rounded-xl`. No `rounded-none` on a control, and no all-caps labels.
- The editor's shell is the shadcn `Sidebar` (inset variant) in `FileExplorer.tsx` beside one sheet. Every setting (theme, wrap, font, sidebar side, format, defaults, variables, profiles) lives in the Settings popover in `StatusBar.tsx`: global ones in its General tab, the rest in the profile tabs. The sidebar footer keeps only the archive and version; the open file's actions go in `StatusBar.tsx`.
- Import from `src` with the `#/` alias (`#/lib/utils`, `#/components/ui/button`).
- Every user-facing string goes in `messages/en.json` and `messages/fr.json` and is used through `m.key()`. Don't hardcode copy.
- Every page route sets `head: () => seo({ title, path })`. Public pages also go in `site.sitemapPaths`.
- Markdown that shows in both the preview panel and the editor (live preview included) takes its look from one shared class in `src/styles.css`, like `.md-inline-code`. Don't restyle it separately in prose utilities or CodeMirror themes, or the two drift apart.
- Server-only code lives in `*.server.ts` files. Read env through `#/env.server`.
- Don't edit generated files: `src/routeTree.gen.ts`, `src/paraglide/`, `worker-configuration.d.ts`.

## Versioning

- Every commit bumps `version` in `package.json` and adds an entry at the top of `CHANGELOG.md` in the same commit: `## [x.y.z] - YYYY-MM-DD`, then `### Added`, `### Changed` or `### Fixed` with short user-facing bullets.
- Major for breaking changes to stored data, share links or file formats; minor for new features and visible behavior changes; patch for fixes, refactors, docs and tooling.
- If several commits go out together, each still gets its own version and entry.
- A release that changes something users can see also gets a picture on the changelog page: add its version to `previews` in `src/components/changelog/previews.tsx`. Use a `BeforeAfter` pair when it changes something that existed, a single `Shot` when it adds something new. Build it from the parts in `src/components/changelog/kit.tsx` (`Code`, `Tabs`, `StatusBar`, `Chip`…), keep it small and static, and reuse existing `m.*` labels. Tooling, docs and refactor releases get none. `previews.test.ts` fails if a preview's version isn't in `CHANGELOG.md`.
- `src/lib/version.test.ts` fails if the newest changelog entry doesn't match `package.json`.

## Checks

Before committing, run `bun run check`, `bun run lint`, `bun run knip`, `bun run typecheck` and `bun run test`. CI runs the same checks plus `bun run build`. Knip fails on unused files, exports and dependencies: delete dead code rather than silencing it, and only add to `knip.json` for files used outside the import graph.

## Git

After each task, commit and push to `main` without waiting to be asked. Pushing `main` runs the versioned `.githooks/pre-push` hook (installed by `bun install`), which runs the CI checks and then deploys with `bun run deploy`; if either fails the push is aborted, so fix the failure and push again. Don't use `--no-verify` unless told to.

For behavior tweaks the user hasn't confirmed, don't commit until they approve. If they reject it, discard the working-tree changes (`git restore`) instead of reverting.

## Finishing a task (required, not optional)

A task is not done until every step below is complete. Do them yourself, without being asked, and don't end your turn with uncommitted or unpushed work.

1. Bump `version` in `package.json` (major/minor/patch as above).
2. Add the matching `## [x.y.z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md`, with today's date. If the change is visible, add its changelog preview (see Versioning) and check it in light and dark.
3. Run `bun run check`, `bun run lint`, `bun run knip`, `bun run typecheck` and `bun run test`; fix anything that fails.
4. Commit only the files for this task with a concise imperative subject (≤72 chars) and a body explaining what changed and why.
5. `git push origin main`. If the pre-push hook fails, fix the cause, amend or add a commit (with its own version and changelog entry), and push again.
6. In your final message, report the new version, the commit hash and whether the push and deploy succeeded.
