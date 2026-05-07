import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { fileUrl } from '../../utils/url'

/**
 * Slideshow simple sans dépendance externe.
 *
 * Props :
 *   - photos: string[]  paths storage (les fileUrl() sont calculés ici)
 *   - height?: string   classes Tailwind hauteur (default "h-64")
 *   - showThumbnails?: boolean  barre miniatures sous l'image
 *   - initialIndex?: number
 *   - alt?: string      texte alt pour l'image
 */
export default function DealPhotoSlideshow({
  photos,
  height = 'h-64',
  showThumbnails = false,
  initialIndex = 0,
  alt = 'Photo',
}) {
  const safe = Array.isArray(photos) ? photos.filter(Boolean) : []
  const [idx, setIdx] = useState(Math.min(initialIndex, Math.max(0, safe.length - 1)))
  const containerRef = useRef(null)

  const next = useCallback(() => {
    if (safe.length === 0) return
    setIdx(i => (i + 1) % safe.length)
  }, [safe.length])

  const prev = useCallback(() => {
    if (safe.length === 0) return
    setIdx(i => (i - 1 + safe.length) % safe.length)
  }, [safe.length])

  useEffect(() => {
    if (idx >= safe.length) setIdx(0)
  }, [idx, safe.length])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
  }

  if (safe.length === 0) {
    return (
      <div className={`relative w-full ${height} bg-gray-100 flex items-center justify-center text-gray-300`}>
        <MapPin className="h-12 w-12" />
      </div>
    )
  }

  const single = safe.length === 1

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={`relative w-full ${height} bg-gray-100 overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#FDBA74]`}
      >
        <img
          key={safe[idx]}
          src={fileUrl(safe[idx])}
          alt={`${alt} ${idx + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {!single && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Photo précédente"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Photo suivante"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
              {safe.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Aller à la photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/40 text-white text-xs font-medium">
              {idx + 1} / {safe.length}
            </div>
          </>
        )}
      </div>

      {showThumbnails && !single && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {safe.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Sélectionner photo ${i + 1}`}
              className={`flex-shrink-0 h-16 w-24 rounded-md overflow-hidden border-2 transition ${
                i === idx ? 'border-[#EA580C]' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <img
                src={fileUrl(p)}
                alt={`Miniature ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
