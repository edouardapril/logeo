import { Star } from 'lucide-react'

/**
 * Affiche ou permet de saisir une note 1-5.
 *  - readonly: rendering pur, pas de hover
 *  - interactive: onChange(n) appelé sur clic
 */
export default function RatingStars({
  value = 0,
  onChange,
  size = 'md',
  readonly = false,
  showNumber = false,
  count = null,
}) {
  const sz = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' }[size] || 'h-4 w-4'
  const stars = [1, 2, 3, 4, 5].map((n) => {
    const filled = n <= Math.round(value || 0)
    const cls = `${sz} ${filled ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`
    if (readonly || !onChange) return <Star key={n} className={cls} />
    return (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className="hover:scale-110 transition-transform"
        aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
      >
        <Star className={cls} />
      </button>
    )
  })

  return (
    <span className="inline-flex items-center gap-0.5">
      {stars}
      {showNumber && value != null && (
        <span className="ml-1.5 text-sm text-gray-700 font-medium">
          {Number(value).toFixed(1)}
          {count != null && (
            <span className="text-gray-400 font-normal"> ({count})</span>
          )}
        </span>
      )}
    </span>
  )
}
