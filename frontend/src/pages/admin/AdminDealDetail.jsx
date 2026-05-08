import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Trophy, DollarSign,
  Archive, ArchiveRestore, Trash2, AlertTriangle as AlertTriangleIcon,
} from 'lucide-react'
import {
  adminGetDealApi, adminListBidsApi, verdictApi,
  confirmDepositApi, confirmBalanceApi,
  archiveDealApi, unarchiveDealApi, deleteDealApi,
} from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input, { Textarea } from '../../components/ui/Input'
import DealHero from '../../components/deal/DealHero'
import DealFiche from '../../components/deal/DealFiche'
import LockedFeatureGrid from '../../components/deal/LockedFeatureGrid'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function AdminDealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [verdictModal, setVerdictModal] = useState(null) // 'go' | 'nogo' | null
  const [verdictForm, setVerdictForm] = useState({
    fee_pct: 1.5, fee_minimum: 5000, bid_close_at: '', nogo_reason: '',
  })
  const [interacModal, setInteracModal] = useState(null) // 'deposit' | 'balance' | null
  const [interacRef, setInteracRef] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

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

  const archiveMut = useMutation({
    mutationFn: () => archiveDealApi(dealId),
    onSuccess: () => {
      toast.success('Deal archivé')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const unarchiveMut = useMutation({
    mutationFn: () => unarchiveDealApi(dealId),
    onSuccess: () => {
      toast.success('Deal restauré')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteDealApi(dealId),
    onSuccess: () => {
      toast.success('Deal supprimé définitivement')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setDeleteModal(false)
      navigate('/admin/deals')
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

  // Bandeau d'actions admin — placé au-dessus du Hero, regroupé pour clarté.
  const adminActions = (
    <div className="card p-4 mb-6 bg-[#1A1A1A] text-white">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold uppercase tracking-wide">Actions admin</p>
        <div className="flex gap-2 flex-wrap">
          {canVerdict && (
            <>
              <button onClick={() => setVerdictModal('nogo')} className="btn-secondary text-sm">
                NO GO
              </button>
              <button
                onClick={() => {
                  const close = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
                  const pad = (n) => String(n).padStart(2, '0')
                  const localIso =
                    `${close.getFullYear()}-${pad(close.getMonth() + 1)}-${pad(close.getDate())}` +
                    `T${pad(close.getHours())}:${pad(close.getMinutes())}`
                  setVerdictForm({ ...verdictForm, bid_close_at: localIso })
                  setVerdictModal('go')
                }}
                className="btn-primary text-sm"
              >
                GO · Publier
              </button>
            </>
          )}
          {canConfirmDeposit && (
            <button onClick={() => setInteracModal('deposit')} className="btn-primary text-sm">
              Confirmer dépôt 25 %
            </button>
          )}
          {canConfirmBalance && (
            <button onClick={() => setInteracModal('balance')} className="btn-primary text-sm">
              Confirmer solde 75 %
            </button>
          )}
          {deal.archived_at ? (
            <button
              onClick={() => unarchiveMut.mutate()}
              disabled={unarchiveMut.isPending}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              <ArchiveRestore className="h-4 w-4" /> Désarchiver
            </button>
          ) : (
            <button
              onClick={() => archiveMut.mutate()}
              disabled={archiveMut.isPending}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              <Archive className="h-4 w-4" /> Archiver
            </button>
          )}
          <button
            onClick={() => { setDeleteConfirmText(''); setDeleteModal(true) }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
        </div>
      </div>
      <p className="text-xs text-white/60 mt-2">
        ID {deal.id}
        {deal.archived_at && ` · Archivé le ${new Date(deal.archived_at).toLocaleString('fr-CA')}`}
      </p>
    </div>
  )

  return (
    <div>
      <Link to="/admin/deals" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour aux deals
      </Link>

      {/* Bandeau d'actions admin — bandeau noir au-dessus du Hero */}
      {adminActions}

      {/* Hero unifié — countdown + prix + lien rapide vers les bids */}
      <DealHero
        deal={deal}
        cta={
          <a
            href="#bids"
            className="btn-primary w-full text-base py-3 inline-flex items-center justify-center gap-2"
          >
            <Trophy className="h-5 w-5" /> Voir les enchères ({bids?.length || 0})
          </a>
        }
      />

      {/* Détails propriété (tout débloqué pour admin) */}
      <div className="mb-6">
        <LockedFeatureGrid
          permissions={{
            canSeePhotos: true,
            canSeeAddress: true,
            canSeeDocuments: true,
            canSeeCourtier: true,
          }}
          lockedHint="—"
        />
      </div>

      {/* Fiche partagée — admin voit tout */}
      <DealFiche
        deal={deal}
        permissions={{
          canSeeAddress: true,
          canSeeFinancials: true,
          canSeePhotos: true,
          canSeeCourtier: true,
          canSeeDocuments: true,
          canSeeAdminMeta: true,
        }}
      />

      {/* Bloc spécifique admin — liste des enchères + nogo reason si applicable */}
      <div id="bids" className="card p-6 mb-6 mt-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Enchères ({bids?.length || 0})
        </h2>
        {!bids?.length ? (
          <p className="text-sm text-gray-500 py-4">Aucune offre soumise.</p>
        ) : (
          <div className="space-y-2">
            {bids.map((b) => (
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

      {deal.status === 'nogo' && deal.nogo_reason && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-xs font-semibold text-red-900 mb-1">Motif du refus</p>
          <p className="text-sm text-red-800">{deal.nogo_reason}</p>
        </div>
      )}

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

      {/* Modale de suppression : exige de taper SUPPRIMER */}
      <Modal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Supprimer définitivement ce deal"
        size="md"
      >
        <div className="space-y-4">
          <div className="card p-4 bg-red-50 border-red-200 flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">
              Cette action est <strong>irréversible</strong>. Toutes les données du deal
              (bids, NDAs, photos, documents, logements, Q&amp;R) seront définitivement
              effacées. Préférez l'archivage si vous voulez juste retirer le deal de la
              marketplace.
            </p>
          </div>
          <Input
            label="Tape SUPPRIMER pour confirmer"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteModal(false)}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteConfirmText !== 'SUPPRIMER' || deleteMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              {deleteMut.isPending ? '...' : 'Supprimer définitivement'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
