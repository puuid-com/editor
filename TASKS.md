# Five features to add

Reviewed on 2026-11-08 against version **1.28.0**, commit `c07553e`. This replaces the previous ten-feature roadmap. All five tasks below are proposals, in recommended implementation order.

The current site edits XML, JSON, fixed-width records, SQL, ZPL, Markdown and plain text, and previews images. It already has profiles, variables, defaults, a structure tree, file comparisons, backups and share links. Recent additions include folders edited directly on disk, Obsidian links and embeds, Markdown table tools, and note/folder PDF export. This plan is based on the implementation and [changelog](CHANGELOG.md), including those newer features.

**Model and effort** mean the coding model and its reasoning setting for implementing the task, not an AI feature inside the editor or a delivery-time estimate. The choices below are engineering recommendations, informed by [OpenAI's model-selection guidance](https://developers.openai.com/api/docs/guides/model-selection) and [reasoning-effort documentation](https://developers.openai.com/api/docs/guides/reasoning). Sol is the starting point for bounded feature work; Astra is recommended here for the tasks with more persistence or validation edge cases. These settings have not been benchmarked on this repository.

| Order | Feature                                | Recommended model           | Reasoning effort |
| ----- | -------------------------------------- | --------------------------- | ---------------- |
| 1     | Local version history and restore      | GPT-6 Astra (`gpt-6-astra`) | `high`           |
| 2     | Full-text search across workspaces     | GPT-6.1 Sol (`gpt-6.1-sol`) | `medium`         |
| 3     | Markdown backlinks and link checks     | GPT-6.1 Sol (`gpt-6.1-sol`) | `high`           |
| 4     | Saved XPath and JSONPath queries       | GPT-6.1 Sol (`gpt-6.1-sol`) | `high`           |
| 5     | Schema validation attached to profiles | GPT-6 Astra (`gpt-6-astra`) | `high`           |

## 1. Local version history and restore

- [ ] Implement local version history for editable text files.

**The feature.** Give each file a history of earlier contents that survives a reload. Users can inspect a timestamped version, compare it with the current file, then restore it or open it as a separate copy. For example, recover a note or XML payload from before a mistaken formatting or variable-replacement action.

**Why add it now.** Undo survives tab switches through an in-memory map in [editor-session.ts](src/components/editor/editor-session.ts), but does not survive a reload. The [deleted-file archive](src/lib/store/files.ts) retains up to ten deleted files, not earlier revisions of a file. Disk workspaces also save edits automatically. History would complement the existing backups and disk-conflict handling with recovery from an unwanted edit, using the [comparison UI](src/components/compare/CompareView.tsx) to review what will change.

**First release.**

- Save a baseline, snapshots before whole-file transformations or reload-from-disk, and spaced checkpoints while contents change. Deduplicate identical snapshots.
- Store revisions in a TanStack DB collection backed by IndexedDB, with per-file and total byte limits, pruning, and a clear-history action. A failed history write must not block normal editing or saving.
- Compare a snapshot without creating a permanent workspace file. Restore through one undoable editor transaction; disk-backed restores must respect the existing conflict checks and explain that autosave will update the disk file.
- Keep history local and out of share links and workspace backups in this first release. Retain it across tab closure and file renaming, including reopening a disk file; clear it when its retained file record is permanently removed. Document that clearing browser data removes history too.

**Model + effort: GPT-6 Astra, `high`.** The difficult part is persistence: snapshot timing, stable file identity, cross-tab updates, quota failures, and safe restoration while disk autosave is active. A stronger reasoning model is justified by the risk of losing the revision being recovered.

**Done when.** A revision can be restored after reloading the app, restore can be undone, renaming does not orphan history, concurrent browser tabs do not overwrite snapshots, and quota/pruning tests prove normal file saves still work.

## 2. Full-text search across workspaces

- [ ] Add content search across browser files and connected disk folders.

**The feature.** Search for text inside all editable files and display results grouped by workspace and file, with a line number and excerpt. Selecting a result opens the file at the match. A user could find an order number across JSON payloads, XML messages, Markdown notes and ZPL labels without opening each file.

**Why add it now.** The explorer already searches across folders, but [FileExplorer.tsx](src/components/app/FileExplorer.tsx) and [DiskWorkspace.tsx](src/components/app/DiskWorkspace.tsx) filter filenames or paths. CodeMirror searches the current document. With multiple disk workspaces and Obsidian vaults now supported, searching their contents is the missing step. Existing [disk queries](src/components/app/disk-queries.ts) provide a starting point for discovery and refresh.

**First release.**

- Support literal text, case sensitivity, whole words, and a workspace/folder scope. Search browser files and readable text files in connected folders; exclude archived files, images, unsupported binaries and the vault's excluded paths.
- Search the latest editor contents for open files and disk contents for unopened files, avoiding duplicate results for open disk files.
- Use TanStack Query for asynchronous disk reads, TanStack Pacer for input pacing, and TanStack Virtual for long result lists. Bound file reads and result counts, allow cancellation, and show skipped or unreadable files instead of implying the scan was complete.
- Keep the first release read-only. Cross-file replacement would require a separate design for partial writes and recovery.

**Model + effort: GPT-6.1 Sol, `medium`.** This is a bounded extension of existing file discovery and editor navigation. The main integration work is combining live buffers with disk reads and preventing stale search results; it does not change stored document formats or write to multiple files.

**Done when.** Results include unopened files and unsaved edits, selecting a result lands on the correct text, excluded paths stay excluded, and cancellation, refresh and revoked disk permissions leave the UI responsive and truthful.

## 3. Markdown backlinks and link checks

- [ ] Add incoming-link navigation and a local link-problems list for notes.

**The feature.** Show which notes link to or embed the current note, with a snippet and a jump back to the source. Also list unresolved local note/image links and missing heading or block targets. Before exporting a folder to PDF, users could find the references that would otherwise be incomplete.

**Why add it now.** The editor already resolves `[[wikilinks]]`, relative links, images, whole-note embeds, heading embeds and block embeds. [note-links.tsx](src/components/markdown/note-links.tsx) already fades missing wikilink targets, so basic missing-link styling is not new. What is missing is a reverse view of incoming references and a collected list of link problems. These would make the recent Obsidian and folder-PDF features more useful as a note collection grows.

**First release.**

- Index Markdown in one connected disk workspace at a time, reusing the resolution rules in [obsidian.ts](src/lib/obsidian.ts). Respect vault exclusions and prefer open files' live contents.
- Recognize wikilinks, local Markdown links and embeds, including aliases, headings and block IDs. Use parsed Markdown so examples inside code blocks and inline code do not become references.
- Add Backlinks and Link problems views with source excerpts and keyboard navigation. Recompute affected results after edits, renames or a folder refresh; show indexing and unavailable-file states.
- Report local targets only. External-site checking, a graph view, and automatic link rewrites are outside this first release.

**Model + effort: GPT-6.1 Sol, `high`.** The interface can reuse existing components, but correctness depends on aliases, relative paths, duplicate note names, embedded sections, live edits and cache invalidation. The higher effort is for those resolution cases.

**Done when.** Incoming references navigate to their source, missing files and sections are distinguished, code examples are ignored, and tests cover aliases, duplicate names, unsaved edits and renamed targets without changing the notes.

## 4. Saved XPath and JSONPath queries

- [ ] Let users run and save queries against XML and JSON documents.

**The feature.** Add a Query view that selects structured data by a condition, lists the matching paths and values, and jumps to their source. For example, `//item[price > 100]` selects XML items by price, while a JSONPath filter can select orders whose status is pending. Save useful queries with the active profile and rerun them on similar files.

**Why add it now.** The tree already offers [Copy XPath, JSONPath and JSON Pointer](src/components/inspector/CopyPathMenuItems.tsx). Its [search](src/components/inspector/tree-search.ts) matches names, attributes and values as text, so it cannot express those conditions. Running the copied paths completes an existing workflow. The [document model](src/lib/xml/model.ts) already carries source offsets that can support precise result navigation.

**First release.**

- Use established evaluators for XPath 1.0 and JSONPath, documenting the selected engine's supported JSONPath syntax. Do not promise conformance without tests or implement a new query language.
- Show node results with paths, values and counts, and scalar XPath results as values. Map node matches to the original source; handle XML namespaces explicitly rather than stripping prefixes.
- Add a tree action that seeds a query from the copied path. Store named queries per profile through TanStack DB and extend profile clone/delete and backup handling with backward-compatible defaults. Leave saved queries out of share links initially.
- Keep evaluation read-only, cancellable and bounded. Invalid queries, malformed documents and unresolved template variables must have clear states rather than fabricated results.

**Model + effort: GPT-6.1 Sol, `high`.** Existing evaluators keep the work manageable, but matching their results back to source ranges and handling namespaces, repeated nodes and JSON keys require careful adapters and tests.

**Done when.** Copied paths select their original nodes, filters return the expected records, selecting a match reveals the correct source, named queries survive reload and profile operations, and old backups still restore.

## 5. Schema validation attached to profiles

- [ ] Add profile-based document validation, starting with JSON Schema.

**The feature.** Attach a schema to a profile and show whether the active payload satisfies its required fields, types and allowed values. Problems appear in a list and the editor gutter, with a jump to the affected field. For example, report a missing `customerId` or an invalid `status` even when the JSON parses successfully.

**Why add it now.** [Profiles](src/lib/store/profiles.ts) already group formatting, highlights, pins, defaults and variables for a kind of document. [Editor diagnostics](src/components/editor/extensions.ts) currently use parsing errors, which check syntax rather than a partner's payload requirements. A schema adds a correctness check to the same reusable profile workflow. The Zod schemas used internally for workspace storage do not validate users' payloads.

**First release.**

- Start with JSON Schema and explicitly document the supported dialect. Allow local schema import, replacement and removal through profile settings, with references resolved only from the supplied schema bundle.
- Run validation after a typing pause with stale-result cancellation, and map reported JSON locations to the existing source-aware model. For missing properties, point to the parent object. Keep syntax and schema problems distinguishable.
- Persist schemas with TanStack DB and include them in profile cloning, deletion and workspace backups. Old profiles have validation disabled; schemas stay out of share links initially.
- Treat unresolved template variables as an incomplete validation state. Load the validator only when needed and perform validation locally. XML/XSD support is a later extension of this feature, requiring its own browser-engine compatibility investigation; it is not part of the first-release commitment.

**Model + effort: GPT-6 Astra, `high`.** Validator selection, reference resolution, diagnostic mapping, template variables and stored-profile compatibility cross several subsystems. Extra reasoning should focus on avoiding false success and preserving existing profiles and backups.

**Done when.** Valid JSON can still fail schema validation, fixing a value clears its error, malformed or unsupported schemas have explicit errors, unresolved variables cannot produce a false pass, and older profiles and backups load unchanged.

## Implementation rules for every task

Follow [AGENTS.md](AGENTS.md). Use the appropriate TanStack libraries and their official documentation; check shadcn/ui before building a component and install missing primitives through its CLI. Keep the existing Geist, Tailwind tokens and [Vercel design conventions](https://vercel.com/design.md), with English and French messages and keyboard-accessible controls.

Each implementation needs focused regression coverage, a version bump and changelog entry, a light/dark changelog preview for its visible changes, and all required checks before committing and pushing. The release that only replaces this planning document is a patch and needs no visual preview.
