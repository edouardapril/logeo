import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, SlidersHorizontal, X } from 'lucide-react'
import { publicMarketplaceApi } from '../../api/public'
import Spinner from '../../components/ui/Spinner'
import QuebecLocationPicker from '../../components/ui/QuebecLocationPicker'
import PublicDealCard from '../../components/deal/PublicDealCard'
import { Select } from '../../components/ui/Input'
import { PROPERTY_TYPES } from '../../utils/constants'

/**
 * Vue marketplace pour le courtier — read-only.
 *
 * Utilise l'endpoint public /public/marketplace (pas de fuite : adresse, photos
 * privées et financiers détaillés ne sont jamais retournés). Le courtier ne
 * peut pas signer de NDA ni placer de bid : la fiche détail vers laquelle on
 * navigue est la vue publique read-only `/deals/:id`.
 */
export default function CourtierMarketplace() {
  const [filters, setFilters] = useState({ region: '', mrc: '', city: '' })
  const [propertyType, setPropertyType] = useState('')

  const { data: deals, isLoading } = useQuery({
    queryKey: ['courtier', 'marketplace', filters.region, filters.mrc, filters.city],
    queryFn: () => publicMarketplaceApi({
      region: filters.region || undefined,
      mrc: filters.mrc || undefined,
      city: filters.city || undefined,
    }),
    refetchInterval: 30_000,
  })

  const filtered = useMemo(() => {
    if (!deals) return []
    if (!propertyType) return deals
    return deals.filter(d => d.property_type === propertyType)
  }, [deals, propertyType])

  const hasFilter = filters.region || filters.mrc || filters.city || propertyType

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Marketplace</h1>
        <p className="text-sm text-gray-600">
          Tous les deals en enchère active sur Logeo. Vue lecture seule — un courtier ne peut pas signer de NDA ni enchérir.
        </p>
      </div>

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
        <QuebecLocationPicker value={filters} onChange={setFilters} />
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
        <Spinner label="Chargement de la marketplace..." />
      ) : !deals?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucune enchère active pour le moment.</h3>
        </div>
      ) : !filtered.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucune enchère pour ces critères</h3>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {filtered.length} enchère{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(d => (
              <PublicDealCard key={d.id} deal={d} detailHref={`/deals/${d.id}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
