import { useSelector } from '@tanstack/react-store'
import { useEffect, useState } from 'react'
import { IconFileTypePdf } from '@tabler/icons-react'

import { closePdfExport, exportStore } from './export-store'
import type { PdfSource } from './source'
import type { preparePdf } from './print'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { m } from '#/paraglide/messages'

const loadPrint = () => import('./print')

export function PdfExportDialog() {
  const request = useSelector(exportStore, (state) => state)
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) closePdfExport()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.md_pdf_export()}</DialogTitle>
          <DialogDescription>{m.md_pdf_description()}</DialogDescription>
        </DialogHeader>
        {request && <ExportJob key={request.key} source={request.source} />}
      </DialogContent>
    </Dialog>
  )
}

function ExportJob({ source }: { source: PdfSource }) {
  const [ready, setReady] = useState<Awaited<ReturnType<typeof preparePdf>>>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    const controller = new AbortController()
    void loadPrint()
      .then(({ preparePdf: prepare }) => prepare(source, controller.signal))
      .then((result) => {
        if (!controller.signal.aborted) setReady(result)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : m.md_pdf_failed())
      })
    return () => controller.abort()
  }, [source])
  return (
    <>
      <p
        role={error ? 'alert' : 'status'}
        className="text-sm text-muted-foreground"
      >
        {error ??
          (ready
            ? m.md_pdf_ready({ count: ready.count, name: `${ready.name}.pdf` })
            : m.md_pdf_preparing())}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={closePdfExport}>
          {m.tabs_close()}
        </Button>
        <Button
          disabled={!ready || !!error}
          onClick={() => {
            try {
              ready?.print()
            } catch {
              setError(m.md_pdf_failed())
            }
          }}
        >
          <IconFileTypePdf />
          {m.md_pdf_save()}
        </Button>
      </DialogFooter>
    </>
  )
}
