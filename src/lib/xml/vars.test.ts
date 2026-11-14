import { describe, expect, it } from 'vitest'

import {
  convertVars,
  findVarProblems,
  findVars,
  trimVar,
  varStyleOf,
  varStyles,
} from './vars'

describe('vars', () => {
  it('finds ${name} variables alongside the other styles', () => {
    expect(findVars('<<a>> {{b}} ${ c } ${$guid}').map((v) => v.name)).toEqual([
      'a',
      'b',
      'c',
      '$guid',
    ])
  })

  it('accepts ${$name$} only in the ${…} style', () => {
    expect(findVars('<a>${$stuff$}</a><b>${ $x$ }</b>')).toEqual([
      { name: '$stuff$', from: 3, to: 13 },
      { name: '$x$', from: 20, to: 28 },
    ])
    expect(findVarProblems('<a>${$stuff$}</a>')).toEqual([])
    expect(findVars('{{$stuff$}} <<$stuff$>>')).toEqual([])
    expect(findVarProblems('<a>{{$stuff$}}</a>')).toHaveLength(1)
  })

  it('accepts dynamic variables called with arguments', () => {
    const text = 'id {{$randomRegex([A-Z]{3}(x))}} and <<$f(1, 2)>>'
    expect(findVars(text).map((v) => v.name)).toEqual([
      '$randomRegex([A-Z]{3}(x))',
      '$f(1, 2)',
    ])
    expect(findVarProblems(text)).toEqual([])
    expect(findVarProblems('<a>{{plain(x)}}</a>')).toHaveLength(1)
  })

  it('keeps ${$name$} as written when switching to another style', () => {
    expect(convertVars('${$a$} ${b}', 'curly')).toEqual({
      text: '${$a$} {{b}}',
      count: 1,
    })
  })

  it('trims ${ name } keeping its brackets', () => {
    expect(trimVar('${ host }')).toBe('${host}')
    expect(trimVar('{{ host }}')).toBe('{{host}}')
  })

  it('switches every variable to one style and counts the changes', () => {
    const text = '<a><<host>></a><b>{{ port }}</b><c>${$guid}</c>'
    expect(convertVars(text, 'curly')).toEqual({
      text: '<a>{{host}}</a><b>{{port}}</b><c>{{$guid}}</c>',
      count: 3,
    })
    expect(convertVars(text, 'angle').text).toBe(
      '<a><<host>></a><b><<port>></b><c><<$guid>></c>',
    )
    expect(convertVars(text, 'dollar').text).toBe(
      '<a>${host}</a><b>${port}</b><c>${$guid}</c>',
    )
    expect(convertVars('{{a}}', 'curly').count).toBe(0)
  })
})

describe('varStyleOf', () => {
  it('reads the style of the first variable', () => {
    expect(varStyleOf('<a>${x}</a><b>{{y}}</b>')).toBe('dollar')
    expect(varStyleOf('<a><<x>></a>')).toBe('angle')
    expect(varStyleOf('<a>{{ x }}</a>')).toBe('curly')
    expect(varStyleOf('<a>x</a>')).toBeUndefined()
  })
})

describe('variable validation', () => {
  it('reports stray brackets once without swallowing adjacent valid variables', () => {
    const text = '😀 {{{a}}} {{b}}{{c}} <<<<d>>>> ${e}} $${f}'
    const problems = findVarProblems(text, 10)
    expect(
      problems.map(({ from, to }) => text.slice(from - 10, to - 10)),
    ).toEqual(['{{{a}}}', '<<<<d>>>>', '${e}}', '$${f}'])
    expect(problems[0].from).toBe(13)
  })

  it('keeps malformed ranges separate across lines and masks consumed closers', () => {
    const text = '{{bad name}} <<bad name>> ${bad name}\n{{bad name\n}}'
    expect(
      findVarProblems(text).map(({ from, to }) => text.slice(from, to)),
    ).toEqual(['{{bad name}}', '<<bad name>>', '${bad name}', '{{', '}}'])
  })

  it('validates a large run of variables with accurate trailing diagnostics', () => {
    const prefix = '{{value}} <<name>> ${id} '.repeat(20_000)
    const problems = findVarProblems(prefix + '{{bad name}}')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({
      from: prefix.length,
      to: prefix.length + '{{bad name}}'.length,
    })
  })
})

describe('varStyles', () => {
  it('counts variables and reads the style they share', () => {
    expect(varStyles('<a>{{x}}</a><b>{{ y }}</b>')).toEqual({
      count: 2,
      style: 'curly',
    })
    expect(varStyles('<a>x</a>')).toEqual({ count: 0, style: null })
  })

  it('has no style when the variables mix brackets', () => {
    expect(varStyles('<a><<x>></a><b>${y}</b><c>{{z}}</c>')).toEqual({
      count: 3,
      style: null,
    })
  })
})
