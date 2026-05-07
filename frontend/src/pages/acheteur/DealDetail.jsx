import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, ShieldCheck, MapPin, User, Phone, Mail, Building,
  TrendingUp, FileText, AlertCircle, Lock, CheckCircle2, Trophy,
  CreditCard, Receipt, Home, Hammer, Video, MessageSquare,
  Calendar, AlertTriangle, ExternalLink, Send,
} from 'lucide-react'
import {
  getDealTeaserApi, getDealFullApi, signNdaApi,
  signEngagementApi, placeBidApi, myBidsApi, bidRankingApi,
  dealUnitsApi, dealQuestionsApi, askDealQuestionApi, requestVisitApi,
} from '../../api/acheteur'
import {
  getPaymentMethodApi, getFeeQuoteApi, getMyDealPaymentsApi,
  completeDueDiligenceApi,
} from '../../api/payments'
import { getMeApi } from '../../api/auth'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Timer from '../../components/ui/Timer'
import Input, { Textarea } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import BidRanking from '../../components/deal/BidRanking'
import BidDisclaimerModal from '../../components/deal/BidDisclaimerModal'
import ReviewSection from '../../components/deal/ReviewSection'
import ActivityFeed from '../../components/deal/ActivityFeed'
import AnimatedNumber from '../../components/ui/AnimatedNumber'
import CountdownBoxes from '../../components/ui/CountdownBoxes'
import { listReviewsForDealApi } from '../../api/reviews'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import useAuctionLive, { browserNotify } from '../../hooks/useAuctionLive'
import OnboardingProgress from '../../components/acheteur/OnboardingProgress'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

const TRI_LABEL = { yes: 'Oui', no: 'Non', unknown: 'Inconnu' }
const WORK_LABEL = {
  toiture: 'Toiture', fondation: 'Fondation', electrique: 'Électrique',
  plomberie: 'Plomberie', fenetres: 'Fenêtres', chauffage: 'Chauffage',
}

export default function DealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const [ndaModal, setNdaModal] = useState(false)
  const [ndaConsents, setNdaConsents] = useState({
    consent_confidentiality: false,
    consent_no_direct_contact: false,
    consent_logeo_exclusive_source: false,
    consent_no_third_party_share: false,
  })
  const [engagementModal, setEngagementModal] = useState(false)
  const [disclaimerModal, setDisclaimerModal] = useState(false)
  const [visitModal, setVisitModal] = useState(false)
  const [bidAmount, setBidAmount] = useState('')
  const [questionDraft, setQuestionDraft] = useState('')
  const [visitForm, setVisitForm] = useState({ proposed_slot: '', note: '' })

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMeApi })
  const { data: teaser, isLoading } = useQuery({
    queryKey: ['acheteur', 'deal', dealId],
    queryFn: () => getDealTeaserApi(dealId),
  })

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
  const { data: units } = useQuery({
    queryKey: ['acheteur', 'units', dealId],
    queryFn: () => dealUnitsApi(dealId),
    enabled: hasSignedNda,
  })
  const { data: questions } = useQuery({
    queryKey: ['acheteur', 'questions', dealId],
    queryFn: () => dealQuestionsApi(dealId),
    enabled: hasSignedNda,
    refetchInterval: 30_000,
  })
  const { data: pm } = useQuery({ queryKey: ['payment-method'], queryFn: getPaymentMethodApi })

  const { data: dealReviews } = useQuery({
    queryKey: ['reviews', dealId],
    queryFn: () => listReviewsForDealApi(dealId),
    enabled: hasSignedNda && !!teaser && teaser.status === 'pa_signed',
  })

  const myWinningBidEarly = myBids?.find(b => b.status === 'winner')
  const { data: feeQuote } = useQuery({
    queryKey: ['fee-quote', dealId],
    queryFn: () => getFeeQuoteApi(dealId),
    enabled: !!myWinningBidEarly,
  })
  const { data: dealPayments } = useQuery({
    queryKey: ['deal-payments', dealId],
    queryFn: () => getMyDealPaymentsApi(dealId),
    enabled: !!myWinningBidEarly,
    refetchInterval: 15_000,
  })

  // ── Live WS — connecte tant que la page est ouverte ─────────────────────────
  const live = useAuctionLive(dealId, { enabled: !!dealId })

  // À chaque event reçu, on invalide les queries dépendantes pour resync REST.
  // Ça garantit la cohérence si on perd un event (reconnect, etc.).
  useEffect(() => {
    if (!live.latest) return
    const t = live.latest.type
    if (t === 'new_bid' || t === 'timer_extended' || t === 'auction_closed') {
      queryClient.invalidateQueries({ queryKey: ['acheteur', 'ranking', dealId] })
      queryClient.invalidateQueries({ queryKey: ['acheteur', 'my-bids', dealId] })
      queryClient.invalidateQueries({ queryKey: ['acheteur', 'deal', dealId] })
      queryClient.invalidateQueries({ queryKey: ['acheteur', 'deal-full', dealId] })
    }
    if (t === 'outbid') {
      browserNotify(
        `⚡ Vous avez été dépassé sur ${live.latest.deal_city || 'un deal'} !`,
        'Surenchérissez avant la fin de l\'enchère.',
      )
    } else if (t === 'leading') {
      browserNotify('✅ Vous êtes de nouveau en avance !', 'Tenez votre position.')
    } else if (t === 'auction_closed_winner') {
      browserNotify('🏆 Félicitations !', 'Vous avez remporté l\'enchère.')
    }
  }, [live.latest, dealId, queryClient])

  const signNda = useMutation({
    mutationFn: () => signNdaApi(dealId, ndaConsents),
    onSuccess: () => {
      toast.success('NDA signé · PDF envoyé par email')
      queryClient.invalidateQueries({ queryKey: ['acheteur'] })
      setNdaModal(false)
      setNdaConsents({
        consent_confidentiality: false, consent_no_direct_contact: false,
        consent_logeo_exclusive_source: false, consent_no_third_party_share: false,
      })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const allNdaConsentsChecked = Object.values(ndaConsents).every(Boolean)
  const signEngagement = useMutation({
    mutationFn: () => signEngagementApi(dealId),
    onSuccess: () => {
      toast.success('Engagement signé')
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEngagementModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })
  const placeBid = useMutation({
    mutationFn: (consents) => placeBidApi(dealId, {
      amount: parseInt(bidAmount), ...consents,
    }),
    onSuccess: () => {
      toast.success('Offre soumise')
      queryClient.invalidateQueries({ queryKey: ['acheteur'] })
      setBidAmount('')
      setDisclaimerModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })
  const dueDiligenceMutation = useMutation({
    mutationFn: () => completeDueDiligenceApi(dealId),
    onSuccess: () => {
      toast.success('Due diligence confirmée · solde débité')
      queryClient.invalidateQueries({ queryKey: ['acheteur'] })
      queryClient.invalidateQueries({ queryKey: ['deal-payments', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })
  const askQuestion = useMutation({
    mutationFn: () => askDealQuestionApi(dealId, questionDraft.trim()),
    onSuccess: () => {
      toast.success('Question envoyée au courtier')
      setQuestionDraft('')
      queryClient.invalidateQueries({ queryKey: ['acheteur', 'questions', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })
  const visitRequest = useMutation({
    mutationFn: () => requestVisitApi(dealId, visitForm),
    onSuccess: () => {
      toast.success('Demande de visite envoyée')
      setVisitModal(false)
      setVisitForm({ proposed_slot: '', note: '' })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  if (isLoading) return <Spinner />
  if (!teaser) return null

  const deal = full || teaser
  const hasEngagement = !!me?.engagement_signed_at
  const hasCard = !!pm?.has_card
  const isAuctionOpen = deal.status === 'bid' && deal.bid_close_at && new Date(deal.bid_close_at) > new Date()
  const myWinningBid = myWinningBidEarly
  const depositPayment = dealPayments?.find(p => p.type === 'deposit' && p.state === 'succeeded')
  const balancePayment = dealPayments?.find(p => p.type === 'balance')
  const ddDone = !!deal.due_diligence_completed_at

  // Calculs financiers
  const capRate = deal.net_revenue && deal.floor_price
    ? ((deal.net_revenue / deal.floor_price) * 100).toFixed(2)
    : null
  const totalExpenses = deal.expenses
    ? Object.values(deal.expenses).reduce((s, v) => s + (Number(v) || 0), 0)
    : null

  return (
    <div className="pb-24 md:pb-0">  {/* padding-bottom mobile pour le sticky CTA */}
      <Link to="/acheteur/deals" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour aux deals
      </Link>

      {/* Onboarding (sprint UX item 2) — masque automatiquement si l'utilisateur est prêt */}
      <OnboardingProgress dealId={dealId} compact />

      {/* ── HERO BLOCK (sprint UX item 3) — toujours en haut, mobile-first ── */}
      <div className="card p-5 md:p-6 mb-6 bg-gradient-to-br from-white via-white to-[#FFEDD5]/40 border-[#FDBA74]">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 capitalize">
                {deal.city} · {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
              </h1>
              <Badge status={deal.status} />
            </div>
            {hasSignedNda && deal.address_private && (
              <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-1">
                <MapPin className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="truncate">{deal.address_private}</span>
              </p>
            )}
          </div>
          {/* Status acheteur (visible si NDA signé et bid placé) */}
          {hasSignedNda && live.iAmLeading === true && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 text-sm font-semibold animate-pulse">
              🟢 Vous êtes en avance
            </span>
          )}
          {hasSignedNda && live.iAmLeading === false && myBids?.length > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 text-sm font-semibold">
              🔴 Vous avez été dépassé
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Timer — gros, central */}
          <div className="md:col-span-2 flex justify-center md:justify-start">
            {isAuctionOpen ? (
              <CountdownBoxes
                closeAt={live.liveCloseAt || deal.bid_close_at}
                size="lg"
                showLabel
                extendedFlash={live.extendedFlash}
              />
            ) : (
              <p className="text-gray-500 text-sm">Enchère non ouverte</p>
            )}
          </div>

          {/* Prix + bidders + CTA */}
          <div className="space-y-3">
            {ranking?.displayed_price != null && (
              <div className="text-center md:text-right">
                <p className="text-xs uppercase tracking-wide text-gray-500">Prix actuel</p>
                <p className="text-3xl font-bold text-[#9A3412]">
                  <AnimatedNumber
                    value={live.livePrice ?? ranking.displayed_price}
                    format={formatMoney}
                  />
                </p>
                <p className="text-xs text-gray-500">
                  <AnimatedNumber value={live.liveBidders ?? ranking.bidders_count} />
                  {' '}acheteur{(live.liveBidders ?? ranking.bidders_count) > 1 ? 's' : ''} en lice
                </p>
              </div>
            )}
            {isAuctionOpen && (
              <a
                href="#bid-form"
                className="btn-primary w-full text-base py-3"
                onClick={(e) => {
                  // Smooth scroll vers le form (mobile pratique)
                  const target = document.getElementById('bid-form')
                  if (target) {
                    e.preventDefault()
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }}
              >
                <Trophy className="h-5 w-5" /> Enchérir maintenant
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Galerie photos */}
      {deal.photo_paths?.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {deal.photo_paths.map((p, i) => (
              <a key={p} href={fileUrl(p)} target="_blank" rel="noreferrer">
                <img src={fileUrl(p)} alt={`Photo ${i + 1}`}
                     className="h-32 w-full object-cover rounded-lg hover:opacity-90" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Section financière ── */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#C2410C]" /> Financier
            </h2>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {deal.floor_price != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Prix plancher</dt>
                  <dd className="text-lg font-bold text-[#C2410C]">{formatMoney(deal.floor_price)}</dd>
                </div>
              )}
              {deal.municipal_evaluation != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Évaluation municipale</dt>
                  <dd className="font-semibold">{formatMoney(deal.municipal_evaluation)}</dd>
                </div>
              )}
              {deal.gross_revenue != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Revenus bruts annuels</dt>
                  <dd className="font-semibold">{formatMoney(deal.gross_revenue)}</dd>
                </div>
              )}
              {deal.net_revenue != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Revenus nets annuels</dt>
                  <dd className="font-semibold">{formatMoney(deal.net_revenue)}</dd>
                </div>
              )}
              {capRate && (
                <div>
                  <dt className="text-gray-500 text-xs flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> TGA (cap rate)
                  </dt>
                  <dd className="font-semibold text-emerald-600">{capRate}%</dd>
                </div>
              )}
              {deal.yield_pct != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Rendement déclaré</dt>
                  <dd className="font-semibold text-emerald-600">{deal.yield_pct.toFixed(2)}%</dd>
                </div>
              )}
              {deal.num_units != null && (
                <div>
                  <dt className="text-gray-500 text-xs">Logements</dt>
                  <dd className="font-semibold">{deal.num_units}</dd>
                </div>
              )}
            </dl>

            {hasSignedNda && deal.expenses && Object.keys(deal.expenses).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Dépenses annuelles</p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {Object.entries(deal.expenses).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-gray-500 text-xs capitalize">{k.replace(/_/g, ' ')}</dt>
                      <dd className="font-medium">{formatMoney(Number(v))}</dd>
                    </div>
                  ))}
                  {totalExpenses != null && (
                    <div className="col-span-full pt-2 border-t border-gray-100 flex justify-between">
                      <dt className="text-gray-700 font-medium">Total dépenses</dt>
                      <dd className="font-bold">{formatMoney(totalExpenses)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {hasSignedNda && deal.revenue_history?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Historique des revenus</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-1">Année</th>
                      <th className="py-1">Brut</th>
                      <th className="py-1">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deal.revenue_history.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1.5">{r.year}</td>
                        <td className="py-1.5 font-medium">{formatMoney(r.gross || r.revenue)}</td>
                        <td className="py-1.5 font-medium">{formatMoney(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {deal.teaser_text && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">{deal.teaser_text}</p>
              </div>
            )}
          </div>

          {/* ── Pré-NDA : sections bloquées avec flou + social proof ── */}
          {!hasSignedNda && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Building, title: 'Photos haute résolution',
                    hint: 'Intérieur, extérieur, parties communes, par logement.' },
                  { icon: MapPin, title: 'Adresse exacte',
                    hint: 'Numéro civique, rue et secteur précis.' },
                  { icon: FileText, title: 'Baux et déclaration vendeur',
                    hint: 'Loyers détaillés par logement, statut occupation.' },
                  { icon: User, title: 'Coordonnées du courtier',
                    hint: 'Contact direct pour la due diligence.' },
                ].map((b, i) => {
                  const I = b.icon
                  return (
                    <div key={i} className="card p-4 relative overflow-hidden">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 opacity-60"
                        style={{ filter: 'blur(8px)' }}
                      />
                      <div className="relative flex items-start gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-white/80 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
                          <Lock className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                            <I className="h-3.5 w-3.5 text-gray-400" />
                            {b.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">{b.hint}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* CTA principal NDA + social proof */}
              <div className="card p-8 text-center bg-gradient-to-br from-[#FFEDD5] to-white border-[#FDBA74]">
                <div className="h-12 w-12 mx-auto rounded-full bg-[#FED7AA] flex items-center justify-center mb-3">
                  <Lock className="h-6 w-6 text-[#EA580C]" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Dossier verrouillé</h3>
                {ranking?.bidders_count != null && (
                  <p className="font-semibold text-[#9A3412] mb-1">
                    {ranking.bidders_count} {ranking.bidders_count > 1 ? 'investisseurs ont' : 'investisseur a'} déjà placé une offre.
                  </p>
                )}
                <p className="text-sm text-gray-600 mb-1 max-w-md mx-auto">
                  Signez le NDA pour découvrir l'<strong>adresse exacte</strong>, les <strong>logements</strong>,
                  les <strong>documents</strong>, et participer à l'enchère.
                </p>
                <button onClick={() => setNdaModal(true)} className="btn-primary mt-4">
                  <ShieldCheck className="h-4 w-4" /> Signer le NDA
                </button>
                <p className="text-[11px] text-gray-500 mt-2 italic">
                  IP + horodatage enregistrés · PDF reçu par email
                </p>
              </div>
            </>
          )}

          {/* ── Logements ── */}
          {hasSignedNda && units?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Home className="h-4 w-4 text-[#C2410C]" /> Logements ({units.length})
              </h2>
              <div className="space-y-3">
                {units.map(u => (
                  <div key={u.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <p className="font-semibold text-gray-900">
                        {u.label} {u.unit_type && <span className="text-gray-500 font-normal">· {u.unit_type}</span>}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
                        u.occupancy_status === 'rented'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                      }`}>
                        {u.occupancy_status === 'rented' ? 'Loué' : u.occupancy_status === 'vacant' ? 'Libre' : '—'}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {u.area_sqft != null && (
                        <div><dt className="text-gray-500">Superficie</dt><dd className="font-medium">{u.area_sqft} pi²</dd></div>
                      )}
                      {u.current_rent != null && (
                        <div><dt className="text-gray-500">Loyer actuel</dt><dd className="font-medium">{formatMoney(u.current_rent)}/mois</dd></div>
                      )}
                      {u.market_rent != null && (
                        <div><dt className="text-gray-500">Loyer marché</dt><dd className="font-medium">{formatMoney(u.market_rent)}/mois</dd></div>
                      )}
                      {u.lease_end && (
                        <div><dt className="text-gray-500">Fin du bail</dt><dd className="font-medium">{new Date(u.lease_end).toLocaleDateString('fr-CA')}</dd></div>
                      )}
                    </dl>
                    {u.photo_paths?.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {u.photo_paths.map((p, i) => (
                          <a key={p} href={fileUrl(p)} target="_blank" rel="noreferrer">
                            <img src={fileUrl(p)} alt={`${u.label} ${i + 1}`}
                                 className="h-20 w-full object-cover rounded" />
                          </a>
                        ))}
                      </div>
                    )}
                    {u.lease_path && (
                      <a href={fileUrl(u.lease_path)} target="_blank" rel="noreferrer"
                         className="mt-2 inline-flex items-center gap-1 text-xs link-brand">
                        <FileText className="h-3 w-3" /> Bail
                      </a>
                    )}
                    {u.notes && <p className="text-xs text-gray-600 mt-2">{u.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Travaux + Matières ── */}
          {hasSignedNda && (deal.work_history?.length > 0 || deal.material_disclosures || deal.zoning || deal.easements) && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Hammer className="h-4 w-4 text-[#C2410C]" /> Travaux & divulgations
              </h2>

              {deal.work_history?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Travaux majeurs</p>
                  <ul className="text-sm space-y-1.5">
                    {deal.work_history.map((w, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-medium text-gray-900 min-w-[100px]">{WORK_LABEL[w.category] || w.category}</span>
                        <span className="text-gray-700">
                          {w.year && <strong>{w.year}</strong>}
                          {w.note && (w.year ? ` · ${w.note}` : w.note)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {deal.material_disclosures && Object.keys(deal.material_disclosures).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Matières / zonage</p>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    {deal.material_disclosures.asbestos && (
                      <div><dt className="text-gray-500 text-xs">Amiante</dt>
                           <dd className="font-medium">{TRI_LABEL[deal.material_disclosures.asbestos]}</dd></div>
                    )}
                    {deal.material_disclosures.pyrite && (
                      <div><dt className="text-gray-500 text-xs">Pyrite</dt>
                           <dd className="font-medium">{TRI_LABEL[deal.material_disclosures.pyrite]}</dd></div>
                    )}
                    {deal.material_disclosures.zoning_confirmed && (
                      <div><dt className="text-gray-500 text-xs">Zonage confirmé</dt>
                           <dd className="font-medium">{TRI_LABEL[deal.material_disclosures.zoning_confirmed]}</dd></div>
                    )}
                  </dl>
                </div>
              )}

              {(deal.zoning || deal.easements) && (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {deal.zoning && (
                    <div><dt className="text-gray-500 text-xs">Code de zonage</dt><dd className="font-medium">{deal.zoning}</dd></div>
                  )}
                  {deal.easements && (
                    <div><dt className="text-gray-500 text-xs">Servitudes</dt><dd className="font-medium">{deal.easements}</dd></div>
                  )}
                </dl>
              )}
            </div>
          )}

          {/* ── Visite ── */}
          {hasSignedNda && (deal.virtual_tour_url || deal.visit_notes) && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Video className="h-4 w-4 text-[#C2410C]" /> Visite
              </h2>
              {deal.virtual_tour_url && (
                <a href={deal.virtual_tour_url} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1.5 link-brand font-medium text-sm mb-3">
                  <ExternalLink className="h-4 w-4" /> Visite virtuelle 360°
                </a>
              )}
              {deal.visit_notes && (
                <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">{deal.visit_notes}</p>
              )}
              <button onClick={() => setVisitModal(true)} className="btn-secondary text-sm">
                <Calendar className="h-4 w-4" /> Demander une visite physique
              </button>
            </div>
          )}

          {/* ── Courtier ── */}
          {hasSignedNda && full?.courtier_name && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-4 w-4" /> Courtier
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500 text-xs">Nom</p><p className="font-medium">{full.courtier_name}</p></div>
                <div><p className="text-gray-500 text-xs">Agence</p><p className="font-medium">{full.agency_name || '—'}</p></div>
                <div>
                  <p className="text-gray-500 text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                  <p className="font-medium">{full.courtier_email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Téléphone</p>
                  <p className="font-medium">{full.courtier_phone || '—'}</p>
                </div>
                {full.courtier_oaciq_number && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">N° licence OACIQ</p>
                    <p className="font-medium font-mono">{full.courtier_oaciq_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Documents ── */}
          {hasSignedNda && (full?.documents || full?.inspection_report_path) && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents
              </h2>
              <ul className="space-y-2 text-sm">
                {full.documents && Object.entries(full.documents).map(([key, path]) => (
                  <li key={key}>
                    <a href={fileUrl(path)} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 link-brand">
                      <FileText className="h-4 w-4" />
                      <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    </a>
                  </li>
                ))}
                {full.inspection_report_path && (
                  <li>
                    <a href={fileUrl(full.inspection_report_path)} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 link-brand">
                      <FileText className="h-4 w-4" /> Rapport d'inspection
                    </a>
                  </li>
                )}
                {full.cert_localisation_date && (
                  <li className="text-xs text-gray-500 px-2">
                    Certificat de localisation daté du {new Date(full.cert_localisation_date).toLocaleDateString('fr-CA')}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* ── FAQ publique ── */}
          {hasSignedNda && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#C2410C]" />
                Questions & réponses ({questions?.length || 0})
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Toutes les Q&R sont visibles par les acheteurs ayant signé le NDA — transparence totale.
              </p>

              <div className="space-y-3 mb-4">
                {questions?.map(q => (
                  <div key={q.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">
                        {new Date(q.asked_at).toLocaleString('fr-CA')}
                        {q.is_mine && <span className="ml-2 text-[#C2410C] font-medium">· Vous</span>}
                      </p>
                      {!q.answer && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-amber-200">
                          Sans réponse
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium mb-2">{q.question}</p>
                    {q.answer && (
                      <div className="mt-2 pl-3 border-l-2 border-[#FDBA74] text-sm text-gray-700">
                        <p className="whitespace-pre-line">{q.answer}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Réponse du courtier · {new Date(q.answered_at).toLocaleString('fr-CA')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                {questions?.length === 0 && (
                  <p className="text-sm text-gray-500 italic">Aucune question pour le moment. Soyez le premier !</p>
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  label="Poser une question au courtier"
                  value={questionDraft}
                  onChange={(e) => setQuestionDraft(e.target.value)}
                  rows={2}
                  placeholder="Quelle est l'année de la dernière réfection de toiture ?"
                />
                <button
                  onClick={() => questionDraft.trim().length >= 3 && askQuestion.mutate()}
                  disabled={!questionDraft.trim() || askQuestion.isPending}
                  className="btn-primary text-sm"
                >
                  <Send className="h-4 w-4" />
                  {askQuestion.isPending ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}

          {/* ── Évaluations (deal complété) ── */}
          {hasSignedNda && deal.status === 'pa_signed' && (
            <ReviewSection
              dealId={dealId}
              canRate={!!myWinningBid}
              rateeRoleLabel="le courtier"
              alreadyRated={!!dealReviews?.some(r => r.rater_id === me?.id)}
            />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {hasSignedNda && isAuctionOpen && (
            <div id="bid-form" className="card p-6 md:sticky md:top-6 scroll-mt-24">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Soumettre une offre
              </h2>

              {!hasCard ? (
                <div>
                  <div className="flex items-start gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-[#C2410C] mt-0.5" />
                    <p className="text-sm text-gray-700">
                      Enregistrez votre carte pour enchérir.
                    </p>
                  </div>
                  <Link to="/acheteur/paiement" className="btn-primary w-full">
                    Enregistrer ma carte
                  </Link>
                </div>
              ) : !hasEngagement ? (
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
                  {ranking?.min_next_bid && (
                    <p className="text-xs text-gray-600 px-1">
                      Offre minimum : <strong>{formatMoney(ranking.min_next_bid)}</strong>
                      {ranking.bidders_count > 0 && (
                        <span className="text-gray-400"> · incrément {formatMoney(ranking.increment)}</span>
                      )}
                    </p>
                  )}
                  <Input
                    label="Montant de votre offre (CAD)"
                    type="number" min={ranking?.min_next_bid || deal.floor_price || 0}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={String(ranking?.min_next_bid || deal.floor_price || '')}
                    hint="Votre maximum proxy. Le prix affiché monte automatiquement selon les enchères concurrentes."
                  />
                  <button
                    onClick={() => bidAmount && parseInt(bidAmount) > 0 && setDisclaimerModal(true)}
                    disabled={!bidAmount || parseInt(bidAmount) <= 0}
                    className="btn-primary w-full"
                  >
                    Continuer · décharge
                  </button>
                </div>
              )}
            </div>
          )}

          {hasSignedNda && (
            <div className="card p-6">
              <BidRanking
                ranking={ranking ? {
                  ...ranking,
                  // Surcharge avec les valeurs live si elles existent (plus fraîches que le poll REST)
                  displayed_price: live.livePrice ?? ranking.displayed_price,
                  bidders_count: live.liveBidders ?? ranking.bidders_count,
                  i_am_leading: live.iAmLeading != null ? live.iAmLeading : ranking.i_am_leading,
                } : null}
                extendedFlash={live.extendedFlash}
                livePulse={live.latest?.type === 'new_bid'}
              />
            </div>
          )}

          {/* Fil d'activité temps réel */}
          {hasSignedNda && (
            <ActivityFeed events={live.events} />
          )}

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

          {/* Bandeau gagnant + paiements */}
          {myWinningBid && (
            <div className="card p-5 bg-[#FFEDD5] border-[#FDBA74]">
              <div className="flex gap-2 mb-3">
                <Trophy className="h-5 w-5 text-[#C2410C] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[#9A3412] text-sm">Vous avez remporté l'enchère !</h4>
                  <p className="text-xs text-[#9A3412]/80 mt-1">
                    Offre gagnante : <strong>{formatMoney(myWinningBid.amount)}</strong>
                  </p>
                </div>
              </div>
              {feeQuote && (
                <dl className="text-xs space-y-1 mb-1 pl-7">
                  <div className="flex justify-between"><dt>Frais Logeo (1 %)</dt><dd className="font-semibold">{formatMoney(feeQuote.total_fee)}</dd></div>
                  <div className="flex justify-between"><dt>Dépôt 25 %</dt><dd className="font-semibold">{formatMoney(feeQuote.deposit)}</dd></div>
                  <div className="flex justify-between"><dt>Solde</dt><dd className="font-semibold">{formatMoney(feeQuote.balance)}</dd></div>
                </dl>
              )}
            </div>
          )}

          {myWinningBid && depositPayment && (
            <div className="card p-5 bg-emerald-50 border-emerald-200">
              <div className="flex gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-900 text-sm">
                    Dépôt débité · {formatMoney(Math.round(depositPayment.amount_cents / 100))}
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Confirmé le {new Date(depositPayment.succeeded_at || depositPayment.created_at).toLocaleString('fr-CA')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {myWinningBid && depositPayment && !ddDone && !balancePayment && feeQuote && (
            <div className="card p-5">
              <h4 className="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#C2410C]" /> Confirmer la due diligence
              </h4>
              <p className="text-xs text-gray-600 mb-3">
                Cliquez ci-dessous pour confirmer la fin de votre due diligence. Le solde
                de <strong>{formatMoney(feeQuote.balance)}</strong> sera alors débité automatiquement.
              </p>
              {deal.due_diligence_deadline && (
                <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-800 font-medium mb-1">Délai pour confirmer :</p>
                  <Timer closeAt={deal.due_diligence_deadline} size="sm" />
                </div>
              )}
              <button
                onClick={() => dueDiligenceMutation.mutate()}
                disabled={dueDiligenceMutation.isPending}
                className="btn-primary w-full"
              >
                {dueDiligenceMutation.isPending ? 'Traitement...' : "J'ai complété ma due diligence"}
              </button>
            </div>
          )}

          {balancePayment && balancePayment.state === 'succeeded' && (
            <div className="card p-5 bg-emerald-50 border-emerald-200">
              <div className="flex gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-900 text-sm">
                    Solde débité · {formatMoney(Math.round(balancePayment.amount_cents / 100))}
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Frais Logeo entièrement réglés.
                  </p>
                </div>
              </div>
            </div>
          )}

          {balancePayment && balancePayment.state === 'failed' && (
            <div className="card p-5 bg-red-50 border-red-200">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 text-sm">Échec du débit du solde</h4>
                  <p className="text-xs text-red-800 mt-1">
                    {balancePayment.failure_message || 'Carte refusée.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <Modal open={ndaModal} onClose={() => setNdaModal(false)} title="Accord de non-divulgation (NDA)" size="lg">
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-lg bg-[#FFEDD5] border border-[#FDBA74] p-3 text-xs text-[#9A3412]">
            Deal <strong>{deal.city}</strong> · #{String(dealId).slice(0, 8).toUpperCase()}
            <p className="mt-1">
              En signant ce NDA, vous accédez à l'<strong>adresse exacte</strong> de la propriété et
              à tous les documents. <strong>Durée non-contournement : 24 mois.</strong>
              Pénalité d'infraction : <strong>3× les frais Logeo applicables</strong>, juridiquement exigible.
            </p>
          </div>

          <p className="font-medium text-gray-900">Cochez chacune des 4 clauses :</p>
          <ul className="space-y-2.5">
            {[
              { key: 'consent_confidentiality',
                title: 'Confidentialité totale',
                body: "Je m'engage à maintenir une confidentialité totale sur l'adresse, l'identité du courtier, l'identité du vendeur, les documents et les données financières du deal." },
              { key: 'consent_no_direct_contact',
                title: 'Non-contact direct vendeur/courtier',
                body: "Je ne contacterai pas directement le vendeur ou le courtier en dehors du canal Logeo, pendant l'enchère et pour 24 mois après." },
              { key: 'consent_logeo_exclusive_source',
                title: 'Reconnaissance source exclusive Logeo',
                body: "Toute transaction sur cette propriété dans les 24 mois doit transiter par Logeo. Sinon, pénalité de 3× les frais Logeo." },
              { key: 'consent_no_third_party_share',
                title: 'Non-partage avec tiers',
                body: "Je ne partagerai aucune information du dossier (photos, documents, données) avec un tiers sans autorisation écrite préalable de Logeo." },
            ].map(c => (
              <li key={c.key}>
                <label className="block p-3 rounded-lg border border-gray-200 hover:border-[#FDBA74] cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={ndaConsents[c.key]}
                      onChange={(e) => setNdaConsents({ ...ndaConsents, [c.key]: e.target.checked })}
                      className="mt-0.5 rounded border-gray-300 text-[#EA580C] focus:ring-[#EA580C]"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
                      <p className="text-xs text-gray-700 mt-0.5">{c.body}</p>
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>

          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p>
              <strong>Preuves légales (Loi 25 — Québec) :</strong> votre adresse IP, l'horodatage et l'agent
              utilisateur sont enregistrés. Un PDF signé contenant l'adresse exacte du deal et les 4 clauses
              cochées vous sera envoyé par email à la signature.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setNdaModal(false)} className="btn-secondary">Annuler</button>
            <button
              onClick={() => signNda.mutate()}
              disabled={signNda.isPending || !allNdaConsentsChecked}
              className="btn-primary"
            >
              <ShieldCheck className="h-4 w-4" />
              {signNda.isPending ? 'Signature...' : 'Je signe le NDA'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={engagementModal} onClose={() => setEngagementModal(false)}
             title="Engagement de paiement des frais Logeo" size="lg">
        <div className="space-y-4 text-sm text-gray-700">
          <p>En cas de victoire, je m'engage à payer les frais Logeo selon la structure suivante :</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong>1 % du prix gagnant</strong> {deal.fee_pct && ` (${deal.fee_pct}% configuré pour ce deal)`}</li>
            <li><strong>25 % de dépôt</strong> débité à la fermeture (min 2 500 $)</li>
            <li><strong>75 % de solde</strong> à la confirmation de due diligence</li>
          </ul>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setEngagementModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={() => signEngagement.mutate()} disabled={signEngagement.isPending} className="btn-primary">
              {signEngagement.isPending ? '...' : "Je m'engage"}
            </button>
          </div>
        </div>
      </Modal>

      <BidDisclaimerModal
        open={disclaimerModal}
        onClose={() => setDisclaimerModal(false)}
        amount={bidAmount}
        onConfirm={(consents) => placeBid.mutate(consents)}
        isSubmitting={placeBid.isPending}
      />

      <Modal open={visitModal} onClose={() => setVisitModal(false)} title="Demander une visite physique">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Le courtier recevra un email avec votre demande et vous contactera directement pour fixer la visite.
          </p>
          <Input
            label="Créneau souhaité"
            value={visitForm.proposed_slot}
            onChange={(e) => setVisitForm({ ...visitForm, proposed_slot: e.target.value })}
            placeholder="Ex: Mardi 14 mai 18h00"
          />
          <Textarea
            label="Message (optionnel)"
            value={visitForm.note}
            onChange={(e) => setVisitForm({ ...visitForm, note: e.target.value })}
            rows={3}
            placeholder="Précisions sur la visite..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setVisitModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={() => visitRequest.mutate()} disabled={visitRequest.isPending} className="btn-primary">
              {visitRequest.isPending ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Sticky bottom CTA mobile (sprint UX item 1+3) */}
      {isAuctionOpen && hasSignedNda && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {ranking?.displayed_price != null && (
                <p className="text-xs text-gray-500 leading-tight">Prix actuel</p>
              )}
              <p className="font-bold text-[#9A3412] text-lg leading-tight">
                {ranking?.displayed_price != null
                  ? formatMoney(live.livePrice ?? ranking.displayed_price)
                  : 'Enchère'}
              </p>
            </div>
            <a
              href="#bid-form"
              onClick={(e) => {
                const target = document.getElementById('bid-form')
                if (target) {
                  e.preventDefault()
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }}
              className="btn-primary flex-shrink-0"
            >
              <Trophy className="h-4 w-4" /> Enchérir
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
