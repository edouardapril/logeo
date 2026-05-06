import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Receipt, CheckCircle2, AlertCircle, Clock, RefreshCw, ArrowRight,
} from 'lucide-react'
import {
  adminListPaymentsApi, adminChargeDepositApi,
  adminChargeBalanceApi, adminFallbackNextBidderApi,
} from '../../api/payments'
import Spinner from '../../components/ui/Spinner'

const formatMoney = (cents) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 })
    .format(Math.round(cents / 100))

const STATES = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'requires_action', label: 'Action requise' },
  { value: 'succeeded', label: 'Réussi' },
  { value: 'failed', label: 'Échoué' },
  { value: 'refunded', label: 'Remboursé' },
]

const STATE_BADGES = {
  pending:         { cls: 'bg-gray-100 text-gray-700 ring-gray-200', icon: Clock },
  requires_action: { cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock },
  succeeded:       { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
  failed:          { cls: 'bg-red-50 text-red-700 ring-red-200', icon: AlertCircle },
  refunded:        { cls: 'bg-gray-100 text-gray-700 ring-gray-200', icon: RefreshCw },
}

function StateBadge({ state }) {
  const cfg = STATE_BADGES[state] || STATE_BADGES.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {state}
    </span>
  )
}

export default function AdminPayments() {
  const queryClient = useQueryClient()
  const [stateFilter, setStateFilter] = useState('')

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin', 'payments', stateFilter],
    queryFn: () => adminListPaymentsApi(stateFilter ? { state: stateFilter } : {}),
    refetchInterval: 30_000,
  })

  const chargeDeposit = useMutation({
    mutationFn: adminChargeDepositApi,
    onSuccess: (p) => {
      toast.success(p.state === 'succeeded' ? 'Dépôt débité' : `Dépôt ${p.state}`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const chargeBalance = useMutation({
    mutationFn: adminChargeBalanceApi,
    onSuccess: (p) => {
      toast.success(p.state === 'succeeded' ? 'Solde débité' : `Solde ${p.state}`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const fallback = useMutation({
    mutationFn: adminFallbackNextBidderApi,
    onSuccess: (r) => {
      if (r.status === 'no_more_bidders') toast('Aucun autre offrant', { icon: 'ℹ️' })
      else toast.success('Passé au 2e offrant')
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  // Regrouper par deal pour faciliter les actions
  const byDeal = (payments || []).reduce((acc, p) => {
    (acc[p.deal_id] = acc[p.deal_id] || []).push(p)
    return acc
  }, {})

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Paiements Stripe</h1>
      <p className="text-sm text-gray-600 mb-6">
        Liste de tous les débits par deal. Déclenchez manuellement un dépôt 25 % ou un solde 75 % si nécessaire.
      </p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATES.map(s => (
          <button
            key={s.value}
            onClick={() => setStateFilter(s.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              stateFilter === s.value
                ? 'bg-[#EA580C] text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : !payments?.length ? (
        <div className="card p-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun paiement</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDeal).map(([dealId, items]) => {
            const first = items[0]
            const hasSucceededDeposit = items.some(p => p.type === 'deposit' && p.state === 'succeeded')
            const hasSucceededBalance = items.some(p => p.type === 'balance' && p.state === 'succeeded')
            const hasPendingBalance = items.some(p => p.type === 'balance' && p.state === 'pending')

            return (
              <div key={dealId} className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Deal</p>
                    <Link to={`/admin/deals/${dealId}`} className="font-semibold text-gray-900 hover:text-[#EA580C] flex items-center gap-1">
                      {first.deal_city} <ArrowRight className="h-3 w-3" />
                    </Link>
                    <p className="text-xs text-gray-500">Acheteur : {first.acheteur_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => chargeDeposit.mutate(dealId)}
                      disabled={chargeDeposit.isPending}
                      className="btn-secondary text-xs"
                      title="Forcer le débit du dépôt 25%"
                    >
                      Débiter 25 %
                    </button>
                    <button
                      onClick={() => chargeBalance.mutate(dealId)}
                      disabled={chargeBalance.isPending || !hasSucceededDeposit || hasSucceededBalance || hasPendingBalance}
                      className="btn-secondary text-xs"
                      title="Forcer le débit du solde 75%"
                    >
                      Débiter 75 %
                    </button>
                    <button
                      onClick={() => fallback.mutate(dealId)}
                      disabled={fallback.isPending}
                      className="btn-secondary text-xs"
                      title="Passer au 2e offrant"
                    >
                      → 2e offrant
                    </button>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Montant</th>
                      <th className="px-4 py-2.5">Statut</th>
                      <th className="px-4 py-2.5">PaymentIntent</th>
                      <th className="px-4 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(p => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 capitalize">{p.type}</td>
                        <td className="px-4 py-2.5 font-medium">{formatMoney(p.amount_cents)}</td>
                        <td className="px-4 py-2.5">
                          <StateBadge state={p.state} />
                          {p.failure_message && (
                            <p className="text-[11px] text-red-600 mt-0.5">{p.failure_message}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                          {p.stripe_payment_intent_id || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {new Date(p.succeeded_at || p.failed_at || p.created_at).toLocaleString('fr-CA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
