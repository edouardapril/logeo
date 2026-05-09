import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Trophy, DollarSign, Hammer,
  Archive, ArchiveRestore, Trash2, AlertTriangle as AlertTriangleIcon,
} from 'lucide-react'
import {
  adminGetDealApi, adminListBidsApi, verdictApi,
  archiveDealApi, unarchiveDealApi, deleteDealApi,
} from '../../api/admin'
import { adminMarkPaSignedApi, adminMarkPaidApi } from '../../api/payments'
import { placeBidApi } from '../../api/acheteur'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input, { Textarea } from '../../components/ui/Input'
import DealHero from '../../components/deal/DealHero'
import DealFiche from '../../components/deal/DealFiche'
import LockedFeatureGrid from '../../components/deal/LockedFeatureGrid'
import BidDisclaimerModal from '../../components/deal/BidDisclaimerModal'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function AdminDealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [verdictModal, setVerdictModal] = useState(null) // 'go' | 'nogo' | null
  const [verdictForm, setVerdictForm] = useState({
    fee_pct: 1.5, fee_minimum: 5000, bid_close_at: '', nogo_reason: '',
  })
  // LOTPLOT 19F : workflow Interac manuel — admin clique 'PA signée' puis 'Paiement reçu'
  const [paidModal, setPaidModal] = useState(false)
  const [interacRef, setInteracRef] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  // Bid admin (en son nom propre, sans NDA)
  const [bidModal, setBidModal] = useState(false)
  const [bidAmount, setBidAmount] = useState('')
  const [bidDisclaimer, setBidDisclaimer] = useState(false)

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

  // LOTPLOT 19F — workflow Interac manuel : PA signée puis Paiement reçu.
  const markPaSigned = useMutation({
    mutationFn: () => adminMarkPaSignedApi(dealId),
    onSuccess: (data) => {
      toast.success(
        `PA marquée comme signée · instructions Interac envoyées au gagnant (${data?.fee?.toLocaleString('fr-CA')} $)`,
      )
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const markPaid = useMutation({
    mutationFn: () => adminMarkPaidApi(dealId, interacRef.trim() || null),
    onSuccess: () => {
      toast.success('Paiement confirmé · Deal finalisé')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setPaidModal(false); setInteracRef('')
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

  const placeBid = useMutation({
    mutationFn: (consents) => placeBidApi(dealId, {
      amount: parseInt(bidAmount), ...consents,
    }),
    onSuccess: (data) => {
      const st = data?.auction_state
      if (st?.i_am_leading) {
        toast.success(`Vous êtes le meneur — prix actuel : ${formatMoney(st.current_price)}`)
      } else if (st) {
        toast(`Quelqu'un a une offre plus élevée que la vôtre`, { icon: '⚠️' })
      } else {
        toast.success('Offre soumise')
      }
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setBidAmount('')
      setBidDisclaimer(false)
      setBidModal(false)
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
  // LOTPLOT 19F : nouveaux gates workflow Interac manuel
  const canMarkPaSigned = ['due_diligence', 'awaiting_pa'].includes(deal.status) && winner
  const canMarkPaid = ['awaiting_payment', 'pa_signed'].includes(deal.status) && winner
  const isAuctionOpen = deal.status === 'bid' && deal.bid_close_at && new Date(deal.bid_close_at) > new Date()
  const auctionState = deal.auction_state || {}
  // LOTPLOT 17C : l'admin ne peut pas bidder sur ses propres deals (conflit
  // d'intérêt). Backend rejette aussi avec 403 — la cohérence entre les deux
  // évite que le bouton soit cliquable juste pour échouer.
  const isOwnDeal = !!user?.id && deal.courtier_id === user.id
  const canPlaceBid = isAuctionOpen && !isOwnDeal

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
          {canPlaceBid && (
            <button
              onClick={() => setBidModal(true)}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <Hammer className="h-4 w-4" /> Faire une offre
            </button>
          )}
          {canMarkPaSigned && (
            <button
              onClick={() => markPaSigned.mutate()}
              disabled={markPaSigned.isPending}
              className="btn-primary text-sm"
            >
              Marquer PA signée
            </button>
          )}
          {canMarkPaid && (
            <button
              onClick={() => setPaidModal(true)}
              className="btn-primary text-sm"
            >
              Paiement Interac reçu
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
          <div className="flex flex-col gap-2 w-full">
            {canPlaceBid && (
              <button
                onClick={() => setBidModal(true)}
                className="btn-primary w-full text-base py-3 inline-flex items-center justify-center gap-2"
              >
                <Hammer className="h-5 w-5" /> Faire une offre
              </button>
            )}
            {isOwnDeal && isAuctionOpen && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                Conflit d'intérêt : vous ne pouvez pas bidder sur un deal que vous avez soumis.
              </p>
            )}
            <a
              href="#bids"
              className={`${canPlaceBid ? 'btn-secondary' : 'btn-primary'} w-full text-base py-3 inline-flex items-center justify-center gap-2`}
            >
              <Trophy className="h-5 w-5" /> Voir les enchères ({bids?.length || 0})
            </a>
          </div>
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

      {/* LOTPLOT 19F — confirmer la réception du virement Interac → status=paid */}
      <Modal open={paidModal} onClose={() => setPaidModal(false)} title="Confirmer le paiement Interac reçu">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Le deal sera marqué comme finalisé et un email de confirmation sera envoyé au gagnant.
          </p>
          <Input
            label="Référence Interac (optionnel)"
            value={interacRef}
            onChange={(e) => setInteracRef(e.target.value)}
            placeholder="ex: NOTIF-12345 ou montant + heure"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setPaidModal(false)} className="btn-secondary">Annuler</button>
            <button
              onClick={() => markPaid.mutate()}
              disabled={markPaid.isPending}
              className="btn-primary"
            >
              Confirmer paiement reçu
            </button>
          </div>
        </div>
      </Modal>

      {/* Modale d'offre admin (en son nom propre, sans NDA) — flow identique acheteur */}
      <Modal
        open={bidModal}
        onClose={() => { setBidModal(false); setBidAmount('') }}
        title="Faire une offre (admin)"
        size="md"
      >
        {(() => {
          const increment = auctionState.increment || 5000
          const currentPrice = auctionState.current_price
          const myMax = auctionState.my_max
          const floor = auctionState.floor || deal.floor_price || 0
          // Le min doit dépasser à la fois current_price et son propre max courant
          const baseMin = currentPrice != null ? currentPrice + increment : floor + increment
          const minNext = Math.max(baseMin, (myMax || 0) + increment)
          const numeric = parseInt(bidAmount) || 0
          const errors = []
          if (numeric > 0) {
            if (numeric % increment !== 0) errors.push(`Doit être un multiple de ${formatMoney(increment)}`)
            if (currentPrice != null && numeric <= currentPrice)
              errors.push(`Doit être supérieur au prix courant (${formatMoney(currentPrice)})`)
            if (myMax != null && numeric <= myMax)
              errors.push(`Vous avez déjà une offre plus élevée (${formatMoney(myMax)})`)
          }
          const canSubmit = numeric > 0 && errors.length === 0
          return (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 leading-relaxed">
                Entrez votre <strong>offre maximale</strong>. Cette valeur reste <strong>privée</strong>.
                Le prix affiché n'augmentera que si nécessaire pour vous maintenir leader,
                jusqu'à concurrence de votre maximum.
              </div>
              <p className="text-xs text-gray-600">
                Prix courant : <strong>{currentPrice != null ? formatMoney(currentPrice) : '—'}</strong>
                {' · '}offre minimum : <strong>{formatMoney(minNext)}</strong>
                {' · '}incrément {formatMoney(increment)}
              </p>
              {auctionState.i_am_leading && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                  Vous êtes actuellement le meneur (max {formatMoney(myMax)}).
                </div>
              )}
              <Input
                label="Votre offre maximale (CAD)"
                type="number"
                min={minNext}
                step={increment}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={String(minNext)}
                hint={`Multiple de ${formatMoney(increment)}.`}
              />
              {errors.length > 0 && (
                <ul className="text-xs text-red-700 space-y-0.5">
                  {errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setBidModal(false); setBidAmount('') }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={() => canSubmit && setBidDisclaimer(true)}
                  disabled={!canSubmit}
                  className="btn-primary"
                >
                  Continuer · décharge
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      <BidDisclaimerModal
        open={bidDisclaimer}
        onClose={() => setBidDisclaimer(false)}
        amount={bidAmount}
        onConfirm={(consents) => placeBid.mutate(consents)}
        isSubmitting={placeBid.isPending}
      />

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
