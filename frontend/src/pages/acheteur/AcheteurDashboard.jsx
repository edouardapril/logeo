import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheck, Trophy, DollarSign, Activity, ArrowRight, Building2, MapPin,
  Sparkles,
} from 'lucide-react'
import { acheteurDashboardApi } from '../../api/acheteur'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import OnboardingProgress from '../../components/acheteur/OnboardingProgress'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel } from '../../utils/quebec'
import CountdownBoxes from '../../components/ui/CountdownBoxes'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

function KpiCard({ icon: Icon, label, value, color = 'orange', formatFn }) {
  const palettes = {
    orange:  { bg: 'bg-[#FFEDD5]', text: 'text-[#9A3412]', icon: 'text-[#C2410C]' },
    blue:    { bg: 'bg-blue-50',   text: 'text-blue-900',  icon: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', icon: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-50',  text: 'text-amber-900',  icon: 'text-amber-600' },
  }
  const p = palettes[color] || palettes.orange
  const display = formatFn ? formatFn(value) : value
  return (
    <div className={`card p-5 ${p.bg} border-transparent`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${p.icon}`} />
        <p className="text-xs uppercase tracking-wide text-gray-600 font-semibold">{label}</p>
      </div>
      <p className={`text-2xl font-bold mt-2 ${p.text}`}>{display}</p>
    </div>
  )
}

function ActiveDealRow({ d }) {
  return (
    <Link
      to={`/acheteur/deals/${d.deal_id}`}
      className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 flex items-center gap-1.5 truncate">
          <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          {d.city}{d.region && <span className="text-xs text-gray-500"> · {regionLabel(d.region)}</span>}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {PROPERTY_TYPE_LABELS[d.property_type] || d.property_type} · {d.my_status_label}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {d.displayed_price != null && (
          <span className="font-semibold text-[#C2410C] text-sm">
            {formatMoney(d.displayed_price)}
          </span>
        )}
        <Badge status={d.status} />
        <ArrowRight className="h-4 w-4 text-gray-300" />
      </div>
    </Link>
  )
}

function DiscoverCard({ d }) {
  const cover = d.teaser_photo_path
  return (
    <Link
      to={`/acheteur/deals/${d.deal_id}`}
      className="card overflow-hidden block hover:shadow-md hover:border-[#FDBA74] transition-all"
    >
      <div className="h-32 bg-gray-100">
        {cover ? (
          <img src={fileUrl(cover)} alt={d.city} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-300">
            <Building2 className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#C2410C] font-semibold">
          {PROPERTY_TYPE_LABELS[d.property_type] || d.property_type}
        </p>
        <p className="font-semibold text-gray-900 text-sm truncate">{d.city}</p>
        {d.region && <p className="text-[11px] text-gray-500">{regionLabel(d.region)}</p>}
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-gray-500">Plancher</span>
          <span className="font-bold text-[#C2410C]">{formatMoney(d.floor_price)}</span>
        </div>
        {d.bid_close_at && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <CountdownBoxes closeAt={d.bid_close_at} size="compact" />
          </div>
        )}
      </div>
    </Link>
  )
}

export default function AcheteurDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['acheteur', 'dashboard'],
    queryFn: acheteurDashboardApi,
    refetchInterval: 30_000,
  })

  if (isLoading) return <Spinner label="Chargement de votre tableau de bord..." />
  if (!data) return null

  const { kpis, active_deals, discover } = data

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord</h1>
        <p className="text-sm text-gray-600">
          Vue d'ensemble de votre activité Logeo
        </p>
      </div>

      <OnboardingProgress />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={ShieldCheck} label="NDAs signées" value={kpis.ndas_signed} color="blue" />
        <KpiCard icon={Activity} label="Offres en cours" value={kpis.active_bids_count} color="orange" />
        <KpiCard icon={Trophy} label="Deals gagnés" value={kpis.won_deals} color="amber" />
        <KpiCard
          icon={DollarSign}
          label="Valeur des offres"
          value={kpis.total_active_bids_value}
          color="emerald"
          formatFn={formatMoney}
        />
      </div>

      {/* Mes dossiers actifs */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Mes dossiers actifs ({active_deals.length})</h2>
          <Link to="/acheteur/mes-encheres" className="text-xs link-brand font-medium">
            Voir mes enchères →
          </Link>
        </div>
        {active_deals.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun dossier en cours. Signez une NDA sur un deal pour démarrer.
          </p>
        ) : (
          <div className="space-y-2">
            {active_deals.map(d => <ActiveDealRow key={d.deal_id} d={d} />)}
          </div>
        )}
      </div>

      {/* Deals à découvrir */}
      {discover.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#C2410C]" /> Deals à découvrir
            </h2>
            <Link to="/acheteur/deals" className="text-xs link-brand font-medium">
              Voir tous les deals →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {discover.map(d => <DiscoverCard key={d.deal_id} d={d} />)}
          </div>
        </div>
      )}
    </div>
  )
}
