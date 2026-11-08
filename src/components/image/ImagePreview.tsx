import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  editorStore,
  publishParse,
  setView,
} from '#/components/editor/editor-store'
import { downloadFile } from '#/components/editor/actions'
import { isImageData } from '#/lib/image-file'
import { m } from '#/paraglide/messages'

export function ImagePreview({
  file,
  active,
}: {
  file: { id: string; name: string; content: string }
  active: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [size, setSize] = useState('')
  const [actual, setActual] = useState(false)
  useEffect(() => {
    if (!active) return
    setView(null)
    publishParse(file.id, {
      language: 'image',
      nodes: [],
      root: null,
      errors: [],
    })
    return () => {
      if (editorStore.state.fileId === file.id) setView(null)
    }
  }, [active, file.id])
  const src = isImageData(file.content)
    ? file.content
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.content)}`
  return (
    <section
      aria-label={m.image_preview()}
      className="flex h-full min-h-0 flex-col bg-muted/20"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <span className="mr-auto">
          {m.image_preview()}
          {size && ` · ${size}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActual(!actual)}
          aria-pressed={actual}
        >
          {actual ? m.image_fit() : m.image_actual()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadFile(file.id)}
        >
          {m.file_download()}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto p-4">
        {failed ? (
          <p role="alert" className="m-auto text-sm text-muted-foreground">
            {m.image_failed()}
          </p>
        ) : (
          <img
            src={src}
            alt={file.name}
            className={
              actual
                ? 'm-auto max-w-none shrink-0 self-start'
                : 'm-auto max-h-full max-w-full object-contain'
            }
            onError={() => setFailed(true)}
            onLoad={(e) =>
              setSize(
                `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`,
              )
            }
          />
        )}
      </div>
    </section>
  )
}
