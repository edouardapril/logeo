import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, Clock, ArrowRight, MapPin, AlertTriangle,
  CheckCircle2, XCircle, Hourglass, Building2,
} from 'lucide-react'
import { myAuctionsApi } from '../../api/acheteur'
import Spinner from '../../components/ui/Spinner'
import CountdownBoxes from '../../components/ui/CountdownBoxes'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

const TABS = [
  { value: 'en_cours',   label: 'En cours',     icon: Clock },
  { value: 'dd_en_cours',label: 'Due diligence',icon: Hourglass },
  { value: 'gagne',      label: 'Gagnées',      icon: Trophy },
  { value: 'perdu',      label: 'Perdues',      icon: XCircle },
]

function StatusChip({ a }) {
  if (a.category === 'en_cours') {
    return a.i_am_leading ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 animate-pulse">
        🟢 En avance
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
        🔴 Dépassé
      </span>
    )
  }
  if (a.category === 'dd_en_cours') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
        a.dd_urgent
          ? 'bg-red-50 text-red-700 ring-red-200 animate-pulse'
          : 'bg-amber-50 text-amber-700 ring-amber-200'
      }`}>
        <Hourglass className="h-3 w-3" />
        DD en cours{a.dd_urgent ? ' · URGENT' : ''}
      </span>
    )
  }
  if (a.category === 'gagne') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Deal finalisé
      </span>
    )
  }
  if (a.category === 'perdu') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200">
        <XCircle className="h-3 w-3" /> Non retenu
      </span>
    )
  }
  return null
}

function AuctionCard({ a }) {
  return (
    <Link
      to={`/acheteur/deals/${a.deal_id}`}
      className="card p-5 block hover:shadow-md hover:border-[#FDBA74] transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">
            {PROPERTY_TYPE_LABELS[a.property_type] || a.property_type}
          </p>
          <p className="font-semibold text-gray-900 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            {a.city}
            {a.region && <span className="text-xs text-gray-400 font-normal">· {regionLabel(a.region)}</span>}
          </p>
        </div>
        <StatusChip a={a} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm mb-3">
        {a.floor_price != null && (
          <div>
            <dt className="text-xs text-gray-500">Prix plancher</dt>
            <dd className="font-medium text-gray-700">{formatMoney(a.floor_price)}</dd>
          </div>
        )}
        {a.displayed_price != null && (
          <div>
            <dt className="text-xs text-gray-500">Prix affiché</dt>
            <dd className="font-bold text-[#9A3412]">{formatMoney(a.displayed_price)}</dd>
          </div>
        )}
        {a.my_max != null && (
          <div>
            <dt className="text-xs text-gray-500">Mon offre max</dt>
            <dd className="font-medium">
              {formatMoney(a.my_max)}
              <span className="text-xs text-gray-400 ml-1">({a.my_bids_count})</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        {a.category === 'en_cours' && a.bid_close_at ? (
          <CountdownBoxes closeAt={a.bid_close_at} size="compact" />
        ) : a.category === 'dd_en_cours' && a.due_diligence_deadline ? (
          <CountdownBoxes closeAt={a.due_diligence_deadline} size="compact" />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        {a.category === 'en_cours' && !a.i_am_leading && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold link-brand">
            Surenchérir <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Link>
  )
}

export default function MesEncheres() {
  const [tab, setTab] = useState('en_cours')

  const { data: items, isLoading } = useQuery({
    queryKey: ['acheteur', 'my-auctions'],
    queryFn: myAuctionsApi,
    refetchInterval: 30_000,
  })

  const counts = useMemo(() => {
    if (!items) return {}
    return items.reduce((acc, x) => {
      acc[x.category] = (acc[x.category] || 0) + 1
      return acc
    }, {})
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter(x => x.category === tab)
  }, [items, tab])

  if (isLoading) return <Spinner label="Chargement de mes enchères..." />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mes enchères</h1>
      <p className="text-sm text-gray-600 mb-6">
        Toutes les enchères auxquelles tu participes ou as participé.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const c = counts[t.value] || 0
          const active = tab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                active
                  ? 'border-[#EA580C] text-[#EA580C]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span className={`text-xs px-1.5 rounded-full ${
                active ? 'bg-[#FFEDD5] text-[#C2410C]' : 'bg-gray-100 text-gray-600'
              }`}>{c}</span>
            </button>
          )
        })}
      </div>

      {/* Alerte DD urgent en haut */}
      {counts.dd_en_cours > 0 && items?.some(x => x.dd_urgent) && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 text-sm">
              Due diligence à confirmer rapidement !
            </p>
            <p className="text-xs text-red-800 mt-1">
              Une (ou plusieurs) de tes due diligence expire dans moins de 24h.
              Sans confirmation, le dépôt 25% est conservé et le deal passe au 2e offrant.
            </p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucune enchère dans cette catégorie.</p>
          {tab === 'en_cours' && (
            <Link to="/acheteur/deals" className="mt-3 inline-flex link-brand font-medium text-sm">
              Voir tous les deals disponibles →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(a => <AuctionCard key={a.deal_id} a={a} />)}
        </div>
      )}
    </div>
  )
}
