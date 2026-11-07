import { queryOptions } from '@tanstack/react-query'

// Mermaid is large, so it loads the first time a diagram is drawn.

const FONT = "'Geist Variable', ui-sans-serif, system-ui, sans-serif"

// Greyscale to match the app's tokens. Mermaid derives its shades from these,
// so they have to be plain hex rather than CSS variables.
const THEMES = {
  light: {
    darkMode: false,
    background: '#ffffff',
    primaryColor: '#fafafa',
    primaryTextColor: '#171717',
    primaryBorderColor: '#a3a3a3',
    secondaryColor: '#f5f5f5',
    tertiaryColor: '#ffffff',
    lineColor: '#737373',
    textColor: '#171717',
    noteBkgColor: '#f5f5f5',
    noteBorderColor: '#d4d4d4',
    edgeLabelBackground: '#ffffff',
  },
  dark: {
    darkMode: true,
    background: '#0a0a0a',
    primaryColor: '#171717',
    primaryTextColor: '#ededed',
    primaryBorderColor: '#525252',
    secondaryColor: '#262626',
    tertiaryColor: '#0a0a0a',
    lineColor: '#a3a3a3',
    textColor: '#ededed',
    noteBkgColor: '#262626',
    noteBorderColor: '#404040',
    edgeLabelBackground: '#0a0a0a',
  },
}

let count = 0
// Mermaid keeps one global config, so renders run one at a time.
let queue: Promise<unknown> = Promise.resolve()

async function renderDiagram(code: string, dark: boolean) {
  // Never part of the server bundle: the editor only runs in the browser.
  if (import.meta.env.SSR) throw new Error('Diagrams render in the browser')
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    fontFamily: FONT,
    themeVariables: {
      ...THEMES[dark ? 'dark' : 'light'],
      fontFamily: FONT,
      // Flat shapes, like the rest of the interface.
      dropShadow: 'none',
    },
  })
  const { svg } = await mermaid.render(`mermaid-${++count}`, code)
  return svg
}

/** A diagram's SVG, shared by every block with the same source and theme. */
export function diagramQuery(code: string, dark: boolean) {
  return queryOptions({
    queryKey: ['mermaid', code, dark],
    queryFn: () => {
      const result = queue.then(() => renderDiagram(code, dark))
      queue = result.catch(() => undefined)
      return result
    },
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  })
}
