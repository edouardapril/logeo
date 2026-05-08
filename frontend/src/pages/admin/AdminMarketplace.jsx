import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, SlidersHorizontal, X, Archive, Settings2 } from 'lucide-react'
import { publicMarketplaceApi } from '../../api/public'
import { adminListDealsEnrichedApi } from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import QuebecLocationPicker from '../../components/ui/QuebecLocationPicker'
import PublicDealCard from '../../components/deal/PublicDealCard'
import Badge from '../../components/ui/Badge'
import { Select } from '../../components/ui/Input'
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

/**
 * Marketplace côté admin — vue acheteur étendue.
 *
 * Modes :
 *  - "publiée" (défaut) : utilise /public/marketplace, exactement ce que voient
 *    les visiteurs/acheteurs ; teasers PublicDealCard.
 *  - "tous statuts" (toggle activé) : utilise /admin/deals/enriched avec
 *    include_archived=true ; affiche TOUS les deals incluant draft/analyse/
 *    nogo/auction_ended/archived avec un tableau condensé.
 *
 * L'admin peut cliquer sur un deal pour aller sur sa fiche admin.
 */
export default function AdminMarketplace() {
  const [showAll, setShowAll] = useState(false)
  const [filters, setFilters] = useState({ region: '', mrc: '', city: '' })
  const [propertyType, setPropertyType] = useState('')

  const { data: publicDeals, isLoading: loadingPublic } = useQuery({
    queryKey: ['admin', 'marketplace-public', filters.region, filters.mrc, filters.city],
    queryFn: () => publicMarketplaceApi({
      region: filters.region || undefined,
      mrc: filters.mrc || undefined,
      city: filters.city || undefined,
    }),
    enabled: !showAll,
    refetchInterval: 30_000,
  })

  const { data: allDeals, isLoading: loadingAll } = useQuery({
    queryKey: ['admin', 'marketplace-all'],
    queryFn: () => adminListDealsEnrichedApi(undefined, true),  // include archived
    enabled: showAll,
    refetchInterval: 30_000,
  })

  const filteredPublic = useMemo(() => {
    if (!publicDeals) return []
    if (!propertyType) return publicDeals
    return publicDeals.filter(d => d.property_type === propertyType)
  }, [publicDeals, propertyType])

  const filteredAll = useMemo(() => {
    if (!allDeals) return []
    return allDeals.filter(d => {
      if (propertyType && d.property_type !== propertyType) return false
      if (filters.region && d.region !== filters.region) return false
      return true
    })
  }, [allDeals, propertyType, filters])

  const isLoading = showAll ? loadingAll : loadingPublic
  const hasFilter = filters.region || filters.mrc || filters.city || propertyType

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Marketplace</h1>
        <p className="text-sm text-gray-600">
          Vue admin de la marketplace — {showAll
            ? 'TOUS les deals incluant brouillons, refusés, terminés, archivés'
            : 'deals en enchère active uniquement (vue acheteur publique)'}
        </p>
      </div>

      {/* Toggle vue */}
      <div className="card p-4 mb-4 flex items-center gap-3 bg-gray-50">
        <Settings2 className="h-4 w-4 text-gray-500" />
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="font-medium text-gray-700">
            Inclure brouillons, refusés, terminés et archivés
          </span>
        </label>
        <span className="text-xs text-gray-500 ml-auto">
          (mode admin — visible seulement par les administrateurs)
        </span>
      </div>

      {/* Filtres */}
      <div className="card p-5 mb-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtrer
          </p>
          {hasFilter && (
            <button
              onClick={() => { setFilters({ region: '', mrc: '', city: '' }); setPropertyType('') }}
              className="text-xs link-brand font-medium inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Réinitialiser
            </button>
          )}
        </div>
        {!showAll && <QuebecLocationPicker value={filters} onChange={setFilters} />}
        <Select
          label="Type d'immeuble"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          options={[
            { value: '', label: 'Tous les types' },
            ...PROPERTY_TYPES,
          ]}
        />
      </div>

      {isLoading ? (
        <Spinner label="Chargement..." />
      ) : showAll ? (
        // ── Mode admin all-statuses : tableau condensé
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Type · Ville</th>
                <th className="px-4 py-3 text-right">Plancher</th>
                <th className="px-4 py-3 text-center">NDAs</th>
                <th className="px-4 py-3 text-center">Bidders</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Créé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAll.map(d => (
                <tr key={d.id} className={`hover:bg-gray-50 ${d.archived_at ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/admin/deals/${d.id}`} className="font-medium text-gray-900 hover:text-[#EA580C]">
                        {PROPERTY_TYPE_LABELS[d.property_type] || d.property_type}
                      </Link>
                      {d.archived_at && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-700">
                          <Archive className="h-2.5 w-2.5" /> Archivé
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {d.city}{d.region && <span className="text-gray-400"> · {regionLabel(d.region)}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-[#C2410C] font-medium">
                    {formatMoney(d.floor_price)}
                  </td>
                  <td className="px-4 py-3 text-center">{d.ndas_count}</td>
                  <td className="px-4 py-3 text-center">{d.bids_count}</td>
                  <td className="px-4 py-3"><Badge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleDateString('fr-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAll.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-500">Aucun deal pour ces critères</p>
          )}
        </div>
      ) : !publicDeals?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucune enchère active</h3>
        </div>
      ) : !filteredPublic.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucune enchère pour ces critères</h3>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {filteredPublic.length} enchère{filteredPublic.length > 1 ? 's' : ''} affichée{filteredPublic.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPublic.map(d => (
              <PublicDealCard key={d.id} deal={d} detailHref={`/admin/deals/${d.id}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
