import { Link } from 'react-router-dom'
import { Building2, MapPin, TrendingUp, Home } from 'lucide-react'
import Badge from '../ui/Badge'
import Timer from '../ui/Timer'

const PROPERTY_LABELS = {
  multiplex: 'Multiplex',
  commercial: 'Commercial',
  mixte: 'Mixte',
  industriel: 'Industriel',
  terrain: 'Terrain',
}

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function DealCard({ deal, to }) {
  return (
    <Link
      to={to}
      className="card p-5 block hover:shadow-md hover:border-logeo-200 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-logeo-50 text-logeo-600 flex items-center justify-center">
            {deal.property_type === 'terrain' ? <MapPin className="h-5 w-5" /> :
             deal.property_type === 'commercial' ? <Building2 className="h-5 w-5" /> :
             <Home className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-xs text-gray-500">{PROPERTY_LABELS[deal.property_type]}</p>
            <p className="font-semibold text-gray-900">{deal.city}</p>
          </div>
        </div>
        <Badge status={deal.status} />
      </div>

      {deal.teaser_text && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{deal.teaser_text}</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Prix demandé</p>
          <p className="font-semibold text-gray-900">{formatMoney(deal.asking_price)}</p>
        </div>
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
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Fin de l'enchère</p>
          <Timer closeAt={deal.bid_close_at} />
        </div>
      )}
    </Link>
  )
}
