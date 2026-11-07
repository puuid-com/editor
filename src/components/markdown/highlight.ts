import { createHighlighter } from '@tanstack/highlight/core'
import { createTanStackMarkdownHighlighter } from '@tanstack/highlight/markdown'
import { c } from '@tanstack/highlight/languages/c'
import { cpp } from '@tanstack/highlight/languages/cpp'
import { csharp } from '@tanstack/highlight/languages/csharp'
import { css } from '@tanstack/highlight/languages/css'
import { diff } from '@tanstack/highlight/languages/diff'
import { dockerfile } from '@tanstack/highlight/languages/dockerfile'
import { go } from '@tanstack/highlight/languages/go'
import { graphql } from '@tanstack/highlight/languages/graphql'
import { html } from '@tanstack/highlight/languages/html'
import { ini } from '@tanstack/highlight/languages/ini'
import { java } from '@tanstack/highlight/languages/java'
import { js } from '@tanstack/highlight/languages/js'
import { json } from '@tanstack/highlight/languages/json'
import { jsx } from '@tanstack/highlight/languages/jsx'
import { markdown } from '@tanstack/highlight/languages/markdown'
import { python } from '@tanstack/highlight/languages/python'
import { rust } from '@tanstack/highlight/languages/rust'
import { shell } from '@tanstack/highlight/languages/shell'
import { sql } from '@tanstack/highlight/languages/sql'
import { toml } from '@tanstack/highlight/languages/toml'
import { ts } from '@tanstack/highlight/languages/ts'
import { tsx } from '@tanstack/highlight/languages/tsx'
import { yaml } from '@tanstack/highlight/languages/yaml'

// The languages people paste into notes and docs most; anything else shows
// as plain text. `html` also reads `xml`.
const highlighter = createHighlighter({
  languages: [
    c,
    cpp,
    csharp,
    css,
    diff,
    dockerfile,
    go,
    graphql,
    html,
    ini,
    java,
    js,
    json,
    jsx,
    markdown,
    python,
    rust,
    shell,
    sql,
    toml,
    ts,
    tsx,
    yaml,
  ],
})

/** Escaped, token-classed markup for the inside of a fenced code block. */
export const highlightCode = createTanStackMarkdownHighlighter(highlighter)
