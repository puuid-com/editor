import { CompletionContext } from '@codemirror/autocomplete'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import { codeColorCompletion, colorSwatch } from './md-code-colors'
import { markdownSupport } from './md-language'
import { HIGHLIGHT_PRESETS } from '#/lib/store/colors'

afterEach(() => {
  document.body.innerHTML = ''
})

function editor(doc: string) {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [markdownSupport()] }),
    parent: document.body,
  })
  const names: Array<string> = []
  ensureSyntaxTree(view.state, doc.length, 5000)!.iterate({
    enter: (node) => {
      names.push(node.name)
    },
  })
  return { view, names }
}

/** The CSS of the editor's highlight classes on the span showing `text`. */
function styleOf(view: EditorView, text: string) {
  const span = [...view.contentDOM.querySelectorAll('span')].find(
    (element) => element.textContent === text,
  )!
  const rules = [...document.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('')
  return [...span.classList]
    .map((name) => new RegExp(`\\.${name} \\{([^}]*)\\}`).exec(rules)?.[1])
    .join(';')
}

describe('Markdown as it is typed', () => {
  it('formats bold, italic, code, highlights and links like the preview', () => {
    const { view, names } = editor(
      '# Title\n\n__bold__ _it_ `code` ==mark== [[Note|alias]] ![[Image.png]]',
    )
    expect(names).toEqual(
      expect.arrayContaining(['Highlight', 'WikiLink', 'InlineCode']),
    )
    expect(names.filter((name) => name === 'WikiLink')).toHaveLength(2)
    expect(styleOf(view, ' Title')).toContain('font-size: 1.5em')
    expect(styleOf(view, 'bold')).toContain('font-weight: 700')
    expect(styleOf(view, 'it')).toContain('font-style: italic')
    expect(styleOf(view, 'code')).toContain('background-color')
    expect(styleOf(view, 'mark')).toContain('var(--hl-amber)')
    expect(styleOf(view, 'Note|alias')).toContain('underline')
    // The markup itself stays plain.
    expect(styleOf(view, '==')).toContain('background-color: transparent')
  })

  it('rules quoted lines and leaves lone or spaced = signs alone', () => {
    const { view, names } = editor('> quoted\n> more\n\na == b and ==no ==')
    expect(view.contentDOM.querySelectorAll('.cm-md-quote')).toHaveLength(2)
    expect(names).not.toContain('Highlight')
  })
})

describe('Strikethrough as it is typed', () => {
  it('strikes both one and two tildes, like the preview', () => {
    const { view, names } = editor('~~two~~ ~one~')
    expect(names.filter((name) => name === 'Strikethrough')).toHaveLength(2)
    expect(styleOf(view, 'two')).toContain('line-through')
    expect(styleOf(view, 'one')).toContain('line-through')
    // The markup itself stays plain.
    expect(styleOf(view, '~')).toContain('text-decoration: none')
  })

  it.each(['~5 km and 3~', 'a ~ b ~ c', '~/src and ~/lib', 'x~ y~', '~~~'])(
    'leaves %s alone',
    (doc) => {
      expect(editor(doc).names).not.toContain('Strikethrough')
    },
  )
})

describe('Fenced code as it is typed', () => {
  it('colours languages the editor has no grammar for, like the preview', () => {
    const { view } = editor('```ts\nconst a = "x"\n```\n')
    const keyword = [...view.contentDOM.querySelectorAll('.th-keyword')]
    expect(keyword.map((span) => span.textContent)).toEqual(['const'])
    // Innermost, or the grammar's grey code colour inside it wins.
    expect(keyword[0].children).toHaveLength(0)
    expect(view.contentDOM.querySelector('.th-string')?.textContent).toBe('"x"')
  })

  it('frames every line of the block, fences included', () => {
    const { view } = editor('text\n```\nplain\n```\n')
    const lines = [...view.contentDOM.querySelectorAll('.cm-md-code')]
    expect(lines.map((line) => line.textContent)).toEqual([
      '```',
      'plain',
      '```',
    ])
    expect(lines[0].classList).toContain('cm-md-code-first')
    expect(lines[2].classList).toContain('cm-md-code-last')
  })

  it('leaves XML, JSON and SQL to the editor grammar', () => {
    const { view } = editor('```json\n{"a": 1}\n```\n')
    expect(view.contentDOM.querySelector('[class^="th-"]')).toBeNull()
  })
})

describe('Coloured code as it is typed', () => {
  it('colours code like the preview and fades its tag', () => {
    const { view, names } = editor('`deploy`{.red} and `check`')
    expect(names).toEqual(expect.arrayContaining(['RedCode', 'CodeColorMark']))
    expect(styleOf(view, 'deploy')).toContain('var(--hl-red)')
    expect(styleOf(view, '{.red}')).toContain('var(--syntax-meta)')
    // Code without a tag stays blue.
    expect(styleOf(view, 'check')).toContain('var(--sql-keyword)')
  })

  it('reads code fenced with longer runs of backticks', () => {
    const { view } = editor('``a ` b``{.teal}')
    expect(styleOf(view, 'a ` b')).toContain('var(--hl-teal)')
  })

  it.each([
    '`a`{.orange}',
    '`a` {.red}',
    '`a`\\{.red}',
    'a{.red}',
    '`a{.red}`',
  ])('leaves %s uncoloured', (doc) => {
    expect(editor(doc).names).not.toContain('CodeColorMark')
  })
})

describe('Code colour completion', () => {
  /** The completion at `^` in `doc`, with its editor. */
  function complete(doc: string) {
    const pos = doc.indexOf('^')
    const { view } = editor(doc.replace('^', ''))
    const context = new CompletionContext(view.state, pos, false)
    return { view, pos, result: codeColorCompletion(context) }
  }

  it('offers the palette on { after inline code', () => {
    const { result } = complete('Run `deploy`{^}')
    expect(result?.from).toBe('Run `deploy`'.length)
    expect(result?.options.map((option) => option.label)).toEqual(
      HIGHLIGHT_PRESETS.map((color) => `{.${color}}`),
    )
    const dot = colorSwatch.render(result!.options[3]) as HTMLElement
    expect(dot.style.backgroundColor).toBe('var(--hl-red)')
  })

  it.each([
    ['the brace closeBrackets added', '`a`{^} after', '`a`{.red} after'],
    ['a tag being retyped', '`a`{.re^d} after', '`a`{.red} after'],
    ['an unclosed brace', '`a`{.r^ after', '`a`{.red} after'],
  ])('completes over %s', (_, doc, after) => {
    const { view, pos, result } = complete(doc)
    const red = result!.options.find((option) => option.label === '{.red}')!
    const apply = red.apply as Exclude<typeof red.apply, string | undefined>
    apply(view, red, result!.from, pos)
    expect(view.state.doc.toString()).toBe(after)
    expect(view.state.selection.main.head).toBe('`a`{.red}'.length)
  })

  it.each(['`a` {^', 'a`{^', '`a{^`', '```{^', '``{^'])(
    'offers nothing for %s',
    (doc) => {
      expect(complete(doc).result).toBeNull()
    },
  )
})
