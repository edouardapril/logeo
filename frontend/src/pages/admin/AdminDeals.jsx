import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Clock4, ShieldCheck, MessageSquare, Trophy, Pencil } from 'lucide-react'
import {
  adminListDealsEnrichedApi, extendBidCloseApi,
} from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Timer from '../../components/ui/Timer'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'analyse', label: 'En analyse' },
  { value: 'bid', label: 'Enchère active' },
  { value: 'intro', label: 'Intro confirmée' },
  { value: 'pa_signed', label: 'PA signée' },
  { value: 'nogo', label: 'Refusés' },
]

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

export default function AdminDeals() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [extendModal, setExtendModal] = useState(null)  // { dealId, currentClose }
  const [newCloseAt, setNewCloseAt] = useState('')

  const { data: deals, isLoading } = useQuery({
    queryKey: ['admin', 'deals-enriched', status],
    queryFn: () => adminListDealsEnrichedApi(status || undefined),
    refetchInterval: 30_000,
  })

  const extend = useMutation({
    mutationFn: ({ dealId, iso }) => extendBidCloseApi(dealId, iso),
    onSuccess: () => {
      toast.success('Timer modifié')
      setExtendModal(null); setNewCloseAt('')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const openExtend = (deal) => {
    setExtendModal({ dealId: deal.id, currentClose: deal.bid_close_at })
    // Pré-remplit avec close + 1h
    if (deal.bid_close_at) {
      const dt = new Date(deal.bid_close_at)
      dt.setHours(dt.getHours() + 1)
      setNewCloseAt(dt.toISOString().slice(0, 16))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tous les deals</h1>
      <p className="text-sm text-gray-600 mb-6">Compteurs en temps réel · refresh 30s</p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              status === s.value
                ? 'bg-[#EA580C] text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Type · Ville</th>
                <th className="px-4 py-3 text-right">Prix demandé</th>
                <th className="px-4 py-3 text-right">Plancher</th>
                <th className="px-4 py-3 text-center" title="Bids reçus">
                  <Trophy className="h-3.5 w-3.5 inline" />
                </th>
                <th className="px-4 py-3 text-center" title="NDAs signés">
                  <ShieldCheck className="h-3.5 w-3.5 inline" />
                </th>
                <th className="px-4 py-3 text-center" title="Questions sans réponse">
                  <MessageSquare className="h-3.5 w-3.5 inline" />
                </th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Fin / créé</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals?.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/deals/${d.id}`} className="font-medium text-gray-900 hover:text-[#EA580C]">
                      {PROPERTY_TYPE_LABELS[d.property_type] || d.property_type}
                    </Link>
                    <p className="text-xs text-gray-500">{d.city}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-right">{formatMoney(d.asking_price)}</td>
                  <td className="px-4 py-3 text-right text-[#C2410C] font-medium">
                    {formatMoney(d.floor_price)}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{d.bids_count}</td>
                  <td className="px-4 py-3 text-center font-medium">{d.ndas_count}</td>
                  <td className="px-4 py-3 text-center">
                    {d.unanswered_questions_count > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200">
                        {d.unanswered_questions_count}
                      </span>
                    ) : (
                      <span className="text-gray-300">·</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {d.status === 'bid' && d.bid_close_at ? (
                      <Timer closeAt={d.bid_close_at} size="sm" />
                    ) : (
                      <span>{new Date(d.created_at).toLocaleDateString('fr-CA')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status === 'bid' && (
                      <button
                        onClick={() => openExtend(d)}
                        className="btn-secondary text-xs"
                        title="Modifier la fermeture de l'enchère"
                      >
                        <Pencil className="h-3 w-3" /> Timer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deals?.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-500">Aucun deal</p>
          )}
        </div>
      )}

      {/* Modal modifier le timer */}
      <Modal
        open={!!extendModal}
        onClose={() => { setExtendModal(null); setNewCloseAt('') }}
        title="Modifier la fermeture de l'enchère"
      >
        <div className="space-y-4">
          {extendModal?.currentClose && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="text-xs text-gray-500">Fermeture actuelle</p>
              <p className="font-medium">
                {new Date(extendModal.currentClose).toLocaleString('fr-CA')}
              </p>
            </div>
          )}
          <Input
            label="Nouvelle fermeture"
            type="datetime-local"
            value={newCloseAt}
            onChange={(e) => setNewCloseAt(e.target.value)}
            hint="Prolonger ou raccourcir l'enchère. Job APScheduler replanifié automatiquement."
          />
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
            <Clock4 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Tous les bidders qui suivent l'enchère verront le nouveau timer en temps réel.
              Email de notification non envoyé automatiquement — tu peux les avertir manuellement si besoin.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setExtendModal(null); setNewCloseAt('') }}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (!newCloseAt) { toast.error('Date requise'); return }
                const iso = new Date(newCloseAt).toISOString()
                extend.mutate({ dealId: extendModal.dealId, iso })
              }}
              disabled={extend.isPending}
              className="btn-primary"
            >
              {extend.isPending ? '...' : 'Modifier le timer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
