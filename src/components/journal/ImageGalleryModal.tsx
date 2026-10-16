import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent
} from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'

export type GalleryImage = {
  id: string
  dataUrl: string
}

export type ImageGalleryModalProps = {
  open: boolean
  images: GalleryImage[]
  activeId: string | null
  onActiveIdChange: (id: string | null) => void
  onOpenChange: (open: boolean) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.25

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))

const getTouchDistance = (touches: ReactTouchEvent['touches']) => {
  if (touches.length < 2) return 0
  const a = touches[0]
  const b = touches[1]
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

export const ImageGalleryModal = ({
  open,
  images,
  activeId,
  onActiveIdChange,
  onOpenChange
}: ImageGalleryModalProps) => {
  const previewImage = images.find((image) => image.id === activeId) ?? null
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const zoomRef = useRef(MIN_ZOOM)
  const panRef = useRef({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panSessionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const pinchSessionRef = useRef<{
    startDistance: number
    startZoom: number
  } | null>(null)

  const setZoomState = (nextZoom: number) => {
    zoomRef.current = nextZoom
    setZoom(nextZoom)
  }

  const setPanState = (nextPan: { x: number; y: number }) => {
    panRef.current = nextPan
    setPan(nextPan)
  }

  const resetZoom = () => {
    setZoomState(MIN_ZOOM)
    setPanState({ x: 0, y: 0 })
    setIsPanning(false)
    panSessionRef.current = null
    pinchSessionRef.current = null
  }

  useEffect(() => {
    resetZoom()
  }, [activeId, open])

  const applyZoom = (nextZoom: number, anchor?: { x: number; y: number }) => {
    const prevZoom = zoomRef.current
    const clamped = clampZoom(nextZoom)

    if (clamped === MIN_ZOOM) {
      setZoomState(clamped)
      setPanState({ x: 0, y: 0 })
      return
    }

    if (anchor && prevZoom > 0) {
      const ratio = clamped / prevZoom
      const prevPan = panRef.current
      setPanState({
        x: anchor.x - (anchor.x - prevPan.x) * ratio,
        y: anchor.y - (anchor.y - prevPan.y) * ratio
      })
    }

    setZoomState(clamped)
  }

  const applyZoomRef = useRef(applyZoom)
  applyZoomRef.current = applyZoom

  const onWheelNative = useCallback((event: WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const viewport = viewportRef.current
    if (!viewport) return

    const rect = viewport.getBoundingClientRect()
    const anchor = {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    }
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
    applyZoomRef.current(zoomRef.current + delta, anchor)
  }, [])

  const setViewportNode = useCallback(
    (node: HTMLDivElement | null) => {
      const previous = viewportRef.current
      if (previous) {
        previous.removeEventListener('wheel', onWheelNative)
      }

      viewportRef.current = node

      if (node) {
        node.addEventListener('wheel', onWheelNative, { passive: false })
      }
    },
    [onWheelNative]
  )

  useEffect(() => {
    return () => {
      const viewport = viewportRef.current
      if (viewport) {
        viewport.removeEventListener('wheel', onWheelNative)
      }
    }
  }, [onWheelNative])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onActiveIdChange(null)
      resetZoom()
    }
    onOpenChange(next)
  }

  const handleSelect = (id: string) => {
    onActiveIdChange(id)
  }

  const handleZoomIn = () => {
    applyZoom(zoomRef.current + ZOOM_STEP)
  }

  const handleZoomOut = () => {
    applyZoom(zoomRef.current - ZOOM_STEP)
  }

  const handleZoomReset = () => {
    resetZoom()
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    if (zoomRef.current <= MIN_ZOOM) return
    if (event.button !== 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    panSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y
    }
    setIsPanning(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    setPanState({
      x: session.originX + (event.clientX - session.startX),
      y: session.originY + (event.clientY - session.startY)
    })
  }

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    panSessionRef.current = null
    setIsPanning(false)
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      panSessionRef.current = null
      setIsPanning(false)
      pinchSessionRef.current = {
        startDistance: getTouchDistance(event.touches),
        startZoom: zoomRef.current
      }
      return
    }

    if (event.touches.length === 1 && zoomRef.current > MIN_ZOOM) {
      const touch = event.touches[0]
      panSessionRef.current = {
        pointerId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y
      }
      setIsPanning(true)
    }
  }

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && pinchSessionRef.current) {
      event.preventDefault()
      const distance = getTouchDistance(event.touches)
      if (distance <= 0 || pinchSessionRef.current.startDistance <= 0) return
      const ratio = distance / pinchSessionRef.current.startDistance
      applyZoom(pinchSessionRef.current.startZoom * ratio)
      return
    }

    const session = panSessionRef.current
    if (!session || event.touches.length !== 1) return

    event.preventDefault()
    const touch = event.touches[0]
    setPanState({
      x: session.originX + (touch.clientX - session.startX),
      y: session.originY + (touch.clientY - session.startY)
    })
  }

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchSessionRef.current = null
    }

    if (event.touches.length === 0) {
      panSessionRef.current = null
      setIsPanning(false)
      return
    }

    if (event.touches.length === 1 && zoomRef.current > MIN_ZOOM) {
      const touch = event.touches[0]
      panSessionRef.current = {
        pointerId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y
      }
      setIsPanning(true)
    }
  }

  const zoomPercent = Math.round(zoom * 100)
  const canZoomOut = zoom > MIN_ZOOM
  const canZoomIn = zoom < MAX_ZOOM

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[96vh] max-h-[96vh] w-[calc(100%-1rem)] max-w-[min(98vw,1800px)] flex-col gap-3 overflow-hidden rounded-2xl border-line bg-card p-3 pt-12 sm:p-4 sm:pt-12">
        {previewImage && (
          <>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                className="absolute start-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-line bg-card/95 p-1 shadow-sm backdrop-blur-sm"
                role="toolbar"
                aria-label="کنترل بزرگ‌نمایی"
              >
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={!canZoomOut}
                  aria-label="کوچک‌نمایی"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-track/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  <ZoomOut className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  aria-label="بازنشانی بزرگ‌نمایی به ۱۰۰٪"
                  className="min-w-14 rounded-lg px-2 py-1.5 text-xs tabular-nums text-ink transition-colors hover:bg-track/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {zoomPercent}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={!canZoomIn}
                  aria-label="بزرگ‌نمایی"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-track/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  <ZoomIn className="size-4" aria-hidden />
                </button>
              </div>

              <div
                ref={setViewportNode}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={cn(
                  'flex min-h-0 flex-1 items-center justify-center overflow-hidden overscroll-none rounded-xl bg-canvas touch-none',
                  zoom > MIN_ZOOM
                    ? isPanning
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : 'cursor-default'
                )}
              >
                <img
                  src={previewImage.dataUrl}
                  alt="پیش‌نمایش تصویر"
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 120ms ease-out'
                  }}
                />
              </div>
            </div>
            {images.length > 0 && (
              <ul
                className="flex shrink-0 gap-2 overflow-x-auto pb-1"
                aria-label="فهرست تصاویر"
              >
                {images.map((image, index) => {
                  const selected = image.id === activeId

                  return (
                    <li key={image.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelect(image.id)}
                        aria-label={`تصویر ${index + 1}`}
                        aria-current={selected ? 'true' : undefined}
                        className={cn(
                          'size-16 overflow-hidden rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          selected
                            ? 'border-accent'
                            : 'border-line opacity-70 hover:opacity-100'
                        )}
                      >
                        <img
                          src={image.dataUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
