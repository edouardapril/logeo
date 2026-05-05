import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, ShieldCheck, MapPin, User, Phone, Mail, Building,
  TrendingUp, FileText, AlertCircle, Lock, CheckCircle2, Trophy,
} from 'lucide-react'
import {
  getDealTeaserApi, getDealFullApi, signNdaApi,
  signEngagementApi, placeBidApi, myBidsApi, bidRankingApi,
} from '../../api/acheteur'
import { getMeApi } from '../../api/auth'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Timer from '../../components/ui/Timer'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import BidRanking from '../../components/deal/BidRanking'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function DealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const [ndaModal, setNdaModal] = useState(false)
  const [engagementModal, setEngagementModal] = useState(false)
  const [bidAmount, setBidAmount] = useState('')

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMeApi })
  const { data: teaser, isLoading } = useQuery({
    queryKey: ['acheteur', 'deal', dealId],
    queryFn: () => getDealTeaserApi(dealId),
  })

  // Tente de charger le full → si 403, l'acheteur n'a pas encore signé le NDA
  const { data: full, error: fullError } = useQuery({
    queryKey: ['acheteur', 'deal-full', dealId],
    queryFn: () => getDealFullApi(dealId),
    retry: false,
    enabled: !!teaser,
  })
  const hasSignedNda = !fullError && !!full

  const { data: myBids } = useQuery({
    queryKey: ['acheteur', 'my-bids', dealId],
    queryFn: () => myBidsApi(dealId),
    enabled: hasSignedNda,
    refetchInterval: 15_000,
  })

  const { data: ranking } = useQuery({
    queryKey: ['acheteur', 'ranking', dealId],
    queryFn: () => bidRankingApi(dealId),
    enabled: hasSignedNda,
    refetchInterval: 10_000,
  })

  const signNda = useMutation({
    mutationFn: () => signNdaApi(dealId),
    onSuccess: () => {
      toast.success('NDA signé · Accès au dossier complet')
      queryClient.invalidateQueries({ queryKey: ['acheteur'] })
      setNdaModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const signEngagement = useMutation({
    mutationFn: () => signEngagementApi(dealId),
    onSuccess: () => {
      toast.success('Engagement signé · Vous pouvez maintenant enchérir')
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEngagementModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const placeBid = useMutation({
    mutationFn: () => placeBidApi(dealId, parseInt(bidAmount)),
    onSuccess: () => {
      toast.success('Offre soumise')
      queryClient.invalidateQueries({ queryKey: ['acheteur'] })
      setBidAmount('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  if (isLoading) return <Spinner />
  if (!teaser) return null

  const deal = full || teaser
  const hasEngagement = !!me?.engagement_signed_at
  const isAuctionOpen = deal.status === 'bid' && deal.bid_close_at && new Date(deal.bid_close_at) > new Date()
  const myWinningBid = myBids?.find(b => b.status === 'winner')

  return (
    <div>
      <Link to="/acheteur/deals" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour aux deals
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 capitalize">
              {deal.city} · {deal.property_type}
            </h1>
            <Badge status={deal.status} />
          </div>
          {hasSignedNda && deal.address_private && (
            <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-1">
              <MapPin className="h-4 w-4 text-red-500" />
              {deal.address_private}
            </p>
          )}
        </div>

        {isAuctionOpen && (
          <div className="card px-5 py-3">
            <p className="text-xs text-gray-500 mb-1">Fin de l'enchère</p>
            <Timer closeAt={deal.bid_close_at} size="lg" />
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
                <dt className="text-gray-500 text-xs">Prix demandé</dt>
                <dd className="text-lg font-bold text-gray-900">{formatMoney(deal.asking_price)}</dd>
              </div>
              {deal.gross_revenue && (
                <div>
                  <dt className="text-gray-500 text-xs">Revenus bruts annuels</dt>
                  <dd className="font-semibold">{formatMoney(deal.gross_revenue)}</dd>
                </div>
              )}
              {deal.yield_pct != null && (
                <div>
                  <dt className="text-gray-500 text-xs flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Rendement
                  </dt>
                  <dd className="font-semibold text-emerald-600">{deal.yield_pct.toFixed(2)}%</dd>
                </div>
              )}
              {deal.num_units && (
                <div>
                  <dt className="text-gray-500 text-xs">Nombre de logements</dt>
                  <dd className="font-semibold">{deal.num_units}</dd>
                </div>
              )}
            </dl>

            {deal.teaser_text && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">{deal.teaser_text}</p>
              </div>
            )}
          </div>

          {/* Section verrouillée si pas de NDA */}
          {!hasSignedNda && (
            <div className="card p-8 text-center bg-gradient-to-br from-logeo-50 to-white border-logeo-200">
              <div className="h-12 w-12 mx-auto rounded-full bg-logeo-100 flex items-center justify-center mb-3">
                <Lock className="h-6 w-6 text-logeo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Dossier verrouillé</h3>
              <p className="text-sm text-gray-600 mb-1 max-w-md mx-auto">
                Signez le NDA pour découvrir l'<strong>adresse exacte</strong>, les <strong>coordonnées du courtier</strong>,
                les <strong>documents</strong> et participer à l'enchère.
              </p>
              <button onClick={() => setNdaModal(true)} className="btn-primary mt-4">
                <ShieldCheck className="h-4 w-4" /> Signer le NDA
              </button>
            </div>
          )}

          {/* Courtier (après NDA) */}
          {hasSignedNda && full?.courtier_name && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-4 w-4" /> Courtier
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Nom</p>
                  <p className="font-medium">{full.courtier_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Agence</p>
                  <p className="font-medium">{full.agency_name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="font-medium">{full.courtier_email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Téléphone
                  </p>
                  <p className="font-medium">{full.courtier_phone || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {hasSignedNda && full?.documents && Object.keys(full.documents).length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents
              </h2>
              <ul className="space-y-2 text-sm">
                {Object.entries(full.documents).map(([key, path]) => (
                  <li key={key}>
                    <a
                      href={`/uploads/${path.split('uploads/')[1] || path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-logeo-600 hover:text-logeo-700"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar — Bid form */}
        <div className="space-y-4">
          {hasSignedNda && isAuctionOpen && (
            <div className="card p-6 sticky top-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Soumettre une offre
              </h2>

              {!hasEngagement ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Avant votre première offre, signez l'engagement de paiement des frais Logeo.
                  </p>
                  <button onClick={() => setEngagementModal(true)} className="btn-primary w-full">
                    Signer l'engagement
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Montant de votre offre (CAD)"
                    type="number"
                    min="0"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={String(deal.asking_price)}
                    hint="Montants illimités · Anonymes pour les autres acheteurs"
                  />
                  <button
                    onClick={() => bidAmount && placeBid.mutate()}
                    disabled={!bidAmount || placeBid.isPending}
                    className="btn-primary w-full"
                  >
                    {placeBid.isPending ? 'Envoi...' : `Soumettre ${bidAmount ? formatMoney(parseInt(bidAmount)) : 'l\'offre'}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Classement */}
          {hasSignedNda && (
            <div className="card p-6">
              <BidRanking ranking={ranking || []} />
            </div>
          )}

          {/* Mes bids */}
          {hasSignedNda && myBids?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Mes offres</h2>
              <ul className="space-y-2 text-sm">
                {myBids.map(b => (
                  <li key={b.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                    <div>
                      <span className="font-semibold">{formatMoney(b.amount)}</span>
                      {b.status === 'winner' && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                          <Trophy className="h-3 w-3" /> Gagnant
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleString('fr-CA')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status messages */}
          {myWinningBid && deal.status === 'bid' && (
            <div className="card p-5 bg-amber-50 border-amber-200">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 text-sm">Vous avez remporté l'enchère !</h4>
                  <p className="text-xs text-amber-800 mt-1">
                    Consultez votre email pour les instructions de paiement Interac (25% de dépôt).
                  </p>
                </div>
              </div>
            </div>
          )}

          {deal.status === 'intro' && myWinningBid && (
            <div className="card p-5 bg-emerald-50 border-emerald-200">
              <div className="flex gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-900 text-sm">Introduction officielle envoyée</h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Le courtier a été mis en contact avec vous. Consultez votre email pour le rapport watermarqué.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NDA Modal */}
      <Modal open={ndaModal} onClose={() => setNdaModal(false)} title="Accord de non-divulgation (NDA)" size="lg">
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            En signant ce NDA, je m'engage à respecter les conditions suivantes pour le deal en question :
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>
              <strong>Confidentialité totale</strong> : ne pas divulguer l'adresse, le nom du courtier,
              ni aucune information du dossier à un tiers.
            </li>
            <li>
              <strong>Non-contournement 24 mois</strong> : ne pas contacter le vendeur ou conclure
              une transaction directe sans Logeo. Pénalité de 3x les frais Logeo en cas d'infraction.
            </li>
            <li>
              <strong>Usage personnel uniquement</strong> : les informations sont destinées à votre
              évaluation comme investisseur, pas à la diffusion.
            </li>
          </ul>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p>
              <strong>Preuves légales :</strong> votre adresse IP et l'horodatage seront enregistrés
              au moment de la signature, conformément à la Loi 25 du Québec.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setNdaModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={() => signNda.mutate()} disabled={signNda.isPending} className="btn-primary">
              <ShieldCheck className="h-4 w-4" />
              {signNda.isPending ? 'Signature...' : 'Je signe le NDA'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Engagement Modal */}
      <Modal open={engagementModal} onClose={() => setEngagementModal(false)} title="Engagement de paiement des frais Logeo" size="lg">
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            En cas de victoire à l'enchère, je m'engage à payer les frais Logeo selon la structure suivante :
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>
              <strong>Pourcentage dégressif</strong> du prix gagnant
              {deal.fee_pct && ` — taux applicable : ${deal.fee_pct}%`}
            </li>
            <li>
              <strong>25% de dépôt</strong> par Interac à la fermeture de l'enchère
              (sous 48h, sinon le deal passe au 2e enchérisseur)
            </li>
            <li>
              <strong>75% de solde</strong> à la signature de la promesse d'achat
            </li>
            {deal.fee_minimum && (
              <li>
                <strong>Plancher minimum</strong> : {formatMoney(deal.fee_minimum)}
              </li>
            )}
          </ul>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            Cet engagement est juridiquement contraignant. Il est signé une seule fois par deal,
            avant votre première offre.
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setEngagementModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={() => signEngagement.mutate()} disabled={signEngagement.isPending} className="btn-primary">
              {signEngagement.isPending ? '...' : 'Je m\'engage'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
