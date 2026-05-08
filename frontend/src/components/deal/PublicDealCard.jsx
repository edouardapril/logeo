import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Users, ShieldCheck, ArrowRight, Sparkles, AlertOctagon,
  Info, Activity,
} from 'lucide-react'
import CountdownBoxes from '../ui/CountdownBoxes'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

function isNew(deal) {
  if (!deal.bid_open_at) return false
  return Date.now() - new Date(deal.bid_open_at).getTime() < 24 * 3600 * 1000
}

function isClosingSoon(deal) {
  if (!deal.bid_close_at) return false
  return new Date(deal.bid_close_at).getTime() - Date.now() < 6 * 3600 * 1000
}

/**
 * Card teaser pour la marketplace publique. Riche, conçue pour donner envie de signer le NDA.
 * Affiche : photo watermarquée, badges (NOUVEAU / DERNIÈRES HEURES), 4 chiffres financiers,
 * timer animé, prix actuel temps réel, count bidders + count NDA (preuve sociale), CTA
 * "Accéder au dossier complet → Signature NDA requise".
 *
 *  Props:
 *    deal: { id, property_type, city, region, floor_price, gross_revenue, cap_rate,
 *            ratio_floor_eval_pct, num_units, year_built, total_area_sqft,
 *            displayed_price, bidders_count, ndas_count, bid_close_at, bid_open_at,
 *            teaser_text, teaser_photo_path }
 *    detailHref: target URL (ex: '/deals/<id>' public ou '/acheteur/deals/<id>' connecté)
 */
export default function PublicDealCard({ deal, detailHref }) {
  const newBadge = isNew(deal)
  const closingSoon = isClosingSoon(deal)
  const [showTgaDetail, setShowTgaDetail] = useState(false)
  const tgaComputable = deal.cap_rate != null && deal.net_revenue != null && deal.floor_price != null
  const offers = deal.bidders_count || 0

  return (
    <article className="card overflow-hidden group hover:shadow-md hover:border-[#FDBA74] transition-all flex flex-col">
      {/* Photo watermarquée (cover = teaser_photo_paths[0]) + badges */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        {(deal.teaser_photo_paths?.[0] || deal.teaser_photo_path) ? (
          <img
            src={fileUrl(deal.teaser_photo_paths?.[0] || deal.teaser_photo_path)}
            alt={deal.city}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <MapPin className="h-12 w-12" />
          </div>
        )}
        {/* Badges absolus */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {newBadge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide shadow">
              <Sparkles className="h-3 w-3" /> NOUVEAU
            </span>
          )}
          {closingSoon && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold uppercase tracking-wide shadow animate-pulse">
              <AlertOctagon className="h-3 w-3" /> DERNIÈRES HEURES
            </span>
          )}
        </div>
        {/* Timer absolu en bas-droite de la photo */}
        {deal.bid_close_at && (
          <div className="absolute bottom-2 right-2">
            <CountdownBoxes closeAt={deal.bid_close_at} size="compact" />
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {/* Identité du bien — type + secteur générique (jamais l'adresse exacte) */}
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-[#C2410C] font-semibold">
            {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
            {deal.num_units ? ` · ${deal.num_units} log.` : ''}
          </p>
          <p className="font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">
              {deal.city}
              {deal.region && <span className="text-xs text-gray-500 font-normal"> · {regionLabel(deal.region)}</span>}
            </span>
          </p>
          <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
            {deal.year_built && <span>Construit en {deal.year_built}</span>}
            {deal.total_area_sqft && (
              <span>{deal.total_area_sqft.toLocaleString('fr-CA')} pi²</span>
            )}
          </div>
        </div>

        {/* 4 chiffres financiers clés (spec chantier B) */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="rounded-lg bg-gray-50 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Prix plancher</p>
            <p className="font-bold text-gray-900">{formatMoney(deal.floor_price)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Revenus bruts</p>
            <p className="font-bold text-gray-900">{formatMoney(deal.gross_revenue)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Revenus nets</p>
            <p className="font-bold text-gray-900">{formatMoney(deal.net_revenue)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 relative">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700">TGA</p>
              {tgaComputable && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTgaDetail(v => !v) }}
                  className="text-emerald-700 hover:text-emerald-900"
                  aria-label="Voir le détail du calcul TGA"
                  title="Voir le détail du calcul"
                >
                  <Info className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="font-bold text-emerald-800">
              {deal.cap_rate != null ? `${deal.cap_rate}%` : '—'}
            </p>
            {showTgaDetail && tgaComputable && (
              <div
                className="absolute z-10 left-0 right-0 top-full mt-1 rounded-lg bg-white shadow-lg border border-emerald-200 p-3 text-xs text-gray-700"
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              >
                <p className="font-semibold text-emerald-800 mb-1">Calcul TGA (Taux Global d'Actualisation)</p>
                <p className="text-gray-600 mb-2">Formule : Revenus nets ÷ Prix plancher × 100</p>
                <dl className="space-y-0.5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Revenus nets (numérateur)</dt>
                    <dd className="font-medium">{formatMoney(deal.net_revenue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Prix plancher (dénominateur)</dt>
                    <dd className="font-medium">{formatMoney(deal.floor_price)}</dd>
                  </div>
                  <div className="flex justify-between pt-1 mt-1 border-t border-gray-100">
                    <dt className="text-emerald-800 font-semibold">TGA</dt>
                    <dd className="text-emerald-800 font-bold">{deal.cap_rate}%</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* Enchère en cours — prix actuel + bids + NDAs (preuve sociale) */}
        <div className="rounded-lg bg-[#FFEDD5] border border-[#FDBA74] p-3 mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wide text-[#9A3412] font-semibold">
              Prix actuel
            </span>
            <span className="text-xl font-bold text-[#9A3412]">
              {formatMoney(deal.displayed_price)}
            </span>
          </div>

          {/* Mesureur d'offres — état visuel discret pour créer du FOMO sans agressivité */}
          <div
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md mb-2 ${
              offers > 0
                ? 'bg-[#FFF7ED] border border-[#FDBA74]'
                : 'bg-white/60 border border-[#FDBA74]/50'
            }`}
            title={offers > 0 ? `${offers} offre${offers > 1 ? 's' : ''} déposée${offers > 1 ? 's' : ''}` : 'Aucune offre pour le moment'}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px]">
              {offers > 0 ? (
                <>
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inset-0 rounded-full bg-[#EA580C] opacity-75 animate-ping"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EA580C]"></span>
                  </span>
                  <Activity className="h-3 w-3 text-[#C2410C]" />
                  <span className="font-semibold text-[#C2410C]">
                    {offers} {offers > 1 ? 'offres déposées' : 'offre déposée'}
                  </span>
                </>
              ) : (
                <>
                  <Activity className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Aucune offre pour le moment</span>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#9A3412]/80">
            <span className="inline-flex items-center gap-1" title="Acheteurs ayant placé une offre active">
              <Users className="h-3 w-3" />
              {offers} {offers > 1 ? 'offres déposées' : 'offre déposée'}
            </span>
            <span className="inline-flex items-center gap-1" title="Investisseurs ayant signé le NDA pour accéder au dossier complet">
              <ShieldCheck className="h-3 w-3" />
              {deal.ndas_count} {deal.ndas_count > 1 ? 'investisseurs intéressés' : 'investisseur intéressé'}
            </span>
          </div>
        </div>

        {deal.teaser_text && (
          <p className="text-xs text-gray-600 mb-4 line-clamp-2 italic">
            « {deal.teaser_text} »
          </p>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <Link
            to={detailHref || `/deals/${deal.id}`}
            className="btn-primary w-full text-sm"
          >
            Accéder au dossier complet
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[11px] text-gray-500 text-center mt-1.5">
            <ShieldCheck className="h-3 w-3 inline mr-1" />
            Signature NDA requise · Gratuit
          </p>
        </div>
      </div>
    </article>
  )
}
