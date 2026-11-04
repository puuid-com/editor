# Feature roadmap

Ten features, most important first. The ranking weighs how much work each one saves, or how much damage it prevents, against how often it comes up. Data safety comes first: the editor is local-first, so a corrupted or lost file has no server copy to fall back on.

Each task follows [AGENTS.md](AGENTS.md): shadcn/ui components, strings in `messages/en.json` and `messages/fr.json`, a version bump, a changelog entry and, for visible changes, a changelog preview.

**Model guide.** Haiku 5.5 for mechanical, fully specified changes. Sonnet 5.5 for feature work that follows existing patterns. Opus 5.5 for work that touches stored data, synchronization or a new engine. Effort (low, medium, high, xhigh, max) scales with how many edge cases the task has to reason through.

| #   | Feature                                    | Model · effort      |
| --- | ------------------------------------------ | ------------------- |
| 1   | Keep each file's encoding and line endings | Opus 5.5 · medium   |
| 2   | Local version history                      | Opus 5.5 · high     |
| 3   | Schema validation per profile              | Opus 5.5 · high     |
| 4   | XPath and JSONPath queries                 | Sonnet 5.5 · high   |
| 5   | Table view for repeating records           | Sonnet 5.5 · high   |
| 6   | Generate files from a data table           | Sonnet 5.5 · medium |
| 7   | Redact sensitive fields when sharing       | Sonnet 5.5 · medium |
| 8   | Edit embedded documents in place           | Opus 5.5 · xhigh    |
| 9   | Parse large files off the main thread      | Opus 5.5 · high     |
| 10  | Convert between XML and JSON               | Sonnet 5.5 · high   |

## 1. Keep each file's encoding and line endings

**What.** Detect the encoding of every opened file from its byte-order mark, its XML declaration (`encoding="…"`) and a strict UTF-8 check that falls back to Windows-1252. Decode with `TextDecoder`, store the encoding, BOM and line-ending style on the file, and write the same kind of bytes back on Save, Save as and Download. Show the encoding and line endings in the bottom bar, with "Reopen with encoding…" and "Save with encoding…" in the command menu. Warn before saving characters the target encoding can't hold.

**Why.** Files are read with `file.text()` in `src/components/app/files.ts`, which always decodes UTF-8, and `src/components/editor/disk.ts` writes the string back as UTF-8. A Windows-1252 flat file containing `Montréal` opens as `Montr�al`, and saving writes the replacement character over the original: permanent, silent data loss. UTF-16 files from Windows and .NET tools open as unreadable text. CodeMirror also normalizes line breaks to `\n`, and `CodeEditor.tsx` stores `doc.toString()`, so the first edit turns a CRLF file into LF on disk, which some systems that read flat files reject.

**Model.** Opus 5.5 · medium. The code is small and testable, but it sits on the save path, where a mistake corrupts users' files.

**Pros.**

- Stops the editor from silently damaging files on disk.
- Mostly pure decode and encode functions with unit tests; no new dependency.
- Matches what VS Code and other desktop editors do.

**Cons.**

- Detection is a heuristic: a short file can be valid in several encodings, so a manual override is required.
- Windows-1252 needs a small hand-written encoder, since `TextEncoder` only writes UTF-8.
- Adds fields to stored file rows; backups and share links must treat old rows as UTF-8 with LF.

## 2. Local version history

**What.** Keep automatic snapshots of each file in IndexedDB: when it is opened, before every whole-file action (Format, Apply defaults, Replace variables, Change type, Restore from backup), on each save to disk, and every few minutes while typing. A History list per file shows the time and the trigger; picking a snapshot opens it in the existing compare view against the current content, with an undoable Restore. Store a snapshot only when the content changed, cap the count per file and prune the oldest.

**Why.** Undo history lives in memory (the `states` map in `src/components/editor/editor-session.ts`), so a reload, a crash or a closed browser drops it. The archive keeps only the last 10 closed files. Nothing lets you see how a file looked an hour ago, and whole-file actions rewrite everything at once.

**Model.** Opus 5.5 · high. A new persisted collection with storage limits, pruning, cross-tab sync and backup rules.

**Pros.**

- A safety net under every destructive action, which makes bulk actions safe to use.
- Reuses the compare view and the TanStack DB collection pattern.
- Answers "what did this payload look like before I changed it?" without git.

**Cons.**

- Storage grows; the workspace already has to handle "browser storage is full", and history must never be the cause.
- Snapshots keep values the user deleted, such as tokens, so it needs a Clear history action and a decision on whether backups include it.
- Pruning and deduplication rules need care to stay predictable.

## 3. Schema validation per profile

**What.** Let a profile hold an XSD (with the files it imports and includes) or a JSON Schema. Validate as part of the existing parse loop and show problems in the lint gutter, the structure panel's Problems count and the bottom bar, with a way to jump to each one. JSON Schema uses a validator that doesn't rely on `eval`, such as `@cfworker/json-schema`. XSD uses libxml2 compiled to WebAssembly, such as `xmllint-wasm`, loaded only when a profile has an XSD. Later, the same schema can drive completion of tags, attributes and enum values.

**Why.** A profile already describes a kind of payload: its format, highlights, pins and defaults. Today the editor reports only well-formedness errors, so a document with a missing required element or a bad enum value looks fine until the receiving API rejects it. Carriers and partners publish XSDs for exactly this.

**Model.** Opus 5.5 · high, or xhigh if multi-file XSD imports are in scope. It brings a WebAssembly dependency, maps line-based errors to ranges and stores schema files.

**Pros.**

- Catches payloads that would be rejected, before they are sent.
- Fits the profile model and the existing lint gutter.
- The JSON Schema half is cheap and can ship first.

**Cons.**

- libxml2 in WebAssembly is a large download, so it must load only on demand.
- libxml2 supports XSD 1.0, not 1.1.
- `<<variables>>` in typed fields (`xs:int`, `xs:date`) need valid placeholder values before validating, or every template reports errors; the `maskVars` helpers in `src/lib/xml/vars.ts` are a starting point.

## 4. XPath and JSONPath queries

**What.** A Query view in the side panel, beside Structure, that runs XPath 1.0 on XML and JSONPath (RFC 9535) on JSON. Matches are listed with their path and value, light up in the editor and the tree, and can be stepped through with Enter. A node's menu gets "Query from here" next to Copy XPath, and named queries save to the profile. Queries run against the app's own model (`src/lib/xml/model.ts`), which keeps source offsets, so every match maps back to a range in the editor.

**Why.** Structure search matches names and values, but can't answer "every package heavier than 30 kg" or "shipments not going to Canada". The editor already copies XPath and JSONPath for a node; running them is the missing half. Queries are also the building block for path-based highlights and pins, redaction rules (7) and table views (5).

**Model.** Sonnet 5.5 · high with an existing engine; Opus 5.5 · high if we write our own evaluator over the model.

**Pros.**

- Read-only, so no risk to file content.
- A large gain for power users, and a foundation for several other features.
- Reuses the tree's search highlighting and navigation.

**Cons.**

- A full XPath engine, such as `fontoxpath`, is a sizeable dependency to load on demand; a hand-written subset is smaller but surprises people where it stops.
- Namespaced documents need prefix bindings in the UI.
- Two query languages to support, document and translate.

## 5. Table view for repeating records

**What.** When an XML element repeats under one parent (50 `<Package>` elements) or a JSON array holds objects, offer them as a table: one row per record, one column per child element, attribute or key. Reuse the TanStack Table setup from `src/components/flat/FlatRecords.tsx`: sort, filter, click a cell to select it in the editor, edit a cell to write it back, and copy or export as CSV, flat files included.

**Why.** Shipment manifests, line items and package lists are tables written as XML or JSON. Finding one wrong weight among 50 packages in a tree is slow, and the flat-file table already shows the pattern works.

**Model.** Sonnet 5.5 · high.

**Pros.**

- Reuses the table component, the virtualizer and the model's offsets.
- CSV export moves data to spreadsheets without copy and paste.
- Highly visible: good material for the changelog and the about page.

**Cons.**

- Records with different or nested shapes need column rules, such as dotted paths and a depth limit.
- Writing a cell back must keep entities, quoting and formatting intact.
- A document with several repeating groups needs a picker.

## 6. Generate files from a data table

**What.** Pick a template with `<<variables>>`, paste or import a CSV file or a JSON array, and get one file per row with that row's values filled in. Dynamic variables such as `<<$randomUUID>>` get a fresh value in each file. Preview the first rows before generating. Small batches open as tabs; large ones download as a ZIP, using the fflate library already used for label ZIPs. Values are escaped for the target language.

**Why.** Variables and Postman-style dynamic values show the editor is used to prepare test payloads, but a profile holds one value per variable. Thirty test cases mean thirty rounds of editing values and replacing.

**Model.** Sonnet 5.5 · medium.

**Pros.**

- Reuses variable replacement, its preview dialog and ZIP export.
- Low risk: output goes to new files, never over the template.
- Saves a lot of time in QA and integration testing.

**Cons.**

- CSV parsing has edge cases: quoted fields, `;` separators from French-locale spreadsheets, and encodings (see 1).
- Hundreds of tabs would swamp the workspace, so the ZIP threshold must be sensible.
- Escaping must be right for XML text, XML attributes and JSON strings.

## 7. Redact sensitive fields when sharing

**What.** A per-profile list of sensitive tags, keys or `@attributes`, such as `Password`, `AccountNumber` or `ApiKey`, with common names suggested. Share links, a "Copy for sharing" action and, optionally, downloads replace those values with a `<<variable>>` of the same name, so recipients fill them in from their own profile. The share dialog lists what it will hide. An optional toggle masks the values on screen without changing the file.

**Why.** A share link carries the whole file, and anyone with the link can read it. The share dialog warns about variable values, but not about credentials or account numbers written in the document itself, which carrier API payloads usually contain.

**Model.** Sonnet 5.5 · medium.

**Pros.**

- Cheap: the list works like default values, and the edit helpers already exist.
- Turning secrets into variables matches how the editor already works.
- Limits the damage of a link pasted into the wrong chat or ticket.

**Cons.**

- Name-based rules miss secrets stored elsewhere, so the UI must not promise more than it does.
- On-screen masking must never leak into stored content or undo history.
- One more per-profile list to maintain.

## 8. Edit embedded documents in place

**What.** Generalize "Open label side by side" (base64 ZPL) to any document nested in a value: escaped XML (`&lt;Order&gt;…`), a CDATA section, a JSON string holding JSON, or base64 XML or JSON. "Open embedded document" decodes it into a linked tab with every editor feature. Edits are encoded again and written back to the exact source range as one undo step in the parent. The linked tab warns and detaches if its source range is edited or deleted.

**Why.** SOAP envelopes, webhook payloads and message queues routinely carry a document inside a document. Today the loop is copy, unescape elsewhere, edit, escape again and paste back, and each step can corrupt the payload.

**Model.** Opus 5.5 · xhigh. Two-way synchronization, tracking a range through edits in the parent, and undo across two files.

**Pros.**

- A feature few browser XML tools have.
- Builds on the ZPL side-by-side, pane and base64 detection code.
- Removes a manual loop that often corrupts payloads.

**Cons.**

- The hardest synchronization problem on this list: both sides can change, including from another browser tab.
- Escaping differs by context: attribute, text, CDATA containing `]]>`, JSON string.
- Nested levels, such as a document embedded in an embedded document, multiply the cases.

## 9. Parse large files off the main thread

**What.** Run parsing and formatting in a Web Worker, with versioned results so a stale parse is never shown. Above a size threshold, switch to a large-file mode: a longer pause before re-parsing, no per-pass decorations such as default marks and long-value shortening, and a structure tree built on demand. Show the mode in the bottom bar.

**Why.** The linter in `src/components/editor/extensions.ts` re-parses the whole document 150 ms after every typing pause, on the main thread. A quick benchmark of `parseDocument` with Bun took about 0.2 s for 1.5 MB, 0.7 s for 6 MB and 2.3 s for 18 MB of XML, so multi-megabyte exports freeze the editor after each pause. Move this up the list if users regularly open files that size.

**Model.** Opus 5.5 · high.

**Pros.**

- Typing stays smooth whatever the file size.
- The parser is already a pure text-to-model function, so it moves to a worker cleanly.
- Formatting, schema validation (3) and queries (4) can later run in the same worker.

**Cons.**

- Sending the model back costs time in proportion to its size, so it may need a leaner transfer format.
- Asynchronous results complicate code that reads the model right after an edit.
- Worker bundling with Vite and Cloudflare needs setup and testing.

## 10. Convert between XML and JSON

**What.** "Convert to JSON" and "Convert to XML" in the command menu and the tab menu, always into a new tab. The conversion follows a documented convention: attributes as `@name`, text as `#text`, repeated elements as arrays, namespace prefixes kept. Options cover elements that are always arrays and whether numbers and booleans get typed. `<<variables>>` pass through untouched.

**Why.** Integration work moves between the SOAP and REST versions of the same API. Today that means pasting payloads into third-party converter sites, which breaks the editor's promise that content stays in the browser.

**Model.** Sonnet 5.5 · high.

**Pros.**

- Self-contained pure functions that are easy to test.
- Output goes to a new tab, so the source file is never at risk.
- Keeps sensitive payloads away from third-party sites.

**Cons.**

- XML to JSON loses information by nature: mixed content, comments, processing instructions, and one item versus an array.
- Round trips won't always be exact, and the convention must say so.
- Namespaces, including default namespaces, need careful rules.
