import { exportMarkdownPdf } from '#/components/markdown/pdf/PdfExportDialog'
import { Suspense, lazy } from 'react'
import { IconAdjustmentsHorizontal, IconFileTypePdf } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'

import { ActionBar, FormatButton } from './ActionBar'
import { CodeFontMenu } from './CodeFontMenu'
import { CommandMenuButton } from './CommandMenu'
import { FormatOptions } from './FormatControls'
import { MarkdownLiveToggle } from './MarkdownLiveToggle'
import { ArchiveButton } from './ArchiveDialog'
import { StatusNotice } from './StatusNotice'
import { ThemeToggle } from './ThemeToggle'
import { WordWrapToggle } from './WordWrapToggle'
import { editorStore } from '#/components/editor/editor-store'
import { DefaultsRules } from '#/components/defaults/DefaultsControls'
import { HighlightsBar } from '#/components/highlights/HighlightsBar'
import { VariablesList } from '#/components/variables/VariablesControls'
import { ProfilesPanel } from '#/components/profiles/ProfilesPanel'
import { ProfileTag } from '#/components/profiles/ProfileTag'
import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useFileEmpty } from '#/hooks/use-files'
import { useActiveProfile } from '#/hooks/use-profiles'
import { isPlain } from '#/lib/document'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'

const ZplStatusControls = lazy(() =>
  import('#/components/zpl/status-controls').then((mod) => ({
    default: mod.ZplStatusControls,
  })),
)

/** Bottom bar: the draft's controls or highlights on the left, then the latest notice in the free space; the file's setup and actions (for ZPL, who renders labels and zoom sync), search, the theme toggle and the app version on the right. */
export function StatusBar({
  leading,
}: {
  /** Controls for the editor's state when there is no file, before the rest. */
  leading?: React.ReactNode
}) {
  const activeId = useSelector(editorStore, (s) => s.fileId)
  // An empty file has no type yet, so nothing to highlight, format or set up.
  const empty = useFileEmpty(activeId)
  const typed = !!activeId && !empty
  // SQL, ZPL, Markdown and text have no highlights, defaults or variables;
  // SQL and Markdown's fenced code can still be formatted.
  const plain = useSelector(editorStore, (s) => isPlain(s.doc.language))
  const zpl = useSelector(editorStore, (s) => s.doc.language === 'zpl')
  const markdown = useSelector(editorStore, (s) => s.doc.language === 'md')
  const sql = useSelector(editorStore, (s) => s.doc.language === 'sql')

  return (
    <footer className="flex h-12 shrink-0 items-center gap-1 border-t px-1.5 text-[11px] whitespace-nowrap text-muted-foreground md:h-8">
      {leading}
      {typed && !plain && <HighlightsBar />}
      <StatusNotice />
      {typed && (sql || markdown) && (
        <div className="flex items-center text-foreground">
          <FormatButton />
        </div>
      )}
      {typed && !plain && <ActionBar />}
      {typed && (
        <>
          <SettingsPopover
            structured={!plain}
            formattable={!plain || sql || markdown}
          />
          <Separator
            orientation="vertical"
            className="mx-1 data-vertical:h-4 data-vertical:self-center"
          />
        </>
      )}
      {typed && zpl && (
        <>
          <Suspense>
            <ZplStatusControls fileId={activeId} />
          </Suspense>
          <Separator
            orientation="vertical"
            className="mx-1 data-vertical:h-4 data-vertical:self-center"
          />
        </>
      )}
      {activeId && markdown && <MarkdownLiveToggle />}
      {activeId && markdown && (
        <Button
          variant="ghost"
          size="xs"
          className="max-md:h-11"
          onClick={() => exportMarkdownPdf({ kind: 'file', id: activeId })}
        >
          <IconFileTypePdf />
          {m.md_pdf_export()}
        </Button>
      )}
      <ArchiveButton />
      <CommandMenuButton />
      <WordWrapToggle />
      <CodeFontMenu />
      <ThemeToggle />
      <Button
        asChild
        variant="ghost"
        size="xs"
        className="px-1.5 font-mono text-[11px] font-normal tabular-nums max-md:hidden"
      >
        <Link
          to="/changelog"
          aria-label={m.app_version_label({ version: appVersion })}
        >
          {m.app_version({ version: appVersion })}
        </Link>
      </Button>
    </footer>
  )
}

/**
 * The file's settings. Plain files only get what applies to them: formatting
 * on save when they can be formatted, and profiles.
 */
function SettingsPopover({
  structured,
  formattable,
}: {
  /** XML, JSON or flat: every setting applies. */
  structured: boolean
  /** Has a formatter, so format on save applies. */
  formattable: boolean
}) {
  const profile = useActiveProfile()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="gap-1 px-1.5 text-[11px] font-normal text-foreground max-md:h-11"
        >
          <IconAdjustmentsHorizontal />
          {m.editor_settings()}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-96 max-w-[calc(100vw-1rem)] gap-0 p-0"
      >
        {profile && (
          <div className="flex items-center justify-between gap-4 border-b px-3 py-2 text-muted-foreground">
            {m.profile_settings_scope()}
            <ProfileTag profile={profile} />
          </div>
        )}
        <Tabs
          defaultValue={formattable ? 'format' : 'profiles'}
          className="gap-0"
        >
          <TabsList variant="line" className="w-full justify-start px-2">
            {formattable && (
              <TabsTrigger value="format" className="flex-none px-2">
                {m.action_format()}
              </TabsTrigger>
            )}
            {structured && (
              <>
                <TabsTrigger value="defaults" className="flex-none px-2">
                  {m.defaults_tab()}
                </TabsTrigger>
                <TabsTrigger value="variables" className="flex-none px-2">
                  {m.variables_tab()}
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="profiles" className="flex-none px-2">
              {m.profiles_title()}
            </TabsTrigger>
          </TabsList>
          <Separator />
          {formattable && (
            <TabsContent value="format">
              <FormatOptions structured={structured} />
            </TabsContent>
          )}
          {structured && (
            <>
              <TabsContent value="defaults">
                <DefaultsRules />
              </TabsContent>
              <TabsContent value="variables">
                <VariablesList />
              </TabsContent>
            </>
          )}
          <TabsContent value="profiles">
            <ProfilesPanel />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
