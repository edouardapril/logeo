import { Link } from 'react-router-dom'
import { Building2, MapPin, TrendingUp, Home } from 'lucide-react'
import Badge from '../ui/Badge'
import CountdownBoxes from '../ui/CountdownBoxes'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { fileUrl } from '../../utils/url'
import { regionLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

export default function DealCard({ deal, to }) {
  // Pre-NDA on n'expose que `teaser_photo_path` (watermarqué public).
  // Si on a accès à `photo_paths` (post-NDA), on prend la première photo HD.
  const cover = deal.teaser_photo_path || deal.photo_paths?.[0]
  const isLand = deal.property_type === 'terrain' || deal.property_type === 'terrain_constructible'
  const isCommercial = deal.property_type === 'commercial'

  return (
    <Link
      to={to}
      className="card p-5 block hover:shadow-md hover:border-[#FDBA74] transition-all duration-200 group"
    >
      {cover && (
        <div className="-mx-5 -mt-5 mb-3 h-36 overflow-hidden rounded-t-xl bg-gray-100">
          <img
            src={fileUrl(cover)}
            alt={deal.city}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center flex-shrink-0">
            {isLand ? <MapPin className="h-5 w-5" /> :
             isCommercial ? <Building2 className="h-5 w-5" /> :
             <Home className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
            </p>
            <p className="font-semibold text-gray-900 truncate">{deal.city}</p>
            {deal.region && (
              <p className="text-[10px] text-gray-400 truncate">{regionLabel(deal.region)}</p>
            )}
          </div>
        </div>
        <Badge status={deal.status} />
      </div>

      {deal.teaser_text && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{deal.teaser_text}</p>
      )}

      {/* Item 5 : on n'affiche plus 'asking_price' aux acheteurs — uniquement le plancher */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        {deal.floor_price != null && (
          <div>
            <p className="text-xs text-gray-500">Prix plancher</p>
            <p className="font-semibold text-[#C2410C]">{formatMoney(deal.floor_price)}</p>
          </div>
        )}
        {deal.yield_pct != null && (
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Rendement
            </p>
            <p className="font-semibold text-emerald-600">{deal.yield_pct.toFixed(2)}%</p>
          </div>
        )}
      </div>

      {deal.bid_close_at && deal.status === 'bid' && (
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">Fin de l'enchère</span>
          <CountdownBoxes closeAt={deal.bid_close_at} size="compact" />
        </div>
      )}
    </Link>
  )
}
