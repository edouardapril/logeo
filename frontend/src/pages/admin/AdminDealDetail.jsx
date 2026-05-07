import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Building, User, FileText, Trophy, DollarSign } from 'lucide-react'
import {
  adminGetDealApi, adminListBidsApi, verdictApi,
  confirmDepositApi, confirmBalanceApi,
} from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input, { Textarea } from '../../components/ui/Input'
import Timer from '../../components/ui/Timer'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function AdminDealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const [verdictModal, setVerdictModal] = useState(null) // 'go' | 'nogo' | null
  const [verdictForm, setVerdictForm] = useState({
    fee_pct: 1.5, fee_minimum: 5000, bid_close_at: '', nogo_reason: '',
  })
  const [interacModal, setInteracModal] = useState(null) // 'deposit' | 'balance' | null
  const [interacRef, setInteracRef] = useState('')

  const { data: deal, isLoading } = useQuery({
    queryKey: ['admin', 'deal', dealId],
    queryFn: () => adminGetDealApi(dealId),
  })
  const { data: bids } = useQuery({
    queryKey: ['admin', 'bids', dealId],
    queryFn: () => adminListBidsApi(dealId),
  })

  const verdict = useMutation({
    mutationFn: (payload) => verdictApi(dealId, payload),
    onSuccess: () => {
      toast.success('Verdict enregistré')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setVerdictModal(null)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const confirmDeposit = useMutation({
    mutationFn: (bidId) => confirmDepositApi(dealId, { bid_id: bidId, interac_ref: interacRef, payment_type: 'deposit' }),
    onSuccess: () => {
      toast.success('Dépôt confirmé · Introduction officielle déclenchée')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setInteracModal(null); setInteracRef('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const confirmBalance = useMutation({
    mutationFn: (bidId) => confirmBalanceApi(dealId, { bid_id: bidId, interac_ref: interacRef, payment_type: 'balance' }),
    onSuccess: () => {
      toast.success('Solde confirmé · Deal archivé')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setInteracModal(null); setInteracRef('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  if (isLoading) return <Spinner label="Chargement du deal..." />
  if (!deal) return null

  const winner = bids?.find(b => b.status === 'winner')
  const canVerdict = deal.status === 'analyse'
  const canConfirmDeposit = deal.status === 'bid' && winner
  const canConfirmBalance = deal.status === 'pa_signed' && winner

  const submitVerdict = () => {
    if (verdictModal === 'go') {
      if (!verdictForm.bid_close_at) {
        toast.error('Date de fermeture requise')
        return
      }
      verdict.mutate({
        verdict: 'go',
        fee_pct: parseFloat(verdictForm.fee_pct),
        fee_minimum: parseInt(verdictForm.fee_minimum),
        bid_close_at: new Date(verdictForm.bid_close_at).toISOString(),
      })
    } else {
      if (!verdictForm.nogo_reason.trim()) {
        toast.error('Motif requis')
        return
      }
      verdict.mutate({ verdict: 'nogo', nogo_reason: verdictForm.nogo_reason })
    }
  }

  return (
    <div>
      <Link to="/admin/deals" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {deal.city} · {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
            </h1>
            <Badge status={deal.status} />
          </div>
          <p className="text-sm text-gray-600">ID : {deal.id}</p>
        </div>

        {canVerdict && (
          <div className="flex gap-2">
            <button onClick={() => setVerdictModal('nogo')} className="btn-secondary">
              NO GO
            </button>
            <button
              onClick={() => {
                // Préremplit bid_close_at avec now + 10 jours (durée Logeo standard)
                const close = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
                // Format datetime-local : "YYYY-MM-DDTHH:mm" en heure locale
                const pad = (n) => String(n).padStart(2, '0')
                const localIso =
                  `${close.getFullYear()}-${pad(close.getMonth() + 1)}-${pad(close.getDate())}` +
                  `T${pad(close.getHours())}:${pad(close.getMinutes())}`
                setVerdictForm({ ...verdictForm, bid_close_at: localIso })
                setVerdictModal('go')
              }}
              className="btn-primary"
            >
              GO · Publier
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="h-4 w-4" /> Informations propriété
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Adresse privée</dt>
                <dd className="font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-red-500" /> {deal.address_private}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Prix demandé</dt>
                <dd className="font-medium">{formatMoney(deal.asking_price)}</dd>
              </div>
              {deal.gross_revenue && (
                <div>
                  <dt className="text-gray-500 text-xs">Revenus bruts</dt>
                  <dd className="font-medium">{formatMoney(deal.gross_revenue)}</dd>
                </div>
              )}
              {deal.yield_pct != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Rendement</dt>
                  <dd className="font-medium text-emerald-600">{deal.yield_pct.toFixed(2)}%</dd>
                </div>
              )}
              {deal.num_units && (
                <div>
                  <dt className="text-gray-500 text-xs">Logements</dt>
                  <dd className="font-medium">{deal.num_units}</dd>
                </div>
              )}
            </dl>

            {deal.teaser_text && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-gray-500 text-xs mb-1">Teaser public</dt>
                <p className="text-sm text-gray-700">{deal.teaser_text}</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-4 w-4" /> Courtier
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Nom</dt>
                <dd className="font-medium">{deal.courtier_name}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Email</dt>
                <dd className="font-medium">{deal.courtier_email}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Téléphone</dt>
                <dd className="font-medium">{deal.courtier_phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Agence</dt>
                <dd className="font-medium">{deal.agency_name || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Enchères ({bids?.length || 0})
            </h2>
            {!bids?.length ? (
              <p className="text-sm text-gray-500 py-4">Aucune offre soumise.</p>
            ) : (
              <div className="space-y-2">
                {bids.map((b, i) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      b.status === 'winner' ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {b.status === 'winner' && <Trophy className="h-4 w-4 text-amber-600" />}
                      <div>
                        <p className="font-medium text-sm">{b.acheteur_name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(b.created_at).toLocaleString('fr-CA')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{formatMoney(b.amount)}</span>
                      <Badge>{b.status}</Badge>
                      {b.payment_status !== 'pending' && (
                        <span className="text-xs text-gray-500">{b.payment_status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {deal.status === 'bid' && deal.bid_close_at && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Temps restant</h2>
              <Timer closeAt={deal.bid_close_at} size="lg" showLabel />
              <p className="text-xs text-gray-500 mt-2">
                Ferme le {new Date(deal.bid_close_at).toLocaleString('fr-CA')}
              </p>
            </div>
          )}

          {deal.fee_pct && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Frais Logeo</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Pourcentage</dt>
                  <dd className="font-medium">{deal.fee_pct}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Plancher</dt>
                  <dd className="font-medium">{formatMoney(deal.fee_minimum || 0)}</dd>
                </div>
                {winner && (
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <dt className="text-gray-700 font-medium">Frais sur gagnant</dt>
                    <dd className="font-bold text-[#C2410C]">
                      {formatMoney(Math.max(Math.round(winner.amount * deal.fee_pct / 100), deal.fee_minimum || 0))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {canConfirmDeposit && (
            <button onClick={() => setInteracModal('deposit')} className="btn-primary w-full">
              Confirmer dépôt 25% Interac
            </button>
          )}

          {canConfirmBalance && (
            <button onClick={() => setInteracModal('balance')} className="btn-primary w-full">
              Confirmer solde 75% Interac
            </button>
          )}

          {deal.status === 'nogo' && deal.nogo_reason && (
            <div className="card p-4 bg-red-50 border-red-200">
              <p className="text-xs font-semibold text-red-900 mb-1">Motif du refus</p>
              <p className="text-sm text-red-800">{deal.nogo_reason}</p>
            </div>
          )}

          {deal.documents && Object.keys(deal.documents).length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents
              </h2>
              <ul className="text-sm space-y-1.5">
                {Object.entries(deal.documents).map(([key, path]) => (
                  <li key={key}>
                    <a href={fileUrl(path)} target="_blank" rel="noreferrer"
                       className="link-brand hover:underline">
                      {key.replace(/_/g, ' ')}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Verdict Modal */}
      <Modal open={verdictModal === 'go'} onClose={() => setVerdictModal(null)} title="Publier le deal (GO)" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Cette action publie le teaser, lance l'enchère et envoie un email à tous les acheteurs qualifiés.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Pourcentage de frais"
              type="number" step="0.1" min="0"
              value={verdictForm.fee_pct}
              onChange={(e) => setVerdictForm({ ...verdictForm, fee_pct: e.target.value })}
              hint="ex: 1.5 = 1.5% du prix gagnant"
            />
            <Input
              label="Plancher minimum (CAD)"
              type="number" min="0"
              value={verdictForm.fee_minimum}
              onChange={(e) => setVerdictForm({ ...verdictForm, fee_minimum: e.target.value })}
            />
          </div>
          <Input
            label="Fermeture de l'enchère"
            type="datetime-local"
            value={verdictForm.bid_close_at}
            onChange={(e) => setVerdictForm({ ...verdictForm, bid_close_at: e.target.value })}
            hint="Durée standard Logeo : 10 jours. Modifie la date si besoin."
          />
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setVerdictModal(null)} className="btn-secondary">Annuler</button>
            <button onClick={submitVerdict} disabled={verdict.isPending} className="btn-primary">
              {verdict.isPending ? '...' : 'Confirmer GO'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={verdictModal === 'nogo'} onClose={() => setVerdictModal(null)} title="Refuser le deal (NO GO)" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Le courtier recevra un email avec le motif. Cette action est définitive.
          </p>
          <Textarea
            label="Motif du refus"
            rows={5}
            value={verdictForm.nogo_reason}
            onChange={(e) => setVerdictForm({ ...verdictForm, nogo_reason: e.target.value })}
            placeholder="Expliquez pourquoi ce deal n'est pas retenu..."
          />
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setVerdictModal(null)} className="btn-secondary">Annuler</button>
            <button onClick={submitVerdict} disabled={verdict.isPending} className="btn-danger">
              {verdict.isPending ? '...' : 'Confirmer NO GO'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!interacModal} onClose={() => setInteracModal(null)}
             title={interacModal === 'deposit' ? 'Confirmer dépôt Interac (25%)' : 'Confirmer solde Interac (75%)'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {interacModal === 'deposit'
              ? 'Le gagnant sera annoncé publiquement et l\'introduction officielle envoyée.'
              : 'Le deal sera archivé et tous les paiements considérés comme finalisés.'}
          </p>
          <Input
            label="Référence Interac"
            value={interacRef}
            onChange={(e) => setInteracRef(e.target.value)}
            placeholder="ex: NOTIF-12345 ou montant + heure"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setInteracModal(null)} className="btn-secondary">Annuler</button>
            <button
              onClick={() => {
                if (!interacRef.trim()) { toast.error('Référence requise'); return }
                if (interacModal === 'deposit') confirmDeposit.mutate(winner.id)
                else confirmBalance.mutate(winner.id)
              }}
              disabled={confirmDeposit.isPending || confirmBalance.isPending}
              className="btn-primary"
            >
              Confirmer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
