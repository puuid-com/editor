import { IconLink } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { m } from '#/paraglide/messages'
import { zplStore, setSyncZoom, zplCandidates } from './store'

/** The bottom bar's ZPL entries: who renders the labels, and zoom sync across panes. */
export function ZplStatusControls({ fileId }: { fileId: string }) {
  const syncZoom = useSelector(zplStore, (s) => s.syncZoom)
  const files = useSelector(zplStore, (s) => s.files)
  // Syncing zoom needs a second ZPL file.
  const alone = zplCandidates({ files }, fileId).length === 0

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://labelary.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm px-1.5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:hidden"
          >
            {m.zpl_empty_preview_credit()}
          </a>
        </TooltipTrigger>
        <TooltipContent>{m.zpl_privacy()}</TooltipContent>
      </Tooltip>
      {!alone && (
        <Button
          variant="ghost"
          size="xs"
          aria-pressed={syncZoom}
          onClick={() => setSyncZoom(!syncZoom)}
          className="gap-1 px-1.5 text-[11px] font-normal aria-pressed:text-foreground max-md:h-11"
        >
          <IconLink />
          {m.zpl_sync_zoom()}
        </Button>
      )}
    </>
  )
}
