import { Trophy, TrendingUp, ShieldCheck, Zap } from 'lucide-react'
import AnimatedNumber from '../ui/AnimatedNumber'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

/**
 * Vue proxy bid + temps réel.
 *  - `ranking` : {floor_price, displayed_price, min_next_bid, increment, bidders_count, i_am_leading}
 *  - `extendedFlash` (optionnel) : { ts } pour afficher le bandeau "Timer prolongé"
 *  - `livePulse` (optionnel) : true pendant un instant après un new_bid pour pulse-flash
 */
export default function BidRanking({ ranking, extendedFlash = null, livePulse = false }) {
  if (!ranking || typeof ranking !== 'object' || Array.isArray(ranking)) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        Aucune offre soumise pour le moment. Soyez le premier !
      </div>
    )
  }

  const { floor_price, displayed_price, min_next_bid, increment, bidders_count, i_am_leading } = ranking

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">État de l'enchère</p>

      {/* Banner anti-snipe extension */}
      {extendedFlash && (
        <div
          key={extendedFlash.ts}
          className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs animate-[flash_0.6s_ease-out]"
        >
          <Zap className="h-3.5 w-3.5 text-amber-700" />
          <span><strong>Nouvelle offre</strong> — Timer prolongé +10 min</span>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-2 text-sm">
        {floor_price != null && (
          <div className="flex justify-between items-center p-2.5 rounded-lg bg-gray-50 border border-gray-200">
            <dt className="text-gray-600 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-gray-500" />
              Prix plancher (engagement vendeur)
            </dt>
            <dd className="font-semibold">{formatMoney(floor_price)}</dd>
          </div>
        )}

        <div className={`flex justify-between items-center p-3 rounded-lg bg-[#FFEDD5] border border-[#FDBA74] transition-colors ${
          livePulse ? 'animate-[pulseGlow_0.8s_ease-out]' : ''
        }`}>
          <dt className="text-[#9A3412] font-medium flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Prix affiché
          </dt>
          <dd className="text-lg font-bold text-[#9A3412]">
            {displayed_price != null ? (
              <AnimatedNumber value={displayed_price} format={formatMoney} />
            ) : '—'}
          </dd>
        </div>

        {min_next_bid != null && (
          <div className="flex justify-between items-center p-2.5 rounded-lg bg-gray-50 border border-gray-200">
            <dt className="text-gray-600 text-xs">
              Pour surenchérir : ≥ <strong>{formatMoney(min_next_bid)}</strong>
              <span className="text-gray-400"> (incrément {formatMoney(increment)})</span>
            </dt>
          </div>
        )}
      </dl>

      <div className="text-xs text-gray-500">
        {bidders_count === 0 ? (
          "Aucun acheteur n'a encore enchéri."
        ) : (
          <>
            <AnimatedNumber value={bidders_count} className="font-semibold text-gray-700" />
            {' '}acheteur{bidders_count > 1 ? 's' : ''} {bidders_count > 1 ? 'sont' : 'est'} en lice.
          </>
        )}
      </div>

      {i_am_leading === true && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 animate-pulse">
          <Trophy className="h-4 w-4 text-emerald-700 flex-shrink-0" />
          <p className="text-sm text-emerald-900">
            <strong>Vous êtes actuellement en avance.</strong>
          </p>
        </div>
      )}
      {i_am_leading === false && bidders_count > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <Zap className="h-4 w-4 text-red-700 flex-shrink-0" />
          <p className="text-sm text-red-900">
            <strong>Vous avez été dépassé — Surenchérissez !</strong>
          </p>
        </div>
      )}

      <style>{`
        @keyframes flash {
          0%   { transform: scale(0.97); box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          60%  { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(245,158,11,0); }
          100% { transform: scale(1); }
        }
        @keyframes pulseGlow {
          0%   { box-shadow: 0 0 0 0 rgba(234,88,12,0.4); }
          100% { box-shadow: 0 0 0 14px rgba(234,88,12,0); }
        }
      `}</style>
    </div>
  )
}
