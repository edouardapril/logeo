import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Building2, Users, Clock, CheckCircle2, ArrowRight,
  TrendingUp, AlertTriangle, AlertOctagon, Hourglass,
} from 'lucide-react'
import { adminMetricsApi } from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Timer from '../../components/ui/Timer'

const formatMoney = (cents) =>
  new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(Math.round((cents || 0) / 100))

function StatCard({ icon: Icon, label, value, hint, tone = 'logeo', alert = false }) {
  const tones = {
    logeo: 'bg-[#FFEDD5] text-[#C2410C]',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-100 text-gray-700',
  }
  return (
    <div className={`card p-5 ${alert ? 'ring-2 ring-red-200' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: adminMetricsApi,
    refetchInterval: 30_000,  // rafraîchir toutes les 30s
  })

  if (isLoading) return <Spinner label="Chargement du tableau de bord..." />
  if (!data) return null

  const activeAuctions = data.active_auctions || []
  const ddWindow = data.due_diligence_window || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord</h1>
      <p className="text-sm text-gray-600 mb-6">Vue temps réel · refresh 30s</p>

      {/* Alertes en haut */}
      {(data.auctions_closing_soon > 0 || data.dd_expiring_soon > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {data.auctions_closing_soon > 0 && (
            <div className="card p-4 bg-red-50 border-red-200 flex items-center gap-3">
              <AlertOctagon className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 text-sm">
                  {data.auctions_closing_soon} enchère{data.auctions_closing_soon > 1 ? 's ferment' : ' ferme'} dans les 2h
                </p>
                <Link to="/admin/deals" className="text-xs link-brand">Voir les enchères →</Link>
              </div>
            </div>
          )}
          {data.dd_expiring_soon > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-200 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">
                  {data.dd_expiring_soon} due diligence expire{data.dd_expiring_soon > 1 ? 'nt' : ''} dans les 24h
                </p>
                <p className="text-xs text-amber-800">Pas de confirmation = passage au 2e offrant</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Métriques principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Building2}
          label="Enchères actives"
          value={activeAuctions.length}
          hint={data.auctions_closing_soon ? `${data.auctions_closing_soon} ferment <2h` : undefined}
          tone="logeo"
          alert={data.auctions_closing_soon > 0}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenus ce mois"
          value={formatMoney(data.revenue_this_month_cents)}
          hint={`Total cumulé : ${formatMoney(data.revenue_total_cents)}`}
          tone="emerald"
        />
        <StatCard
          icon={Hourglass}
          label="Solde 75 % en attente"
          value={formatMoney(data.pending_balance_cents)}
          hint="Dépôts reçus, soldes pas encore"
          tone="amber"
        />
        <StatCard
          icon={Clock}
          label="Acheteurs en DD"
          value={ddWindow.length}
          hint={data.dd_expiring_soon ? `${data.dd_expiring_soon} expire <24h` : 'Fenêtre 5 jours'}
          tone={data.dd_expiring_soon ? 'red' : 'gray'}
          alert={data.dd_expiring_soon > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active auctions list */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#C2410C]" />
              Enchères en cours ({activeAuctions.length})
            </h2>
            <Link to="/admin/deals" className="text-sm link-brand hover:underline flex items-center gap-1">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {!activeAuctions.length ? (
            <p className="text-sm text-gray-500 py-8 text-center">Aucune enchère active</p>
          ) : (
            <ul className="space-y-2">
              {activeAuctions.slice(0, 6).map(a => (
                <li key={a.deal_id}>
                  <Link
                    to={`/admin/deals/${a.deal_id}`}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      a.closing_soon ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-900">{a.city}</p>
                      <p className="text-xs text-gray-500">
                        {a.bidders_count} acheteur{a.bidders_count > 1 ? 's' : ''}
                        {a.displayed_price && ` · ${formatMoney(a.displayed_price * 100)}`}
                      </p>
                    </div>
                    {a.bid_close_at && <Timer closeAt={a.bid_close_at} size="sm" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* DD window list */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-[#C2410C]" />
              Fenêtre due diligence ({ddWindow.length})
            </h2>
          </div>
          {!ddWindow.length ? (
            <p className="text-sm text-gray-500 py-8 text-center">Aucune DD en attente</p>
          ) : (
            <ul className="space-y-2">
              {ddWindow.slice(0, 6).map(d => (
                <li key={d.deal_id}>
                  <Link
                    to={`/admin/deals/${d.deal_id}`}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      d.hours_remaining < 24 ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-900">{d.city}</p>
                      <p className="text-xs text-gray-500">{d.acheteur_name}</p>
                    </div>
                    <div className="text-right">
                      {d.due_diligence_deadline && (
                        <Timer closeAt={d.due_diligence_deadline} size="sm" />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
