# Changelog

Every change bumps `version` in `package.json` and adds an entry here, newest first. The version shows in the editor's bottom bar and the site footer.

- **Major**: breaking changes to stored data, share links or file formats.
- **Minor**: new features and visible behavior changes.
- **Patch**: fixes, refactors, docs and tooling.

Visible changes also get a picture on the changelog page: add the version to `previews` in `src/components/changelog/previews.tsx`.

## [1.45.0] - 2026-11-10

### Added

- Live preview shows a note embedded with `![[note]]` alone on its line as that note's text, or the part `![[note#heading]]` names, as the preview panel does. Put the caret on it to edit its Markdown; links in the embedded note still open.

## [1.44.0] - 2026-11-10

### Added

- Live preview shows a note's images in place of their Markdown, `![alt](src)` and `![[image.png|300]]` alike, read from the note's folder as the preview panel does. Put the caret on one to edit its Markdown, with the image still showing after it. A line of images alone follows the Center menu.

## [1.43.1] - 2026-11-10

### Fixed

- Images pasted into a note of an Obsidian vault go where the vault's attachment setting says: the vault root, the note's own folder, or a subfolder of it. Before, those settings fell back to `attachements/img`.

## [1.43.0] - 2026-11-09

### Added

- Center menu in the bottom bar of Markdown files: pick tables, images, code blocks and Mermaid diagrams to sit in the middle of the page, in the preview and PDF. Live preview centers tables. Diagrams stay centered by default; turned off, they sit at the start.

## [1.42.0] - 2026-11-09

### Added

- Times New Roman in the font menu: Markdown text in the editor, preview and PDF takes it, while code, inline code and code files stay monospace. The menu is now called Font.

## [1.41.1] - 2026-11-09

### Fixed

- Clicking beside a table in live preview puts the caret on the line under it, instead of a caret as tall as the table.

## [1.41.0] - 2026-11-09

### Changed

- Show Markdown tables as a framed sheet with column letters, numbered rows and striped rows, in the preview and live preview.

## [1.40.2] - 2026-11-09

### Fixed

- Pad inline code in Markdown live preview and its tables the same as in the preview panel.

## [1.40.1] - 2026-11-09

### Fixed

- Show line numbers for code fence lines in Markdown live preview.

## [1.40.0] - 2026-11-09

### Added

- Highlight the drop destination and dim the dragged file while moving explorer files.

## [1.39.1] - 2026-11-09

### Fixed

- Markdown, text, SQL, ZPL and fixed-width files no longer show empty fold and error columns beside the line numbers.

## [1.39.0] - 2026-11-09

### Added

- Drag files into folders or back to the root of an opened device folder to move them on disk.

### Fixed

- Dropping browser files onto another file or folder contents now uses that containing folder.

## [1.38.1] - 2026-11-09

### Fixed

- Opening shared links in quick succession keeps the newest file and its profile choices; a late result from an older link cannot replace it or clear the new link.
- Failed file operations release their busy state so you can retry. PDF exports check image responses before using them.

### Changed

- Reuse tab ordering and folder traversal across the explorer, split panes and PDF exports; clean up effect dependencies and compiler warnings without changing the editor layout.
- Remove test-environment scrolling warnings and cover shared-link races, deletion retries, folder traversal and synchronized zoom with regression tests.

## [1.38.0] - 2026-11-09

### Changed

- Closing the tab of a file kept in the browser no longer deletes it. The file stays in the explorer, dimmed, and opens again in a tab when you click it.
- Deleting a browser file is now its own action: "Delete…" in the file's explorer menu moves it to Deleted files, after asking.

## [1.37.1] - 2026-11-09

### Changed

- Agent instructions: unconfirmed experimental changes stay uncommitted until approved, and rejected ones are discarded instead of reverted.

## [1.37.0] - 2026-11-09

### Changed

- Table cells in live preview show their formatting: bold, italic, struck and highlighted text, inline code (colored code too) and links as their text. Click a cell to edit its Markdown as written; it is drawn again when you leave it.

## [1.36.0] - 2026-11-09

### Added

- Live preview shows code blocks and tables as they render, and you edit them in place. A code block shows just its code, with its language in a header you can rename. A table is a grid: click a cell and type.
- In a table, Tab and Enter move between cells and add a row at the end, the arrow keys move around and out, and the table toolbar adds, aligns and deletes rows and columns.

### Changed

- In live preview, fences, pipes and the row under a table's header never show. The arrow keys step over them, and typing next to a block starts a new line instead of breaking it.

## [1.35.0] - 2026-11-09

### Added

- Live preview for Markdown, as in Obsidian: turn it on from the bottom bar or the command menu and notes render right in the editor, with no preview panel. Headings lose their `#`, bold and italic their stars, links show only their text, bullets and rules are drawn, and tasks become checkboxes you can tick.
- Click or move the caret into any part to see and edit its real Markdown: the line for headings, quotes and lists, the span for bold, code and links.

## [1.34.0] - 2026-11-09

### Changed

- Colored inline code reads like normal code in the editor: `<code style="color: red">deploy</code>` shows as `deploy` between backticks, in its color. Put the caret in it, or select it, to see and edit the real tag.

## [1.33.0] - 2026-11-09

### Changed

- Colored inline code is now an HTML tag: `<code style="color: red">deploy</code>`. Obsidian and VS Code show the color too, and GitHub shows plain code. The `{.red}` tag from 1.32.0 no longer colors code.
- Click inline code in the editor or the preview to pick its color from the palette. The source is rewritten for you, and the droplet button makes it plain code again.
- Code with any other CSS color, like `#ff8800`, shows in that color too, in light and dark mode.

## [1.32.0] - 2026-11-09

### Added

- Color inline code in Markdown with a tag right after it: `` `deploy`{.red} ``. Blue, purple, pink, red, amber, green, teal and gray work in the editor, the preview and PDF exports. Code without a tag stays blue.
- Type `{` right after inline code to pick a color from a list.
- The tag is Pandoc's attribute syntax, so other Markdown apps still show the code, followed by `{.red}` as plain text.

## [1.31.0] - 2026-11-09

### Changed

- Switching tabs now shows the file in the explorer: its workspace and folders open and the list scrolls to it, for browser files and files in folders opened from disk.

## [1.30.0] - 2026-11-08

### Added

- Choose the font for code from the new menu in the bottom bar or the command menu: Geist Mono, as before, or Ioskeley Mono. The choice applies to every file and profile, and to code in exported PDFs.

## [1.29.0] - 2026-11-08

### Changed

- XML, JSON and ZPL files now use the same colors as SQL: blue for tags that hold other elements and for ZPL commands, teal for other tags, purple for attributes, red for values, amber for numbers and green for comments. The structure tree matches.
- Text between tags and Markdown prose stay neutral.

## [1.28.1] - 2026-11-08

### Changed

- Replace the previous feature roadmap with five scoped proposals based on the current editor, including their rationale, acceptance criteria, and recommended coding models and reasoning effort.

## [1.28.0] - 2026-11-08

### Changed

- Tables in the Markdown preview and PDF export have a border all around and between every row and column, with a shaded header row.

## [1.27.0] - 2026-11-08

### Added

- Markdown tables are easier to write in the editor. Type `/table` on an empty line and pick a size from a grid, or end a line like `| Name | Role |` with Enter to turn it into a table.
- In a table, Tab and ⇧Tab move between cells, Tab past the last cell adds a row, Enter adds a row below, and Enter on an empty last row leaves the table. Columns stay aligned as you type.
- A toolbar above the table you're in adds rows and columns, aligns the current column, and deletes the row, the column or the table.

## [1.26.0] - 2026-11-08

### Changed

- The Markdown editor now strikes through `~text~` as it does `~~text~~`, matching the preview.

## [1.25.0] - 2026-11-08

### Changed

- Format (and format on save) on a Markdown file now lays out the text too, to the Prettier and markdownlint standards: `#` headings, `-` bullets, `_emphasis_` and `**strong**`, one blank line between blocks, aligned tables, bare links in `<>` and no trailing spaces. Lines aren't rewrapped, and Obsidian links, embeds, callouts and front matter stay as written.

## [1.24.0] - 2026-11-08

### Changed

- The bottom bar's Settings button shows on every file type. SQL, Markdown, ZPL and text files only see the settings that apply to them: format on save where the file can be formatted, and profiles.

## [1.23.0] - 2026-11-08

### Added

- Format (⇧⌥F, or the button in the bottom bar) works on Markdown files: it formats the code in each fenced block, in TypeScript, JavaScript, JSON, CSS, YAML, GraphQL, HTML, XML and SQL, and leaves the text around it as written. Format on save does it too.

## [1.22.1] - 2026-11-08

### Fixed

- Fenced code in the Markdown editor shows its colours; the grey of code text covered them.

## [1.22.0] - 2026-11-08

### Changed

- Fenced code in the Markdown editor reads as a block, on a light band, and is coloured like the preview in TypeScript, JavaScript, Python, shell, CSS, YAML and the other languages the preview reads.

## [1.21.0] - 2026-11-08

### Changed

- The Markdown editor formats text as the preview shows it: bigger headings, heavier bold, inline code in blue, highlighted `==text==`, underlined links and `[[wikilinks]]`, and a rule beside quotes. The markup stays visible, faded.
- `==Highlights==` in the preview use the same amber as the editor, so they read in dark mode too.

## [1.20.0] - 2026-11-08

### Added

- In a folder opened from disk, `![[note]]` on its own line shows that note's content in the preview, as Obsidian does, under a link to open it. `![[note#Heading]]` shows just that section and `![[note#^id]]` one marked paragraph.
- Embedded notes show your unsaved edits when they are open in a tab, and are included in PDF exports. A note never embeds itself or a note it is already inside.

## [1.19.1] - 2026-11-08

### Fixed

- Markdown PDFs print on white paper with dark text when the app is in dark mode, instead of a black background. Mermaid diagrams print in their light colours too.

## [1.19.0] - 2026-11-08

### Changed

- With no tab open, the editor shows an empty untitled file instead of a welcome screen. Start typing or paste and it becomes a file, with undo and type detection working as in any other file.
- Pick the new file's type in the bottom bar before typing, or leave it on Auto to take the type from what you paste. Open from disk and Open folder sit beside it.

## [1.18.2] - 2026-11-08

### Fixed

- The site loads again. Every page returned a server error after 1.18.1.

## [1.18.1] - 2026-11-08

### Fixed

- Keep the active filename in the browser title when returning to the editor from another page.

## [1.18.0] - 2026-11-08

### Changed

- Pasting over a whole file only asks about its type when the pasted content reads as a different type, or when its type can't be told.
- The question is now a slim bar under the tabs instead of a dialog: Enter switches, Escape keeps the current type, and the editor stays usable around it.

## [1.17.0] - 2026-11-08

### Added

- A bracket-and-cursor logo across the site, browser tab and installed app, with a branded social preview image.

### Changed

- Show the active filename in the browser title, including after renaming or switching files.
- Improve English and French search titles, page descriptions and social previews for all supported text formats.

## [1.16.0] - 2026-11-07

### Added

- Export Markdown files or entire folders, including nested notes, as one PDF using the preview’s typography, syntax highlighting, images, links and Mermaid diagrams.
- Keep code blocks together on a page whenever they fit, with wrapping and page breaks for oversized blocks.

## [1.15.0] - 2026-11-07

### Added

- Preview PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, APNG and SVG images in file tabs, with dimensions, fit and actual-size views, and lossless downloads.

## [1.14.0] - 2026-11-07

### Changed

- A folder opened from disk lists every file in the explorer, images and PDFs included. Files the editor can't open are dimmed and don't open, but can still be renamed or deleted.

## [1.13.1] - 2026-11-07

### Changed

- Code blocks, inline code, callouts, Mermaid diagrams and images in the Markdown preview have square corners, like the rest of the app.

## [1.13.0] - 2026-11-07

### Added

- Paste an image into a Markdown note of a folder opened from disk and it's saved in the folder's `attachements/img` (or the attachment folder an Obsidian vault sets), with a link to it added where the cursor is.

## [1.12.1] - 2026-11-07

### Changed

- Inline `code` in the Markdown preview has more padding, so it stands out from the text.

## [1.12.0] - 2026-11-07

### Changed

- Inline `code` in the Markdown preview is blue on a faint blue wash, so it stands out from the text in both themes.

## [1.11.1] - 2026-11-07

### Changed

- Inline `code` in the Markdown preview is quieter again: a soft tint with no outline or bold.
- The code block Copy button is a muted icon that brightens on hover.

## [1.11.0] - 2026-11-07

### Changed

- Code blocks in the Markdown preview sit in an outlined frame with their language (or title) in a header and a Copy button.
- Inline `code` in the preview stands out more, with an outline and a stronger tint.

## [1.10.0] - 2026-11-07

### Added

- Obsidian vaults open as folders like any other, and the explorer tells them apart with a notebook icon. Their `.obsidian` settings and `.trash` stay hidden, the attachment folder set in Obsidian stays out of the tree, and files listed under "Excluded files" stay out of search.
- New files in a vault are notes: they're named `.md` unless you type another type the editor opens.
- The Markdown preview understands Obsidian's syntax: `[[links]]` (with headings and aliases) open the note they name in a tab, `![[image.png|300]]` shows the image from the folder, and callouts and `==highlights==` render. Relative links and images in any folder opened from disk work the same way.
- Links to notes that don't exist show faded, as in Obsidian.

## [1.9.0] - 2026-11-07

### Changed

- The explorer's five unlabelled icons are now one **New** button. Its menu separates making a file or folder in the browser from bringing files in from your device, and says under each import whether it copies the files or edits them on disk.
- Each workspace row, the browser's and every open folder's, shows New file and New folder buttons on hover, so it's clear where a new file goes. Importing into the browser moves to the browser row's "…" menu.

## [1.8.1] - 2026-11-07

### Fixed

- Every button at the top of the explorer now shows a tooltip naming it and explaining what it does, including the difference between importing a folder and opening one.

## [1.8.0] - 2026-11-07

### Added

- Open folders from your device as workspaces, in Chrome, Edge and other Chromium browsers. Each one shows in the explorer under its own folder icon, next to the browser's own workspace, and you can open several at once.
- Files in an open folder save back to it as you type. Changes made in other apps show up when you return to the editor, and a file edited on both sides asks before anything is overwritten.
- Create, rename and delete files and folders on disk from the explorer, and search across every open folder. Closing a folder only removes it from the editor; nothing on disk changes.
- After a reload, the browser may ask once to allow the folder again: use Reconnect on its row.

## [1.7.2] - 2026-11-07

### Fixed

- Hovering a file in the explorer highlights the whole row in one colour, and the open file is marked with a soft grey instead of a solid block, in light and dark themes.
- Open folders no longer stay highlighted, and the "…" menu only appears on hover. The folder menu is now called "Folder actions".
- "Move to" greys out the folder the item is already in, and deleting a folder now asks "Delete folder" instead of "Close and delete".
- On phones, opening a file closes the explorer. "Import folder" moved into the explorer header, and the duplicate "Deleted files" button is gone.
- Status bar actions no longer overlap Settings when variables are shown; on narrower screens they collapse to icons.
- Hovering a background tab no longer makes it look like the active tab.

## [1.7.1] - 2026-11-07

### Added

- Add a branch preview deployment command for testing changes on a separate URL.

## [1.7.0] - 2026-11-07

### Added

- Organize files in a far-right explorer with nested folders, search, drag-and-drop moves, rename, duplicate, download, and archive actions.
- Import folder hierarchies and preserve workspace folders in backups.

## [1.6.2] - 2026-11-07

### Fixed

- The header no longer shows "Editor" twice. The site name already links to the editor, so the separate Editor link is gone.

## [1.6.1] - 2026-11-07

### Changed

- The source code link points to the renamed repository, github.com/puuid-com/editor.

## [1.6.0] - 2026-11-07

### Changed

- The site is now called Editor and lives at editor.puuid.com. Links to xml.puuid.com, including share links, redirect to the new address.
- Backup files are named `editor-backup-<date>.json`. Older backups still restore.

## [1.5.0] - 2026-11-07

### Added

- Plain text files (`.txt`, `.text`, `.log`). They open as written, with no highlighting, structure panel or XML errors. A `.txt` file of pipe-delimited records still opens as fixed-width.
- "New text file" in the command menu and on the welcome screen, and "Plain text" in the file type menu.

## [1.4.0] - 2026-11-07

### Added

- Markdown files (`.md`, `.markdown`). The side panel shows a live preview that follows the editor as you type and scroll, with highlighted code blocks, tables, task lists and Mermaid diagrams.
- "New Markdown file" in the command menu and on the welcome screen. Pasting text that starts with a `#` heading into an empty file makes it Markdown.

## [1.3.0] - 2026-11-06

### Added

- `${…}` variables also accept a name wrapped in dollars, such as `${$stuff$}`. They're highlighted, filled from the profile and no longer flagged as invalid. Switching to `<<…>>` or `{{…}}` leaves them as written.

## [1.2.0] - 2026-11-05

### Changed

- Clicking a pinned tag's name now jumps to it in the editor. When it appears more than once, each click moves to the next one, wrapping back to the first.
- Only the tag icon next to a pinned tag's name copies the name now.

## [1.1.6] - 2026-11-04

### Changed

- Removed the starter template's site setup script, which would have overwritten this site's name and address.

## [1.1.5] - 2026-11-04

### Changed

- Moved the ZPL tag helpers in with the rest of the ZPL code. Nothing visible changes.

## [1.1.4] - 2026-11-04

### Changed

- Added a check for unused files, exports and dependencies to the release checks and CI, and brought the project layout in the README up to date.

## [1.1.3] - 2026-11-04

### Changed

- Simplified how the editor receives its profile's settings. Nothing visible changes.

## [1.1.2] - 2026-11-04

### Changed

- Split the command menu's list of actions into one part per group so it is easier to change. Nothing visible changes.

## [1.1.1] - 2026-11-04

### Changed

- Split the ZPL label preview into smaller parts so it is easier to change. Nothing visible changes.

## [1.1.0] - 2026-11-04

### Changed

- Problems found in XML and JSON files, in the editor and the structure panel, are now written in French when the site is in French, instead of always in English.

## [1.0.6] - 2026-11-04

### Changed

- Simplified how file types are read from file names. Nothing visible changes.

## [1.0.5] - 2026-11-04

### Changed

- Removed seven translations no screen used any more.

## [1.0.4] - 2026-11-04

### Fixed

- A base64 label opened by dropping it or through the file picker on browsers without disk access now picks its profile from the decoded label, as it already did when opened from disk.

## [1.0.3] - 2026-11-04

### Changed

- Removed editor state nothing read: a leftover mobile view switch and the cursor column. The ZPL tools' store is now named for what it holds, so it no longer shares a name with the main editor's.

## [1.0.2] - 2026-11-04

### Changed

- Side-by-side panes are stored only in their current form. A browser tab still holding the layout saved before panes had their own tabs reopens with every file in one pane.

## [1.0.1] - 2026-11-04

### Changed

- Removed unused code: the parts of the vendored showcase kit the About page never used (brand logos, phone frames, charts and most motion components), an unused dev dependency, and exports nothing imported. Nothing visible changes.

## [1.0.0] - 2026-11-04

### Changed

- First stable release. Everything up to 0.190.0 is now version 1.0, and from here on stored data, share links and file formats only break with a new major version.

## [0.190.0] - 2026-11-04

### Changed

- A repeated pinned tag's occurrences are now labelled by the nearest repeated element above them, such as ShipmentLine[2] or Carton[1]/[...], even when they sit at different depths. Containers like ShipmentLines and Cartons are left out unless they're needed to tell occurrences apart.

## [0.189.0] - 2026-11-04

### Changed

- The labels on a repeated pinned tag's occurrences now show only where their paths differ, such as ShipmentLine[1] and ShipmentLine[2], without the parents they all share. When shared layers sit between that and the tag, the label ends with [...].
- In JSON, an occurrence inside an array is labelled with the array's key and index, such as ShipmentLines[0], instead of a bare 0.

## [0.188.0] - 2026-11-04

### Changed

- A pinned tag that appears more than once lists every occurrence under it again, each on a guide line with its own editable value and labelled with its parent tag (such as Line[2]), so you see where each value sits. The one under the cursor is in bold; click a label to move the cursor there.

## [0.187.0] - 2026-11-04

### Changed

- The flat file records table draws a border around every cell, so columns and rows are easier to follow.

## [0.186.0] - 2026-11-04

### Changed

- Flat files no longer show the pinned fields panel, and their records table always sits under the code, even with a single wide pane.

## [0.185.0] - 2026-11-04

### Changed

- Pinned tags that appear more than once are back to a single field with a count beside it, as before 0.183.0. The occurrence list and its popover are gone.

## [0.184.0] - 2026-11-04

### Changed

- A pinned tag that appears more than once now lists every occurrence right in the pinned fields, each with its own editable value, its position and its parent tag, instead of hiding them behind a menu. Past five, the rest fold behind "Show all". Click an occurrence's label to move the cursor to it.

## [0.183.0] - 2026-11-04

### Added

- When a pinned tag appears more than once, the count beside its field now shows which one you're editing (such as 2/3). Click it to list every occurrence with its position, parent tag and value, and pick one to edit it.

## [0.182.0] - 2026-11-04

### Changed

- Notices such as "Copied to clipboard" now have their own place in the bottom bar, in the free space beside the file's actions, instead of floating over the buttons.

## [0.181.0] - 2026-11-04

### Changed

- Highlights and profiles in the bottom bar are now one button each. The Highlights button opens every colour, the ones with no match in the file, and the form to add one. The profile button shows the current profile and opens a menu to switch, edit or create one.

## [0.180.0] - 2026-11-04

### Changed

- The bottom bar no longer overflows with many highlight colours or profiles. It shows the three highlight colours with the most matches and the four profiles holding the most files (always including the current one); the rest sit behind a +N button.

## [0.179.0] - 2026-11-04

### Changed

- Clicking anywhere on a pinned tag now copies its name. Jumping between its matches moves to the tag's right-click menu (Next match, Previous match).

## [0.178.0] - 2026-11-04

### Changed

- A pinned tag's copy-name icon now sits at the start of the tag, so the icons line up down the pinned list.

## [0.177.0] - 2026-11-04

### Changed

- The button that copies a pinned tag's name now sits inside the tag itself, in the tag's highlight colour, instead of next to the value's copy button.

## [0.176.0] - 2026-11-04

### Changed

- The second copy button on a pinned tag now copies the tag name itself, such as `SenderCode`, instead of a `{{SenderCode}}` variable. Its icon is now a tag.

## [0.175.3] - 2026-11-03

### Changed

- `TASKS.md` now lists ten ranked feature proposals, each with what it does, why it matters, the model and effort to build it, and its pros and cons. The earlier follow-up list is replaced.

## [0.175.2] - 2026-11-03

### Fixed

- The ZPL preview centers the label itself, not the label and its caption together, so it no longer sits higher than the middle of the pane.

## [0.175.1] - 2026-11-03

### Fixed

- The ZPL label preview is now truly centered vertically: the room kept for the zoom controls no longer pushes the label up.

## [0.175.0] - 2026-11-03

### Changed

- The ZPL label preview is centered vertically in its pane instead of sitting at the top.

## [0.174.0] - 2026-11-03

### Changed

- The ZPL preview's status pill no longer shows "1 label" or "No problems": each label's caption already gives the count, and the pill now appears only for problems, truncated renders or compare mismatches.

## [0.173.1] - 2026-11-03

### Changed

- Remove unused editor commands, obsolete tab-ordering code, and unused UI components and dependencies.
- Share the download helper between document, backup, and label exports to keep file handling consistent.

## [0.173.0] - 2026-11-03

### Changed

- With side-by-side panes, the split button now stays on the first pane and the close-pane button shows only on the last one, so each sits in one fixed place.

## [0.172.0] - 2026-11-03

### Added

- Side-by-side panes now have a close button in their tab row, so going back to one pane is a single click. Its tabs move to the pane beside it; no file is closed.
- Join all panes, from a pane's ⋯ menu, a tab's right-click menu or the command menu, puts every tab back in one pane.

### Changed

- "Hide pane" is now called "Close pane".

## [0.171.1] - 2026-11-03

### Fixed

- In a ZPL pane with the label preview on top, the active tab now has the preview's grey instead of the editor's colour, so it joins the preview instead of standing out as a dark notch.

## [0.171.0] - 2026-11-03

### Added

- Word wrap: long lines can now wrap to fit the editor instead of scrolling sideways. Turn it on or off with the wrap button in the bottom bar, the command menu or ⌥Z. The choice applies to every file and is remembered.

## [0.170.2] - 2026-11-03

### Fixed

- Clicking a tab after typing no longer draws an outline around it. The outline now shows only when you move between tabs with the keyboard.

## [0.170.1] - 2026-11-03

### Fixed

- Clicking a tab no longer leaves a box around its name after you press a key. The click now puts the cursor in that file's editor, as VS Code does.
- When you move between tabs with the keyboard, the focus outline now goes around the whole tab.

## [0.170.0] - 2026-11-03

### Changed

- New tab look: the active tab is a card joined to the editor below it, and the other tabs sit flat on a grey band, split by hairlines. File icons are gone.
- A tab's profile shows as a coloured dot before its name instead of tinting the name.
- The split button sits only on the rightmost pane instead of on every pane.
- When tabs don't fit, the strip fades at the edge with more tabs instead of showing scroll arrows. Scroll it with the wheel or open the full list.
- The dot on a file with unsaved changes takes the close button's place and turns into it on hover.

## [0.169.0] - 2026-11-02

### Changed

- ZPL panes have one toolbar instead of six. Label settings, a Download menu (PDF, PNG, ZPL and the copy actions) and the pane's ⋯ menu now sit in the tab row.
- Compare labels and command explanations moved to the pane's ⋯ menu. While you compare, a close button on the comparison bar turns it off.
- The label count, problems and zoom controls float over the preview instead of taking a row of their own.
- "Rendered by Labelary" and Sync preview zoom moved to the bottom bar. Sync shows only when more than one ZPL file is open.

## [0.168.0] - 2026-11-02

### Changed

- When a ZPL pane is stacked, the label preview now sits above the code instead of below it.

## [0.167.2] - 2026-11-02

### Fixed

- Sync preview zoom and the comparison picker are disabled when only one ZPL file is open, since there is nothing to sync or compare with.

## [0.167.1] - 2026-11-02

### Fixed

- A ZPL file alone in a wide window now shows its code and label preview side by side instead of stacked.

## [0.167.0] - 2026-11-02

### Changed

- Each editor pane now owns its tabs and controls in a single row, replacing the global file strip and duplicate filename headers.
- Move tabs between panes by dragging or using the tab menu. Closing a pane keeps its files open in a neighboring pane.
- Keep tab switching and new files in the focused pane, restore pane groups on reload, and show all files in one strip on narrow screens.

## [0.166.0] - 2026-11-02

### Added

- Open up to four editable XML, JSON, fixed-width, SQL and ZPL files side by side, with independent editor history and profiles.
- Edit ZPL labels with live Labelary previews, command explanations, lint warnings, per-file dimensions and print density, zoom and visual comparisons.
- Export labels as ZPL, PNG, ZIP or PDF, copy base64, and share compressed label links. Label settings are included in workspace backups and shared files.

### Changed

- Base64 label fields open beside their source document in this workspace. Existing ZPL URL parameters and XML share links remain supported.
- Explain that rendering ZPL previews and image exports sends label content to Labelary.

## [0.165.1] - 2026-11-02

### Fixed

- "Change type" is back to the four types (XML, JSON, fixed-width and SQL) instead of a long list of extensions.
- "Change type" now works on empty files too, from the command menu and the tab menu, and the tab shows the new extension. Content pasted afterwards keeps that type unless it clearly reads as another.

## [0.165.0] - 2026-11-02

### Changed

- "Change type" in the command menu now lists every extension for each type, such as `.xsd`, `.config` or `.geojson`, so you can change a file's type and extension in one step. Search for an extension to jump to it.

## [0.164.2] - 2026-11-02

### Changed

- The editor's dialogs, tab strip, welcome screen and profile storage code are split into smaller modules, with no change in behaviour.

## [0.164.1] - 2026-11-02

### Fixed

- The open dialog lists SQL files (`.sql`, `.ddl`, `.dml`) and notebooks (`.ipynb`) with the other types it reads.
- Closing the last tab clears the bottom bar instead of leaving the closed file's highlights, actions and settings there.
- Pinned tags with a namespace prefix, such as `inv:ID`, show their pin in the structure tree.
- Copying says so when the browser refuses the clipboard, instead of reporting it copied.
- File and backup downloads no longer risk being cancelled in Firefox and Safari, and a fixed-width file without an extension downloads as `.txt`.
- Search results and link previews point to xml.puuid.com instead of localhost, in the sitemap, robots.txt and page links.
- When a profile change can't be saved, a new profile's dialog closes instead of offering to create it a second time.
- The command menu and the theme toggle keep working when the browser blocks site storage.
- The feature grid lights up its highlight chips one after another every time, instead of slower on each replay.

## [0.164.0] - 2026-11-02

### Changed

- Long releases on the changelog page show their first six changes, with a button to show the rest, so the page is quicker to scan.

### Fixed

- Code in changelog entries, such as `.sql` or `<<name>>`, shows as a small grey chip instead of being wrapped in literal backticks.

## [0.163.1] - 2026-11-01

### Changed

- Agent and contributor docs now ask for a changelog picture with every visible change.

## [0.163.0] - 2026-11-01

### Added

- Changelog entries now show a small picture of what changed, with a before and after where it helps: SQL colours, the paste dialog, welcome screens, tabs, the bottom bar and more.

## [0.162.0] - 2026-11-01

### Added

- SQL colours that follow the usual SQL editor convention: blue keywords, red strings, green comments, magenta functions and grey operators.
- Tables, aliases and columns in SQL each get their own colour, read from where they stand in the query.

## [0.161.0] - 2026-11-01

### Added

- SQL files (`.sql`): syntax highlighting and a Format action that puts each clause on its own line, with leading commas, AND/OR conditions indented under WHERE and ON, and subqueries indented one level.
- SQL files open in the editor alone: no side panel, highlights, defaults or variables.

## [0.160.0] - 2026-11-01

### Changed

- The about page now shows the feature grid: tree and text sync, local storage, compare, tag highlights and share links.

## [0.159.2] - 2026-11-01

### Added

- A feature showcase grid for the editor (tree and text sync, local storage, compare, tag highlights, share links), ready to place on a page.

## [0.159.1] - 2026-10-31

### Changed

- Added the stageshow agent skill for building faux product UI and demo illustrations.

## [0.159.0] - 2026-10-31

### Added

- Change a file's type (XML, JSON, fixed-width) from the command menu or by right-clicking its tab. Types the content can't be read as are disabled.

## [0.158.1] - 2026-10-29

### Fixed

- Pasting into a file that still holds only the starter template, such as tabs made before files started empty or a new JSON file, now replaces the template and asks for the file type and profile, instead of pasting inside it.

## [0.158.0] - 2026-10-29

### Added

- Pasting into an empty file, or over all of one, asks which file type and profile it is, with what the content gives away already picked. Press Enter to accept, clone any profile or make a new one from the same dialog.

### Changed

- New files start empty. An empty file has no type: its tab drops the extension, the structure panel and file actions hide, and the editor invites you to paste or type.

### Fixed

- Errors from a file's old type no longer linger in the editor after it changes type.

## [0.157.0] - 2026-10-29

### Added

- Open pipe-delimited flat files, such as shipment exports with `SH|…` and `PC|…` lines. The side panel shows their records as a table, with one tab per record type that follows the cursor; click a cell to select that field in the editor.
- The open dialog accepts `.txt` and `.dat` files.

## [0.156.1] - 2026-10-29

### Fixed

- Pressing Tab while a completion is shown now accepts it instead of indenting the line.

## [0.156.0] - 2026-10-28

### Changed

- Highlights with no match in the current file no longer show in the bottom bar; a button lists them so you can still remove them.

## [0.155.0] - 2026-10-28

### Changed

- Tooltips wait a full second before appearing and no longer chain instantly from one button to the next.
- Removed tooltips that only repeated a button's label; toolbar tooltips now appear only where they show a keyboard shortcut.

## [0.154.1] - 2026-10-28

### Fixed

- The new file button and tab close buttons now line up vertically.

## [0.154.0] - 2026-10-28

### Changed

- Redesign the welcome screen around a small XML snippet on a faint dot grid. Its lines settle in on arrival and a caret blinks at the end.
- Shorten the welcome description and keep the three actions on one row.

## [0.153.0] - 2026-10-28

### Changed

- Restore the previous welcome screen: no animated illustration, the original title and description, three equal actions and the command palette hint.

## [0.152.0] - 2026-10-28

### Changed

- Simplify the welcome screen to a friendly illustration, a short prompt and one main action to open a file, with new XML and JSON files as secondary options.
- Hide the side panel toggle when no file is open.

## [0.151.1] - 2026-10-28

### Changed

- Share the project instructions with all coding agents through `AGENTS.md`, including the commit, changelog and push steps.

## [0.151.0] - 2026-10-28

### Changed

- Show work from before versioning as regular releases (0.31.0 to 0.146.0), numbered by commit count.

## [0.150.0] - 2026-10-28

### Changed

- Simplify the changelog into one row per release, with earlier Git history folded away.
- Simplify the About page to a short description with the version, storage and source.
- Link the changelog from the site header.

## [0.149.0] - 2026-10-28

### Added

- Automatically select a matching profile when opening or dropping a file, based on its structure and learned profile choices. ([4131a4d](https://github.com/puuid-com/xml/commit/4131a4de59d71cb836df66d3b675dd169b4e4826))
- Document earlier releases with links to every commit.

### Changed

- Restyle the changelog with compact release sections, date navigation and the editor’s neutral typography and colors.

## [0.148.0] - 2026-10-28

### Added

- Add a changelog page. Click the version in the bottom bar or footer to open it. ([432cfec](https://github.com/puuid-com/xml/commit/432cfec))

## [0.147.0] - 2026-10-28

### Added

- Show the app version in the editor's bottom bar and the site footer. ([85bf204](https://github.com/puuid-com/xml/commit/85bf204))

## [0.146.0] - 2026-10-28

### Changed

- Disable bottom bar actions that have nothing to do. ([9a2b2ed](https://github.com/puuid-com/xml/commit/9a2b2eddf8ca841e73087bfb85439430fabddbe2))
- Replace variables in place instead of a new file. ([6b4129d](https://github.com/puuid-com/xml/commit/6b4129dd8779679af010c05976e03d6eef6ec54a))
- Make every file content change undoable. ([88e3589](https://github.com/puuid-com/xml/commit/88e3589fc8a20b8e3d07a8ef14d056e223f2b11e))
- Size tabs to their names and float notices over the bar. ([617f3ad](https://github.com/puuid-com/xml/commit/617f3ad6571b037ae0158b92fdb43efe3ffa2403))
- Preselect the last-run command in the palette. ([be49086](https://github.com/puuid-com/xml/commit/be490869b3ebe14abdd389e857bbfaaf6eef883d))
- Move the notice slot to the top right. ([b3acbc4](https://github.com/puuid-com/xml/commit/b3acbc46011489d8d47c0f1ed1653601688d3a30))
- Give notices a fixed slot at the bottom right. ([729fa90](https://github.com/puuid-com/xml/commit/729fa90318f5f31b2321c899eeb6bc11aa7cacc5))
- Confirm variable replacement with a preview dialog. ([5714cde](https://github.com/puuid-com/xml/commit/5714cdeea060c6032256dac9437da31fedd1b2df))
- Swap the status sentence for labelled switches with icons. ([dd6066c](https://github.com/puuid-com/xml/commit/dd6066cb064778404e28b3cfd5e3742d12046719))
- Replace bottom icon bar with a readable status sentence. ([eab35af](https://github.com/puuid-com/xml/commit/eab35afc8ad0742c96456cbf491a57924111c087))
- Render pinned values like the file panel does. ([488dfaa](https://github.com/puuid-com/xml/commit/488dfaa609f8137c23e8f4e44975551b785de4e3))
- Use sets for the stray bracket lookups. ([dfd3dc5](https://github.com/puuid-com/xml/commit/dfd3dc518d49c69eada99b46d2b48feb63f9ab97))
- Fix CI typecheck and make local checks match CI. ([9f328cd](https://github.com/puuid-com/xml/commit/9f328cd904c452d7bb24698e73a30d070ac9cf05))
- Tell agents to commit and push after each task. ([f405ab3](https://github.com/puuid-com/xml/commit/f405ab30f1e14ad3a00839e6db8fc49d1906fe80))
- Format PinnedFields with Prettier. ([9ffb778](https://github.com/puuid-com/xml/commit/9ffb778a0ec47ecf95117edad25500a8ccb67a88))

### Fixed

- Keep tabs a fixed width and scroll the strip when they overflow. ([1c15c96](https://github.com/puuid-com/xml/commit/1c15c9670fb089535f31c2b5575cfe59cc5caf85))
- Fix file save races and document parsing edge cases. ([f3f12dd](https://github.com/puuid-com/xml/commit/f3f12dd470bf21095d7a917d6e27890ab5b7bd9a))
- Flag every malformed variable, not just a stray >. ([391303f](https://github.com/puuid-com/xml/commit/391303f5ca7dbc7155e69c1103740fd5ec09e5de))
- Flag a stray > next to a `<<var>>` as an error. ([7991a76](https://github.com/puuid-com/xml/commit/7991a7620b4eedcc0a43c07989987eb85bf53678))

## [0.127.0] - 2026-10-27

### Added

- Add theme toggle to the command menu, drop per-tag highlights. ([3e5df03](https://github.com/puuid-com/xml/commit/3e5df03cb020143904807bee729c72e8775a2b51))
- Add a button to switch the variable style. ([4c18451](https://github.com/puuid-com/xml/commit/4c184512e2cb0e5b98a0854c281da8b1e5fe64a6))
- Add a format option to remove tag prefixes. ([de4c9db](https://github.com/puuid-com/xml/commit/de4c9dbce9ff55786d807f04f8b535d23e91ec11))
- Add copy button to pinned fields and confirm before unpinning. ([c6910ed](https://github.com/puuid-com/xml/commit/c6910ed55be13459a727f46a96801c35e439931c))
- Support `{{name}}` variables alongside `<<name>>`. ([935f866](https://github.com/puuid-com/xml/commit/935f8669b689863fbdabe7e8551da51b4f8b0f9b))

### Changed

- Show the tab's profile as a tag on the file name. ([d81c8c0](https://github.com/puuid-com/xml/commit/d81c8c04edd513d00b97696f11a5882678787186))
- Restyle the tab strip like browser tabs. ([d11066a](https://github.com/puuid-com/xml/commit/d11066a79d6ac74f838b1db837029d8a0e7d890b))
- Remove the logo button from the top bar. ([f3e785c](https://github.com/puuid-com/xml/commit/f3e785cf4d61a5752ebdb9bb3266cca39551b19a))
- Regroup the command menu and add a New JSON file shortcut. ([08db3cf](https://github.com/puuid-com/xml/commit/08db3cfd8d8975988480201f0374f0a36525656e))
- Switch the syntax palette to greyscale. ([f534bfb](https://github.com/puuid-com/xml/commit/f534bfb655dee12efcd7be23bf9bf00ae73dbbcd))
- Remove highlight ticks from the editor scrollbar. ([39f6092](https://github.com/puuid-com/xml/commit/39f60921f2873079119e91479e33e64da613a1f2))
- Clean up persistence handling and editor synchronization. ([bbe0185](https://github.com/puuid-com/xml/commit/bbe01859e0d8310d76fc0be5b36d9dffdc6a6b77))
- Mark tags as base64 ZPL labels and open them in the ZPL viewer. ([237b847](https://github.com/puuid-com/xml/commit/237b847859ca83e4d136f9ab7283c29de9cb6caa))
- Shorten long values in the editor, with copy. ([3962852](https://github.com/puuid-com/xml/commit/3962852b2827da833e4d2405aa94fcd813fc7ec6))
- Drop the pinned fields heading and add a copy-as-variable button. ([65f208f](https://github.com/puuid-com/xml/commit/65f208f5e5319ef1ad6684dd8e40c89f56fb6e35))
- Group pinned fields by highlight colour. ([9bf74bf](https://github.com/puuid-com/xml/commit/9bf74bf87140880b13b383417a190c3a2b9bf123))
- Let pinned fields be reordered by dragging. ([9002e88](https://github.com/puuid-com/xml/commit/9002e8851e9347f1aaf96cb4b49d1010818642e0))
- Group bottom-bar highlight chips by colour. ([fae80e5](https://github.com/puuid-com/xml/commit/fae80e5f9eea2e4c9666dde38a5dd51c34856035))
- Offer the profile's highlight colours first when picking. ([95c01f5](https://github.com/puuid-com/xml/commit/95c01f583c138076e3581591088ee10353fd42f3))
- Patch Redact events so Radix switches toggle again. ([dabc07c](https://github.com/puuid-com/xml/commit/dabc07ce5e00c48971e142c10b3f9c3d5ecd6cd3))
- Set the custom sort order from a template file. ([946b120](https://github.com/puuid-com/xml/commit/946b120f0851a2bc49a9be69e8f9561003d50ecd))
- Ask the browser to keep the workspace and remind about backups. ([1201372](https://github.com/puuid-com/xml/commit/120137200e570911dfe83feb11b737f450d0d177))
- Read disk write support through a hydration-safe hook. ([a3ffad1](https://github.com/puuid-com/xml/commit/a3ffad16e1d02980e44e66ac44f2b0407bbb7168))
- Save tabs back to the files they were opened from. ([2cb6a7a](https://github.com/puuid-com/xml/commit/2cb6a7aba9d8b9795434315a0f262b5de9b8bcf0))
- Store the workspace in IndexedDB instead of localStorage. ([f965535](https://github.com/puuid-com/xml/commit/f96553563b1dc81eacc245da35d54702f889483d))
- Format search.ts with Prettier. ([daa484f](https://github.com/puuid-com/xml/commit/daa484fba167acde6f024c9674a35a296ba0b18e))

### Fixed

- Keep the first highlight pill's ring inside the bottom bar. ([7b699ea](https://github.com/puuid-com/xml/commit/7b699ea46cbb98c1d778c1675271126fd78e925b))
- Stop browser autofill in the find and replace fields. ([bb98c8d](https://github.com/puuid-com/xml/commit/bb98c8df0f5403a21a72ec6e645b12b66714d3d5))
- Keep legacy rows IndexedDB refuses instead of losing the store. ([76ac8a8](https://github.com/puuid-com/xml/commit/76ac8a80c2ef97507f34587d537dcbf0ce0d1c45))

## [0.98.0] - 2026-10-26

### Added

- Add a share button to the top bar. ([4235262](https://github.com/puuid-com/xml/commit/4235262a76d6e1b9a52c87125b2d7e4bd9cafdc5))
- Add a custom sort order to formatting. ([12b7dcc](https://github.com/puuid-com/xml/commit/12b7dcca8565ed978812b1f869475df1a4d52a21))

### Changed

- Remove offline service worker support. ([4a60328](https://github.com/puuid-com/xml/commit/4a6032860d08d79599d58c05ca12a1f6ae5d903b))
- Run the app on the TanStack Redact runtime. ([9c86276](https://github.com/puuid-com/xml/commit/9c86276ab84cebdc0493e379d03d93896de72382))
- Rename the project to xml. ([d150b22](https://github.com/puuid-com/xml/commit/d150b22546664decf3ea0fc03f712fe65b1ad60b))
- Switch tabs with Control and the arrow keys. ([4b8d79c](https://github.com/puuid-com/xml/commit/4b8d79cbafba9e74abcc1949e6863e81f4c3c444))
- Ignore namespace prefixes in profile tag rules. ([06dc1d4](https://github.com/puuid-com/xml/commit/06dc1d48073e654705d7adecb0652c5f53f7fcb7))
- Carry the file's profile in share links. ([536d689](https://github.com/puuid-com/xml/commit/536d689213ba3cd25d137a7cd246cbada8f35c51))
- Record browser check results and add tasks 8 to 11. ([8089d62](https://github.com/puuid-com/xml/commit/8089d62358fbe7a9d1878d5ed4ba812414c0725c))
- Replace finished fixes in TASKS.md with follow-ups. ([ee97c59](https://github.com/puuid-com/xml/commit/ee97c5989894eec8fbc7d9146b9c31a1598f1994))

### Fixed

- Silence React Doctor on eager CodeMirror and restore writes. ([97347c4](https://github.com/puuid-com/xml/commit/97347c445d6c8927edfebb4a62bd54dfdb54f7dd))

## [0.84.0] - 2026-10-25

### Added

- Add offline support and app install with a service worker. ([cfb0546](https://github.com/puuid-com/xml/commit/cfb05462132a49c3cc524f83098a89317424d529))
- Add side-by-side comparison of two open tabs. ([ec08e77](https://github.com/puuid-com/xml/commit/ec08e77ee3bf94d3054ae852f26457859891f833))
- Add workspace backup and restore. ([6d228eb](https://github.com/puuid-com/xml/commit/6d228eb0dd2cec7a218c44267e02eeb84745c361))
- Add per-profile values for plain variables. ([9397a6d](https://github.com/puuid-com/xml/commit/9397a6d2dcad7264956182e376453a13a002def8))
- Add share links that carry a file in the URL fragment. ([cc9b270](https://github.com/puuid-com/xml/commit/cc9b2704a761624947572cc403f77badafc92a33))
- Add a light/dark theme toggle to the status bar. ([2141d28](https://github.com/puuid-com/xml/commit/2141d28d72ef281c9d36a4b774f2257dde43c4f5))
- Add settings profiles, file archive and structure search. ([73000a5](https://github.com/puuid-com/xml/commit/73000a55ad90f496321347ca413eaf8fba691467))
- Add VS Code-style app shortcuts with TanStack Hotkeys. ([c489a8e](https://github.com/puuid-com/xml/commit/c489a8e3365c0445677a60e633ca339a988ecabb))
- Add a pinned fields bar above the editor. ([6c45777](https://github.com/puuid-com/xml/commit/6c457778afed35346b500f7bbd75d6a9c41df225))

### Changed

- Include variables in workspace backups. ([5676b6b](https://github.com/puuid-com/xml/commit/5676b6b5cdc0060e8182a5c459bda9ca5e45fae3))
- Load the compare view on first use. ([d00bbfc](https://github.com/puuid-com/xml/commit/d00bbfcf42e204cdab7d3a46be435b8fa50e86db))
- Restyle completion popup with a variable preview panel. ([8d9998f](https://github.com/puuid-com/xml/commit/8d9998fc8a922fb5dbb7a6f3a8703aec223a0605))
- Open replaced dynamic variables in a new file. ([c98add9](https://github.com/puuid-com/xml/commit/c98add9f2a611e526fe476f03fbe51fbd721cd41))
- Replace Postman dynamic variables with generated values. ([37adff8](https://github.com/puuid-com/xml/commit/37adff8d0cbf2c2f9e93d85691d61785fb71ae33))
- Mark elided path middles with a bordered marker. ([cc6589f](https://github.com/puuid-com/xml/commit/cc6589f0e382b786048f34e4cbe74adf0180c925))
- Elide the middle of long paths in menu headers. ([58a96a4](https://github.com/puuid-com/xml/commit/58a96a48005f7fb8c9d1558c3c6203387f4d5e7b))
- Redesign context menus with a header and inline colours. ([9e0eb19](https://github.com/puuid-com/xml/commit/9e0eb19b1ff6372a08f79fa57a2146e0f8157335))
- Copy standard XPath, JSONPath and JSON Pointer paths. ([16b2e07](https://github.com/puuid-com/xml/commit/16b2e073f51627e548f885ff60397af3fccba6da))
- Highlight search hits in the structure tree. ([a0a76f4](https://github.com/puuid-com/xml/commit/a0a76f48ac4068c4f732f37ea7a29df6504d58e1))
- Show notifications in the status bar instead of toasts. ([659b829](https://github.com/puuid-com/xml/commit/659b82934cad89a8aab43e92d59e522001a2695e))
- Extract shared UI pieces and a shortcut registry. ([8ac88d6](https://github.com/puuid-com/xml/commit/8ac88d62050a8e9594e8381554da60912dd7035c))
- Split editor extensions and share syntax helpers. ([87ebd9c](https://github.com/puuid-com/xml/commit/87ebd9c7d9ff104db73dd13120697fa70285d093))
- Share store persistence helpers. ([8efdc9f](https://github.com/puuid-com/xml/commit/8efdc9f1a3a11ebe8238c3000848c2675cc542f6))
- Simplify the bottom bar and confirm before applying defaults. ([a005191](https://github.com/puuid-com/xml/commit/a00519159df4b02d50f2c0b559785a9e79f1b1c1))
- Make the structure tree keyboard-accessible. ([19414d5](https://github.com/puuid-com/xml/commit/19414d58e3f3eaddef710f14131573d64c6bb0d0))
- Move pinned fields into the side panel. ([730b139](https://github.com/puuid-com/xml/commit/730b139cbd9cc7707c16060534c31b8c81f604e5))
- Span the pinned bar across both panels. ([eb36381](https://github.com/puuid-com/xml/commit/eb36381d0e0eeff84285018af855ac28a683da1f))
- Sync scrolling between the editor and the structure tree. ([3c43ca1](https://github.com/puuid-com/xml/commit/3c43ca10a99080528c6729c089a9f7ed4f04183b))
- Underline differing values in the structure tree. ([4fe340b](https://github.com/puuid-com/xml/commit/4fe340b39219a9f88bece04875e1affb27f0171a))
- Underline values that differ from their default. ([f8e0775](https://github.com/puuid-com/xml/commit/f8e0775e20183b32fc149944572096761cb11bcf))
- Accept Postman dynamic variables like `<<$randomInt>>`. ([9aea957](https://github.com/puuid-com/xml/commit/9aea957b6a98662a94214b394a6059cf46857f51))
- Mark values that already equal their default. ([6527a55](https://github.com/puuid-com/xml/commit/6527a553d8dfa450c6a7b2c34ecda1ad31777a0f))
- Replace shipped features in TASKS.md with follow-ups. ([02cd952](https://github.com/puuid-com/xml/commit/02cd952cbdeec5c2f5855ecf77c634531bb73976))
- Add TASKS.md with five ranked feature ideas. ([0d8f635](https://github.com/puuid-com/xml/commit/0d8f635c0d4dade00a5295f007867fccce6ac8dc))
- Remove dead code and unused dependencies. ([ab50c8a](https://github.com/puuid-com/xml/commit/ab50c8a27abec3f5097fc736c382bf66648d88c4))
- Add React Doctor scanner. ([ce103d4](https://github.com/puuid-com/xml/commit/ce103d4f656265988085345b93e6b00d293f4b3b))

### Fixed

- Keep storage events reaching collections after a write wrapper. ([8f4e954](https://github.com/puuid-com/xml/commit/8f4e954709a6738b08db8fe99d49fd8afd6b696f))
- Serve the locale shell for uncached pages offline. ([17848ce](https://github.com/puuid-com/xml/commit/17848cea8871e64b8aebd4e17b16be2753955e32))
- Report failed saves from every collection. ([57a4e75](https://github.com/puuid-com/xml/commit/57a4e756c0794ae9e91c353b517688f0e9db705d))
- Roll back a restore that fails partway. ([e84e8c0](https://github.com/puuid-com/xml/commit/e84e8c034b0f1e1220b9372466e93d6f55b3ce3e))
- Keep update notices and errors under short-lived notices. ([da18a68](https://github.com/puuid-com/xml/commit/da18a685a250d15f2c99c874498eb1f41af88335))
- Keep highlight chips fixed when a notice appears. ([a2dc44f](https://github.com/puuid-com/xml/commit/a2dc44fd9f16c7b663381713b3a7059f3b788800))
- Fix React Doctor findings. ([a0a62f7](https://github.com/puuid-com/xml/commit/a0a62f776d4e2830ec3d4e7a6b791bf4c653127c))

## [0.31.0] - 2026-10-24

### Added

- Add JSON support alongside XML. ([a1db705](https://github.com/puuid-com/xml/commit/a1db705b068c6dcaa7a6cafae8fa132ee21a75ea))
- Add default values that can be applied to the open file. ([5468a6f](https://github.com/puuid-com/xml/commit/5468a6fc0ec7e751397487d4ae50e3d7cd04377d))
- Add right-click highlight menu on editor tags. ([0ba20be](https://github.com/puuid-com/xml/commit/0ba20be59db7be199caf877287e78813cb134ae2))
- Add "highlighted tags first" format option. ([42df9b0](https://github.com/puuid-com/xml/commit/42df9b018b3fb486b39ddd3c97138fcbd41313cb))
- Add format options, format on save; drop minify. ([a9e16b6](https://github.com/puuid-com/xml/commit/a9e16b6537224719d4c75e0691be65b2d75d4d69))
- Build the XML editor: CodeMirror, synced tree, tag highlights. ([159bdf0](https://github.com/puuid-com/xml/commit/159bdf074c42535ce1c147b2c2e043cac22e672e))
- Add local cache for files and tag highlights. ([846541b](https://github.com/puuid-com/xml/commit/846541b15cb96c98df96fd5930e94d77cbf1f912))
- Add XML core: parse, format, edit and locate. ([22892b1](https://github.com/puuid-com/xml/commit/22892b1e287ebeedcbbb1efd0a9ba11e429736c8))
- Initial commit. ([c448ae4](https://github.com/puuid-com/xml/commit/c448ae4291a8ab747f003450d7ac3c6a520785e2))

### Changed

- Remove the load sample actions. ([b9f57e5](https://github.com/puuid-com/xml/commit/b9f57e57ad7a4c5dab7ebf5734531b767049a491))
- Delete a file when its tab closes. ([855c637](https://github.com/puuid-com/xml/commit/855c6378e0b79dc632e384b3fb8f93609d70a906))
- Color parent tags apart from leaf tags. ([81f056b](https://github.com/puuid-com/xml/commit/81f056b0885ddaec954572bd18be4a7b5ee0be6f))
- Center the command menu and open it from the bottom bar. ([19f94f5](https://github.com/puuid-com/xml/commit/19f94f5e81beb685068d2977de7f1408182da888))
- Turn the file menu into a searchable command menu. ([6822eaf](https://github.com/puuid-com/xml/commit/6822eaf5b39e06cf0c7cfbe6fbe4f7d22fc9129b))
- Confirm before closing a file tab. ([6ca96ab](https://github.com/puuid-com/xml/commit/6ca96ab71d7ba7ed22c3692cd36b782fc5c35cc3))
- Move editing tools to the bottom bar and slim the top bar. ([3d8d69f](https://github.com/puuid-com/xml/commit/3d8d69fd50ce481bbe63ae01eaf9e7cf016f6d35))
- Restyle variables as grey chips with a variable icon. ([abffd02](https://github.com/puuid-com/xml/commit/abffd02434c033ba8db02cfef0f5670cce61fd14))
- Turn format options menu into a settings popover. ([70a82f9](https://github.com/puuid-com/xml/commit/70a82f9d2323f2331de1ee2dc7da3f5341bfa946))
- Cycle through occurrences when clicking a highlight chip. ([0901723](https://github.com/puuid-com/xml/commit/0901723a1dbefaaf353d1c03aff95eb079066322))
- Jump to first occurrence when clicking a highlight chip. ([048cfc8](https://github.com/puuid-com/xml/commit/048cfc84827fc043a93cb5b659c92ae61e6cbc5d))
- Shorten toast duration to 1.5s. ([e72e366](https://github.com/puuid-com/xml/commit/e72e3667754732706e8908205dfbfe8067b4693a))
- Highlight whole tags with a tinted wash instead of name chips. ([192eb68](https://github.com/puuid-com/xml/commit/192eb689904f4cc33914db3e0a53be26a1a97478))
- Remove Inspector panel and lock the editor to the viewport. ([213c054](https://github.com/puuid-com/xml/commit/213c054bafe0416625d3b44e0ea7b6c79db67e10))
- Rework tag highlights: solid chips, legend bar, Alt+H picker. ([f2be696](https://github.com/puuid-com/xml/commit/f2be696a53248c098e9019d8c1f93123fb46ef91))
- Disable overscroll on html and body. ([4a95d70](https://github.com/puuid-com/xml/commit/4a95d700ac584495ecf60bbf4f9351de60f6d76a))
- Use shadcn's cn package for class merging. ([4cf2143](https://github.com/puuid-com/xml/commit/4cf2143f06b33b60effe7d2925c6d6d80018c9cf))
- Fix build warnings: split vendor chunks, SSR sourcemap. ([05e3c7d](https://github.com/puuid-com/xml/commit/05e3c7d3fed0eda0e58d5af23c2c740f6edd770a))
- Add xml.puuid.com custom domain to wrangler. ([97a7464](https://github.com/puuid-com/xml/commit/97a7464cf3b1c29bd9c78d418f7ef1b181953b7e))
- Keep stores alive across hot reloads; add diffChange. ([7f8acf0](https://github.com/puuid-com/xml/commit/7f8acf005160fa2cc6b111d22a739a4b1742117d))
- Add editor dependencies and shadcn components. ([318fdde](https://github.com/puuid-com/xml/commit/318fdde06046459ad9ec156912b70134d359649b))
- Merge header, tabs and highlights into a single top bar. ([24fe069](https://github.com/puuid-com/xml/commit/24fe06934d37438af915a69a9325b17e70518b38))
