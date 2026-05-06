import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Hourglass, CheckCircle2, Download, BarChart3, Calendar, ArrowRight,
} from 'lucide-react'
import { adminRevenuesApi, adminRevenuesCsvUrl } from '../../api/admin'
import client from '../../api/client'
import Spinner from '../../components/ui/Spinner'

const fmt = (cents) =>
  new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(Math.round((cents || 0) / 100))

function StatCard({ icon: Icon, label, value, hint, tone = 'logeo' }) {
  const tones = {
    logeo:   'bg-[#FFEDD5] text-[#C2410C]',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-700',
    blue:    'bg-blue-50 text-blue-700',
  }
  return (
    <div className="card p-5">
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

/** Mini-chart en barres pures CSS (pas de lib externe). */
function MonthlyBarChart({ data }) {
  const max = Math.max(1, ...data.map(d => d.revenue_cents))
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#C2410C]" /> Revenus mensuels (12 derniers mois)
      </h3>
      <div className="flex items-end gap-2 h-48">
        {data.map(d => {
          const heightPct = max > 0 ? (d.revenue_cents / max) * 100 : 0
          return (
            <div key={d.ym} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-[#FED7AA] hover:bg-[#FB923C] transition-colors rounded-t-md relative"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                  title={`${d.label}: ${fmt(d.revenue_cents)}`}
                >
                  {d.revenue_cents > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-[#C2410C] opacity-0 group-hover:opacity-100 whitespace-nowrap">
                      {fmt(d.revenue_cents)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const STATUS_LABEL = {
  complete:     { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: '✓ Complet' },
  deposit_only: { cls: 'bg-amber-50 text-amber-700 ring-amber-200',       label: '⏱ Solde en attente' },
  pending:      { cls: 'bg-gray-100 text-gray-700 ring-gray-200',         label: '— En attente' },
}

export default function AdminRevenues() {
  const [monthFilter, setMonthFilter] = useState('')  // ex: "2026-04"

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'revenues'],
    queryFn: () => adminRevenuesApi(12),
    refetchInterval: 60_000,
  })

  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return []
    if (!monthFilter) return data.transactions
    return data.transactions.filter(t =>
      t.last_payment_at && t.last_payment_at.startsWith(monthFilter)
    )
  }, [data?.transactions, monthFilter])

  const downloadCsv = async () => {
    // Fetch with auth header → blob → download
    const res = await client.get('/admin/revenues/csv', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'logeo-revenus.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) return <Spinner label="Chargement des revenus..." />
  if (!data) return null

  // Liste des mois uniques pour le filtre
  const months = (data.monthly_aggregates || []).map(m => m.ym).reverse()

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Revenus Logeo</h1>
          <p className="text-sm text-gray-600">Vue temps réel · paiements Stripe succeeded</p>
        </div>
        <button onClick={downloadCsv} className="btn-secondary text-sm">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={TrendingUp}
          label="Total cumulé"
          value={fmt(data.total_revenue_cents)}
          tone="emerald"
        />
        <StatCard
          icon={Calendar}
          label="Revenus ce mois"
          value={fmt(data.this_month_revenue_cents)}
          tone="logeo"
        />
        <StatCard
          icon={Hourglass}
          label="Solde 75 % en attente"
          value={fmt(data.pending_balance_cents)}
          hint="Dépôts reçus, soldes pas encore"
          tone="amber"
        />
        <StatCard
          icon={CheckCircle2}
          label="Deals finalisés ce mois"
          value={data.completed_deals_this_month}
          tone="blue"
        />
      </div>

      <div className="mb-6">
        <MonthlyBarChart data={data.monthly_aggregates} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-semibold text-gray-900">
            Transactions ({filteredTransactions.length})
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Filtre mois :</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="">Tous</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {!filteredTransactions.length ? (
          <p className="py-12 text-center text-sm text-gray-500">
            Aucune transaction pour cette période.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Deal · Acheteur</th>
                <th className="px-4 py-2.5 text-right">Dépôt 25 %</th>
                <th className="px-4 py-2.5 text-right">Solde 75 %</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map(t => {
                const cfg = STATUS_LABEL[t.status] || STATUS_LABEL.pending
                return (
                  <tr key={t.deal_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {t.last_payment_at ? new Date(t.last_payment_at).toLocaleDateString('fr-CA') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/deals/${t.deal_id}`} className="font-medium text-gray-900 hover:text-[#EA580C] inline-flex items-center gap-1">
                        {t.deal_city} <ArrowRight className="h-3 w-3" />
                      </Link>
                      <p className="text-xs text-gray-500">{t.acheteur_name}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-right">{fmt(t.deposit_cents)}</td>
                    <td className="px-4 py-3 font-medium text-right">{fmt(t.balance_cents)}</td>
                    <td className="px-4 py-3 font-bold text-right text-[#C2410C]">{fmt(t.total_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
