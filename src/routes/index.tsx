import { createFileRoute } from '@tanstack/react-router'

import { EditorApp } from '#/components/app/EditorApp'
import { editorReady } from '#/components/app/startup'
import { m } from '#/paraglide/messages'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/')({
  // The editor lives entirely in the browser (CodeMirror, local cache).
  ssr: false,
  // Stored files and settings load from IndexedDB before the editor shows.
  // The loader ships with the component rather than with this file, which
  // is part of every page: the site's other pages have no use for the
  // editor's database.
  codeSplitGroupings: [['loader', 'component']],
  loader: () => editorReady(),
  // The open file's name joins the title in the browser only; see
  // `useEditorTitle`.
  head: () => seo({ title: m.seo_title(), path: '/' }),
  component: EditorApp,
})
