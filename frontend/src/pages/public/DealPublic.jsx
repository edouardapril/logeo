import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Lock, MapPin, Users, ShieldCheck, ArrowRight, Building2,
  FileText, Camera, MessageSquare, Trophy, Clock, AlertOctagon, Sparkles,
} from 'lucide-react'
import { publicDealApi, publicDealQuestionsApi } from '../../api/public'
import Spinner from '../../components/ui/Spinner'
import CountdownBoxes from '../../components/ui/CountdownBoxes'
import AnimatedNumber from '../../components/ui/AnimatedNumber'
import ActivityFeed from '../../components/deal/ActivityFeed'
import useAuctionLive from '../../hooks/useAuctionLive'
import { useAuth } from '../../contexts/AuthContext'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel, mrcLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

function isNew(deal) {
  return deal.bid_open_at && Date.now() - new Date(deal.bid_open_at).getTime() < 24 * 3600 * 1000
}
function isClosingSoon(deal) {
  return deal.bid_close_at && new Date(deal.bid_close_at).getTime() - Date.now() < 6 * 3600 * 1000
}

/**
 * Section bloquée — gros bloc gris/flou avec icône cadenas + label.
 * Le contenu floutué donne envie tout en restant non révélé.
 */
function LockedBlock({ icon: Icon, title, hint }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      {/* Faux contenu flou en arrière-plan */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 opacity-60"
        style={{ filter: 'blur(8px)' }}
      />
      <div className="relative flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/80 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
          <Lock className="h-5 w-5 text-gray-500" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-400" />
            {title}
          </p>
          {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
          <p className="text-xs italic text-gray-500 mt-2">Accès après signature du NDA</p>
        </div>
      </div>
    </div>
  )
}

export default function DealPublic() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: deal, isLoading, error } = useQuery({
    queryKey: ['public-deal', id],
    queryFn: () => publicDealApi(id),
    refetchInterval: 30_000,
  })

  const { data: questions } = useQuery({
    queryKey: ['public-deal-questions', id],
    queryFn: () => publicDealQuestionsApi(id),
    enabled: !!deal,
  })

  // Live WS public (anonyme — pas de token)
  const live = useAuctionLive(id, { enabled: !!deal })

  if (isLoading) return <Spinner label="Chargement du deal..." />
  if (error || !deal) {
    return (
      <div className="card p-12 text-center">
        <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600">Deal introuvable ou non disponible.</p>
        <Link to="/marketplace" className="link-brand text-sm mt-3 inline-block">
          ← Retour à la marketplace
        </Link>
      </div>
    )
  }

  const newBadge = isNew(deal)
  const closingSoon = isClosingSoon(deal)
  // Si l'utilisateur est connecté en acheteur, propose le dossier complet
  const dealDetailHref = user?.role === 'acheteur'
    ? `/acheteur/deals/${id}` : '/login'
  const ctaLabel = user?.role === 'acheteur' ? 'Accéder au dossier complet' : 'Signer le NDA'

  return (
    <div className="pb-24 md:pb-0">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        ← Retour à la marketplace
      </Link>

      {/* ── HERO sticky avec timer + prix + CTA ── */}
      <div className="card p-5 md:p-6 mb-6 bg-gradient-to-br from-white via-white to-[#FFEDD5]/40 border-[#FDBA74]">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 capitalize">
                {deal.city} · {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
              </h1>
              {newBadge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" /> NOUVEAU
                </span>
              )}
              {closingSoon && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold uppercase tracking-wide animate-pulse">
                  <AlertOctagon className="h-3 w-3" /> DERNIÈRES HEURES
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {deal.region && regionLabel(deal.region)}
              {deal.mrc && ` · ${mrcLabel(deal.region, deal.mrc)}`}
              {deal.num_units && ` · ${deal.num_units} logements`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2 flex justify-center md:justify-start">
            {deal.bid_close_at && (
              <CountdownBoxes
                closeAt={live.liveCloseAt || deal.bid_close_at}
                size="lg"
                showLabel
                extendedFlash={live.extendedFlash}
              />
            )}
          </div>
          <div className="space-y-3">
            <div className="text-center md:text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500">Prix actuel</p>
              <p className="text-3xl font-bold text-[#9A3412]">
                <AnimatedNumber
                  value={live.livePrice ?? deal.displayed_price}
                  format={formatMoney}
                />
              </p>
              <div className="flex items-center justify-center md:justify-end gap-3 text-xs text-gray-500 mt-1">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  <AnimatedNumber value={live.liveBidders ?? deal.bidders_count} />
                  {' '}offres
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {deal.ndas_count} investisseurs
                </span>
              </div>
            </div>
            <Link
              to={dealDetailHref}
              className="btn-primary w-full text-base py-3"
            >
              <ShieldCheck className="h-5 w-5" /> {ctaLabel}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Layout principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Section financière (publique) */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Données financières</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Prix plancher</dt>
                <dd className="text-lg font-bold text-[#C2410C]">{formatMoney(deal.floor_price)}</dd>
              </div>
              {deal.gross_revenue != null && (
                <div>
                  <dt className="text-xs text-gray-500">Revenus bruts annuels</dt>
                  <dd className="font-semibold">{formatMoney(deal.gross_revenue)}</dd>
                </div>
              )}
              {deal.net_revenue != null && (
                <div>
                  <dt className="text-xs text-gray-500">Revenus nets annuels</dt>
                  <dd className="font-semibold">{formatMoney(deal.net_revenue)}</dd>
                </div>
              )}
              {deal.cap_rate != null && (
                <div>
                  <dt className="text-xs text-gray-500">TGA (cap rate) estimé</dt>
                  <dd className="font-semibold text-emerald-600">{deal.cap_rate}%</dd>
                </div>
              )}
              {deal.municipal_evaluation != null && (
                <div>
                  <dt className="text-xs text-gray-500">Évaluation municipale</dt>
                  <dd className="font-semibold">{formatMoney(deal.municipal_evaluation)}</dd>
                </div>
              )}
              {deal.ratio_floor_eval_pct != null && (
                <div>
                  <dt className="text-xs text-gray-500">Ratio prix/évaluation</dt>
                  <dd className="font-semibold">{deal.ratio_floor_eval_pct}%</dd>
                </div>
              )}
              {deal.total_area_sqft && (
                <div>
                  <dt className="text-xs text-gray-500">Superficie totale</dt>
                  <dd className="font-semibold">{deal.total_area_sqft.toLocaleString('fr-CA')} pi²</dd>
                </div>
              )}
              {deal.year_built && (
                <div>
                  <dt className="text-xs text-gray-500">Année de construction</dt>
                  <dd className="font-semibold">{deal.year_built}</dd>
                </div>
              )}
              {deal.tax_roll_date && (
                <div>
                  <dt className="text-xs text-gray-500">Date au rôle foncier</dt>
                  <dd className="font-semibold">
                    {new Date(deal.tax_roll_date).toLocaleDateString('fr-CA')}
                  </dd>
                </div>
              )}
            </dl>
            {deal.teaser_text && (
              <p className="text-sm text-gray-700 mt-4 pt-4 border-t border-gray-100 italic">
                « {deal.teaser_text} »
              </p>
            )}
          </div>

          {/* Photo teaser watermarquée */}
          {deal.teaser_photo_path && (
            <div className="card overflow-hidden">
              <img
                src={fileUrl(deal.teaser_photo_path)}
                alt={deal.city}
                className="w-full h-64 md:h-80 object-cover"
                loading="lazy"
              />
              <p className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100">
                Photo de façade · les autres photos sont accessibles après signature du NDA.
              </p>
            </div>
          )}

          {/* Sections bloquées — flou + cadenas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LockedBlock
              icon={Camera}
              title="Photos haute résolution"
              hint="Intérieur, extérieur, logements, parties communes — visibles après NDA."
            />
            <LockedBlock
              icon={MapPin}
              title="Adresse exacte"
              hint="Numéro civique et rue révélés à la signature."
            />
            <LockedBlock
              icon={FileText}
              title="Baux et déclaration vendeur"
              hint="Documents légaux complets — revenus locatifs détaillés par logement."
            />
            <LockedBlock
              icon={Users}
              title="Coordonnées du courtier"
              hint="Contact direct pour la due diligence."
            />
          </div>

          {/* FAQ publique read-only */}
          {questions?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#C2410C]" />
                Questions & réponses ({questions.length})
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Visibles publiquement. Pour poser une question, il faut signer le NDA.
              </p>
              <ul className="space-y-3">
                {questions.slice(0, 5).map(q => (
                  <li key={q.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">
                      {q.asked_at && new Date(q.asked_at).toLocaleDateString('fr-CA')}
                      {!q.answer && (
                        <span className="ml-2 text-amber-700 font-medium">· Sans réponse</span>
                      )}
                    </p>
                    <p className="text-sm font-medium text-gray-900 mb-2">{q.question}</p>
                    {q.answer && (
                      <div className="mt-2 pl-3 border-l-2 border-[#FDBA74] text-sm text-gray-700">
                        <p className="whitespace-pre-line">{q.answer}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {questions.length > 5 && (
                <p className="text-xs text-gray-500 mt-3">+{questions.length - 5} questions supplémentaires…</p>
              )}
            </div>
          )}

          {/* Message incitatif */}
          <div className="card p-6 bg-[#FFEDD5] border-[#FDBA74] text-center">
            <ShieldCheck className="h-8 w-8 mx-auto text-[#C2410C] mb-2" />
            <p className="font-bold text-[#9A3412] mb-2">
              {deal.ndas_count} investisseur{deal.ndas_count > 1 ? 's ont' : ' a'} déjà accédé au dossier complet
            </p>
            <p className="text-sm text-[#9A3412]/80 mb-4">
              Signez le NDA maintenant pour voir l'adresse, les baux, les loyers et toute la documentation.
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link to={dealDetailHref} className="btn-primary">
                {ctaLabel} <ArrowRight className="h-4 w-4" />
              </Link>
              {!user && (
                <Link to="/register/acheteur" className="btn-secondary">
                  Créer un compte gratuit
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar : activité temps réel + état enchère */}
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
              État de l'enchère
            </p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-600">Prix plancher</dt>
                <dd className="font-semibold">{formatMoney(deal.floor_price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Prix affiché</dt>
                <dd className="font-bold text-[#9A3412]">
                  {formatMoney(live.livePrice ?? deal.displayed_price)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Incrément min.</dt>
                <dd className="font-semibold">{formatMoney(deal.min_bid_increment)}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <dt className="text-gray-600">Offres reçues</dt>
                <dd className="font-semibold">
                  <AnimatedNumber value={live.liveBidders ?? deal.bidders_count} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Investisseurs intéressés</dt>
                <dd className="font-semibold">{deal.ndas_count}</dd>
              </div>
            </dl>
          </div>

          {/* Fil d'activité (anonyme) */}
          <ActivityFeed events={live.events} />

          <div className="card p-4 text-center text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5 inline mr-1" />
            Mise à jour temps réel via WebSocket
          </div>
        </div>
      </div>

      {/* Sticky bottom mobile CTA */}
      {deal.bid_close_at && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 leading-tight">Prix actuel</p>
              <p className="font-bold text-[#9A3412] text-lg leading-tight">
                {formatMoney(live.livePrice ?? deal.displayed_price)}
              </p>
            </div>
            <Link to={dealDetailHref} className="btn-primary flex-shrink-0">
              <ShieldCheck className="h-4 w-4" /> {ctaLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
