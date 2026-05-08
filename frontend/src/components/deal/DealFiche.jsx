import { useState } from 'react'
import {
  MapPin, Building, Receipt, Hammer, FileText, Video, Info, User, Phone, Mail,
} from 'lucide-react'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel, mrcLabel } from '../../utils/quebec'
import DealPhotoSlideshow from './DealPhotoSlideshow'

/**
 * Fiche deal partagée — sections visuelles homogènes pour tous les rôles.
 *
 * Style et hiérarchie : ceux de la vue acheteur post-NDA (référence produit).
 * Ce composant est purement présentationnel : pas de fetch, pas de mutation,
 * pas de WebSocket. Chaque page parente garde ses CTAs (header, modales,
 * mutations) au-dessus / autour, et délègue le rendu des sections fiche à
 * ce composant.
 *
 * Props :
 *   - deal : objet deal (formes acceptées : DealTeaser, DealFull,
 *     DealCourtierFull, DealAdminView). Les champs absents sont gracieusement
 *     omis.
 *   - permissions : { canSeeAddress, canSeeFinancials, canSeePhotos,
 *     canSeeCourtier, canSeeDocuments, canSeeAdminMeta } — chaque flag
 *     est calculé par la page parente selon le rôle + ownership + NDA.
 */

const TRI_LABEL = { yes: 'Oui', no: 'Non', unknown: 'Inconnu' }
const WORK_LABEL = {
  toiture: 'Toiture', fondation: 'Fondation', electrique: 'Électrique',
  plomberie: 'Plomberie', fenetres: 'Fenêtres', chauffage: 'Chauffage',
}
const EXPENSES_LABEL = {
  taxes_municipales: 'Taxes municipales', taxes_scolaires: 'Taxes scolaires',
  assurances: 'Assurances', entretien: 'Entretien',
  frais_gestion: 'Frais de gestion', autres: 'Autres',
}

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

function FinancialTile({ label, value, accent = false }) {
  return (
    <div className={`rounded-lg p-3 ${accent ? 'bg-emerald-50' : 'bg-gray-50'}`}>
      <p className={`text-[10px] uppercase tracking-wide ${accent ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</p>
      <p className={`font-bold ${accent ? 'text-emerald-800' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function TgaTile({ deal }) {
  const [open, setOpen] = useState(false)
  const cap = deal.cap_rate ?? (
    deal.net_revenue && deal.floor_price
      ? Math.round(deal.net_revenue / deal.floor_price * 100 * 100) / 100
      : null
  )
  const computable = cap != null && deal.net_revenue != null && deal.floor_price != null
  return (
    <div className="rounded-lg bg-emerald-50 p-3 relative">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-emerald-700">TGA</p>
        {computable && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="text-emerald-700 hover:text-emerald-900"
            title="Voir le détail du calcul"
            aria-label="Voir le détail du calcul TGA"
          >
            <Info className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="font-bold text-emerald-800">{cap != null ? `${cap}%` : '—'}</p>
      {open && computable && (
        <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-lg bg-white shadow-lg border border-emerald-200 p-3 text-xs text-gray-700">
          <p className="font-semibold text-emerald-800 mb-1">Calcul TGA</p>
          <p className="text-gray-600 mb-2">Revenus nets ÷ Prix plancher × 100</p>
          <dl className="space-y-0.5">
            <div className="flex justify-between"><dt className="text-gray-500">Revenus nets</dt><dd className="font-medium">{formatMoney(deal.net_revenue)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Prix plancher</dt><dd className="font-medium">{formatMoney(deal.floor_price)}</dd></div>
            <div className="flex justify-between pt-1 mt-1 border-t border-gray-100"><dt className="text-emerald-800 font-semibold">TGA</dt><dd className="text-emerald-800 font-bold">{cap}%</dd></div>
          </dl>
        </div>
      )}
    </div>
  )
}

export default function DealFiche({ deal, permissions = {} }) {
  const {
    canSeeAddress = false,
    canSeeFinancials = true,
    canSeePhotos = false,
    canSeeCourtier = false,
    canSeeDocuments = false,
    canSeeAdminMeta = false,
  } = permissions

  if (!deal) return null

  const photos = canSeePhotos ? (deal.photo_paths?.length
    ? deal.photo_paths
    : (deal.teaser_photo_paths?.length ? deal.teaser_photo_paths : (deal.teaser_photo_path ? [deal.teaser_photo_path] : [])))
    : []

  const expenses = deal.expenses && Object.values(deal.expenses).some(v => v) ? deal.expenses : null
  const works = Array.isArray(deal.work_history) && deal.work_history.length > 0 ? deal.work_history : null
  const materials = deal.material_disclosures && Object.values(deal.material_disclosures).some(Boolean) ? deal.material_disclosures : null
  const documents = canSeeDocuments && deal.documents && Object.keys(deal.documents).length > 0 ? deal.documents : null

  return (
    <div className="space-y-6">
      {/* ── Photos slideshow ── */}
      {canSeePhotos && photos.length > 0 && (
        <div className="card overflow-hidden">
          <DealPhotoSlideshow
            photos={photos}
            height="h-64 md:h-80"
            showThumbnails={photos.length > 1}
            alt={deal.city || 'Photo'}
          />
        </div>
      )}

      {/* ── Informations propriété ── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building className="h-4 w-4 text-[#C2410C]" /> Informations propriété
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {canSeeAddress && deal.address_private && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-gray-500">Adresse complète</dt>
              <dd className="font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3 text-red-500" /> {deal.address_private}
              </dd>
            </div>
          )}
          {deal.city && (
            <div>
              <dt className="text-xs text-gray-500">Ville</dt>
              <dd className="font-medium">{deal.city}</dd>
            </div>
          )}
          {deal.region && (
            <div>
              <dt className="text-xs text-gray-500">Région</dt>
              <dd className="font-medium">{regionLabel(deal.region)}</dd>
            </div>
          )}
          {deal.mrc && (
            <div>
              <dt className="text-xs text-gray-500">MRC</dt>
              <dd className="font-medium">{mrcLabel(deal.region, deal.mrc)}</dd>
            </div>
          )}
          {deal.postal_code && (
            <div>
              <dt className="text-xs text-gray-500">Code postal</dt>
              <dd className="font-medium">{deal.postal_code}</dd>
            </div>
          )}
          {deal.property_type && (
            <div>
              <dt className="text-xs text-gray-500">Type</dt>
              <dd className="font-medium">{PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}</dd>
            </div>
          )}
          {deal.num_units != null && (
            <div>
              <dt className="text-xs text-gray-500">Logements</dt>
              <dd className="font-medium">{deal.num_units}</dd>
            </div>
          )}
          {deal.year_built != null && (
            <div>
              <dt className="text-xs text-gray-500">Année construction</dt>
              <dd className="font-medium">{deal.year_built}</dd>
            </div>
          )}
          {deal.total_area_sqft != null && (
            <div>
              <dt className="text-xs text-gray-500">Superficie totale</dt>
              <dd className="font-medium">{deal.total_area_sqft.toLocaleString('fr-CA')} pi²</dd>
            </div>
          )}
          {deal.zoning && (
            <div>
              <dt className="text-xs text-gray-500">Zonage</dt>
              <dd className="font-medium">{deal.zoning}</dd>
            </div>
          )}
          {deal.tax_roll_date && (
            <div>
              <dt className="text-xs text-gray-500">Date au rôle foncier</dt>
              <dd className="font-medium">{new Date(deal.tax_roll_date).toLocaleDateString('fr-CA')}</dd>
            </div>
          )}
        </dl>

        {deal.teaser_text && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs text-gray-500 mb-1">Description teaser</dt>
            <p className="text-sm text-gray-700 italic whitespace-pre-line">« {deal.teaser_text} »</p>
          </div>
        )}

        {deal.easements && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs text-gray-500 mb-1">Servitudes</dt>
            <p className="text-sm text-gray-700 whitespace-pre-line">{deal.easements}</p>
          </div>
        )}

        {deal.visit_notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs text-gray-500 mb-1">Notes de visite</dt>
            <p className="text-sm text-gray-700 whitespace-pre-line">{deal.visit_notes}</p>
          </div>
        )}

        {deal.virtual_tour_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Video className="h-3 w-3" /> Visite virtuelle
            </dt>
            <a href={deal.virtual_tour_url} target="_blank" rel="noreferrer" className="link-brand text-sm">
              {deal.virtual_tour_url}
            </a>
          </div>
        )}
      </div>

      {/* ── Données financières ── */}
      {canSeeFinancials && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#C2410C]" /> Données financières
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <FinancialTile label="Prix plancher" value={formatMoney(deal.floor_price)} />
            <FinancialTile label="Revenus bruts" value={formatMoney(deal.gross_revenue)} />
            <FinancialTile label="Revenus nets" value={formatMoney(deal.net_revenue)} />
            <TgaTile deal={deal} />
          </div>
          {deal.municipal_evaluation != null && (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-4 border-t border-gray-100">
              <div>
                <dt className="text-xs text-gray-500">Évaluation municipale</dt>
                <dd className="font-medium">{formatMoney(deal.municipal_evaluation)}</dd>
              </div>
              {deal.ratio_floor_eval_pct != null && (
                <div>
                  <dt className="text-xs text-gray-500">Ratio prix/évaluation</dt>
                  <dd className="font-medium">{deal.ratio_floor_eval_pct}%</dd>
                </div>
              )}
              {deal.yield_pct != null && (
                <div>
                  <dt className="text-xs text-gray-500">Rendement saisi</dt>
                  <dd className="font-medium text-emerald-600">{deal.yield_pct.toFixed(2)}%</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

      {/* ── Dépenses annuelles ── */}
      {expenses && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#C2410C]" /> Dépenses annuelles
          </h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {Object.entries(expenses).map(([k, v]) => v ? (
              <div key={k}>
                <dt className="text-xs text-gray-500">{EXPENSES_LABEL[k] || k}</dt>
                <dd className="font-medium">{formatMoney(Number(v))}</dd>
              </div>
            ) : null)}
          </dl>
        </div>
      )}

      {/* ── Travaux majeurs ── */}
      {works && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Hammer className="h-4 w-4 text-[#C2410C]" /> Travaux majeurs
          </h2>
          <ul className="space-y-2 text-sm">
            {works.map((w, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-medium min-w-[120px]">{WORK_LABEL[w.category] || w.category}</span>
                <span className="text-gray-700">{w.year || '—'}{w.note ? ` · ${w.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Divulgations matérielles ── */}
      {materials && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Divulgations matérielles</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {materials.asbestos && (
              <div>
                <dt className="text-xs text-gray-500">Amiante</dt>
                <dd className="font-medium">{TRI_LABEL[materials.asbestos] || materials.asbestos}</dd>
              </div>
            )}
            {materials.pyrite && (
              <div>
                <dt className="text-xs text-gray-500">Pyrite</dt>
                <dd className="font-medium">{TRI_LABEL[materials.pyrite] || materials.pyrite}</dd>
              </div>
            )}
            {materials.zoning_confirmed && (
              <div>
                <dt className="text-xs text-gray-500">Zonage confirmé</dt>
                <dd className="font-medium">{TRI_LABEL[materials.zoning_confirmed] || materials.zoning_confirmed}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Coordonnées courtier (post-NDA / admin) ── */}
      {canSeeCourtier && (deal.courtier_name || deal.courtier_email || deal.courtier_phone) && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-[#C2410C]" /> Courtier
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {deal.courtier_name && (
              <div>
                <dt className="text-xs text-gray-500">Nom</dt>
                <dd className="font-medium">{deal.courtier_name}</dd>
              </div>
            )}
            {deal.agency_name && (
              <div>
                <dt className="text-xs text-gray-500">Agence</dt>
                <dd className="font-medium">{deal.agency_name}</dd>
              </div>
            )}
            {deal.courtier_email && (
              <div>
                <dt className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</dt>
                <dd className="font-medium">{deal.courtier_email}</dd>
              </div>
            )}
            {deal.courtier_phone && (
              <div>
                <dt className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> Téléphone</dt>
                <dd className="font-medium">{deal.courtier_phone}</dd>
              </div>
            )}
            {deal.courtier_oaciq_number && (
              <div>
                <dt className="text-xs text-gray-500">OACIQ</dt>
                <dd className="font-medium">{deal.courtier_oaciq_number}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Documents (post-NDA / owner / admin) ── */}
      {documents && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#C2410C]" /> Documents
          </h2>
          <ul className="text-sm space-y-1.5">
            {Object.entries(documents).map(([key, path]) => path ? (
              <li key={key}>
                <a href={fileUrl(path)} target="_blank" rel="noreferrer" className="link-brand hover:underline">
                  {key.replace(/_/g, ' ')}
                </a>
              </li>
            ) : null)}
          </ul>
        </div>
      )}

      {/* ── Frais Logeo (admin/owner après verdict) ── */}
      {canSeeAdminMeta && (deal.fee_pct != null || deal.fee_minimum != null) && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Frais Logeo applicables</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {deal.fee_pct != null && (
              <div>
                <dt className="text-xs text-gray-500">Pourcentage</dt>
                <dd className="font-medium">{deal.fee_pct}%</dd>
              </div>
            )}
            {deal.fee_minimum != null && (
              <div>
                <dt className="text-xs text-gray-500">Plancher</dt>
                <dd className="font-medium">{formatMoney(deal.fee_minimum)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
