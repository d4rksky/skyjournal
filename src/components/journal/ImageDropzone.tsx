import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { PendingImage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImageGalleryModal } from '@/components/journal/ImageGalleryModal'

export type ImageDropzoneProps = {
  images: PendingImage[]
  onChange: (images: PendingImage[]) => void
}

const ACCEPTED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
])

const readImageFile = (file: File): Promise<PendingImage | null> =>
  new Promise((resolve) => {
    if (!ACCEPTED_MIME.has(file.type)) {
      resolve(null)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        resolve(null)
        return
      }
      resolve({
        id: crypto.randomUUID(),
        dataUrl: reader.result,
        mime: file.type
      })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })

const filesFromDataTransfer = (dataTransfer: DataTransfer): File[] => {
  const files: File[] = []
  if (dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      files.push(file)
    }
  }
  return files
}

const filesFromClipboard = (clipboardData: DataTransfer): File[] => {
  const files: File[] = []
  if (clipboardData.files?.length) {
    for (const file of Array.from(clipboardData.files)) {
      files.push(file)
    }
    return files
  }

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

export const ImageDropzone = ({ images, onChange }: ImageDropzoneProps) => {
  const [dragActive, setDragActive] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const appendFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const results = await Promise.all(files.map((file) => readImageFile(file)))
      const next = results.filter((item): item is PendingImage => item !== null)
      if (next.length === 0) return

      onChange([...images, ...next])
    },
    [images, onChange]
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData
      if (!clipboard) return

      const files = filesFromClipboard(clipboard)
      if (files.length === 0) return

      event.preventDefault()
      void appendFiles(files)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [appendFiles])

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setDragActive(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    void appendFiles(filesFromDataTransfer(event.dataTransfer))
  }

  const handleRemove = (id: string) => {
    onChange(images.filter((image) => image.id !== id))
    if (previewId === id) setPreviewId(null)
  }

  const handleOpenPreview = (id: string) => {
    setPreviewId(id)
  }

  return (
    <>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'rounded-2xl border-2 border-dashed border-line bg-canvas p-4 transition-colors',
          dragActive && 'border-accent bg-accent-soft/30'
        )}
      >
        {images.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            تصویر چارت را بکشید اینجا یا Ctrl+V کنید
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {images.map((image) => (
              <li key={image.id} className="relative">
                <div className="group relative size-24 overflow-hidden rounded-2xl border border-line bg-card">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(image.id)}
                    className="relative size-full"
                    aria-label="بزرگ‌نمایی تصویر"
                  >
                    <img
                      src={image.dataUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Search className="size-6 text-white" aria-hidden />
                    </span>
                  </button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="حذف"
                  onClick={() => handleRemove(image.id)}
                  className="mt-1 h-8 w-full rounded-xl border-line text-xs"
                >
                  حذف
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ImageGalleryModal
        open={previewId !== null}
        images={images}
        activeId={previewId}
        onActiveIdChange={setPreviewId}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null)
        }}
      />
    </>
  )
}
