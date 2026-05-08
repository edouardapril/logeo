import {
  MapPin, Sparkles, AlertOctagon, Trophy, ShieldCheck, HelpCircle, Archive, Lock,
} from 'lucide-react'
import CountdownBoxes from '../ui/CountdownBoxes'
import AnimatedNumber from '../ui/AnimatedNumber'
import Badge from '../ui/Badge'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel, mrcLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

function isNew(deal) {
  if (!deal?.bid_open_at) return false
  return Date.now() - new Date(deal.bid_open_at).getTime() < 24 * 3600 * 1000
}
function isClosingSoon(deal) {
  if (!deal?.bid_close_at) return false
  return new Date(deal.bid_close_at).getTime() - Date.now() < 6 * 3600 * 1000
}

/**
 * Hero unifié de fiche deal — visuel acheteur post-NDA appliqué à tous les rôles.
 *
 * Structure (verticale, layout fixe) :
 *   - Ligne titre : Ville · Type + status badge + (NOUVEAU / DERNIÈRES HEURES /
 *     ARCHIVÉ) + sous-ligne région/MRC/# logements
 *   - Bloc enchère : countdown timer (cards JOUR/HR/MIN/SEC) à gauche, prix
 *     actuel + compteurs offres/intéressés + CTA principal à droite
 *
 * Props :
 *   - deal : objet deal avec bid_open_at, bid_close_at, displayed_price,
 *     bidders_count, ndas_count, status, archived_at, city, property_type,
 *     region, mrc, num_units
 *   - cta : ReactNode rendu dans la zone CTA (slot — varie selon le rôle)
 *   - liveBidClose, livePrice, liveBidders, extendedFlash : valeurs WS
 *     temps réel optionnelles (utilisées par DealDetail acheteur)
 *   - hideAuctionBlock : true pour cacher countdown/prix (deals draft/analyse
 *     où il n'y a pas encore d'enchère)
 */
export default function DealHero({
  deal,
  cta,
  liveBidClose,
  livePrice,
  liveBidders,
  extendedFlash,
  hideAuctionBlock = false,
}) {
  if (!deal) return null
  const newBadge = isNew(deal)
  const closingSoon = isClosingSoon(deal)
  const closeAt = liveBidClose || deal.bid_close_at
  const price = livePrice ?? deal.displayed_price
  const offers = liveBidders ?? deal.bidders_count ?? 0
  const ndas = deal.ndas_count ?? 0
  const showAuction = !hideAuctionBlock && (closeAt || price != null)

  return (
    <div className="card p-5 md:p-6 mb-6 bg-gradient-to-br from-white via-white to-[#FFEDD5]/40 border-[#FDBA74]">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 capitalize">
              {deal.city} · {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
            </h1>
            {deal.status && <Badge status={deal.status} />}
            {deal.archived_at && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-bold uppercase tracking-wide">
                <Archive className="h-3 w-3" /> Archivé
              </span>
            )}
            {newBadge && !deal.archived_at && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide">
                <Sparkles className="h-3 w-3" /> NOUVEAU
              </span>
            )}
            {closingSoon && !deal.archived_at && (
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

      {showAuction ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2 flex justify-center md:justify-start">
            {closeAt ? (
              <CountdownBoxes
                closeAt={closeAt}
                size="lg"
                showLabel
                extendedFlash={extendedFlash}
              />
            ) : (
              <div className="text-sm text-gray-500 inline-flex items-center gap-2">
                <Lock className="h-4 w-4" /> Enchères pas encore ouvertes
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="text-center md:text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {deal.status === 'bid' ? 'Prix actuel' : 'Prix plancher'}
              </p>
              <p className="text-3xl font-bold text-[#9A3412]">
                {price != null ? (
                  <AnimatedNumber value={price} format={formatMoney} />
                ) : (
                  formatMoney(deal.floor_price)
                )}
              </p>
              <div className="flex items-center justify-center md:justify-end gap-3 text-xs text-gray-500 mt-1">
                <span
                  className="inline-flex items-center gap-1"
                  title="Acheteurs ayant placé une enchère active sur ce deal."
                >
                  <Trophy className="h-3 w-3" />
                  <AnimatedNumber value={offers} />
                  {' '}{offers > 1 ? 'offres déposées' : 'offre déposée'}
                  <HelpCircle className="h-3 w-3 text-gray-400" />
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  title="Acheteurs qualifiés ayant signé la NDA pour consulter le dossier complet (sans forcément avoir déposé d'offre)."
                >
                  <ShieldCheck className="h-3 w-3" />
                  {ndas} {ndas > 1 ? 'investisseurs intéressés' : 'investisseur intéressé'}
                  <HelpCircle className="h-3 w-3 text-gray-400" />
                </span>
              </div>
            </div>
            {cta}
          </div>
        </div>
      ) : (
        // Pas de bloc enchère : on garde un emplacement CTA sur toute la largeur
        cta && <div className="pt-2">{cta}</div>
      )}
    </div>
  )
}
