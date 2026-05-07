import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, ArrowRight, SlidersHorizontal, ArrowUpDown, BellRing } from 'lucide-react'
import { publicMarketplaceApi } from '../../api/public'
import Spinner from '../../components/ui/Spinner'
import QuebecLocationPicker from '../../components/ui/QuebecLocationPicker'
import PublicDealCard from '../../components/deal/PublicDealCard'
import { Select } from '../../components/ui/Input'
import { PROPERTY_TYPES } from '../../utils/constants'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

const SORTS = [
  { value: 'timer_asc',  label: 'Ferme bientôt (urgent)' },
  { value: 'recent',     label: 'Plus récent' },
  { value: 'floor_asc',  label: 'Prix plancher croissant' },
  { value: 'floor_desc', label: 'Prix plancher décroissant' },
]

export default function Marketplace() {
  const [filters, setFilters] = useState({ region: '', mrc: '', city: '' })
  const [floorMin, setFloorMin] = useState('')
  const [floorMax, setFloorMax] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [sort, setSort] = useState('timer_asc')

  const { data: deals, isLoading } = useQuery({
    queryKey: ['marketplace', filters.region, filters.mrc, filters.city],
    queryFn: () => publicMarketplaceApi({
      region: filters.region || undefined,
      mrc: filters.mrc || undefined,
      city: filters.city || undefined,
    }),
    refetchInterval: 30_000,
  })

  // Bornes prix dynamiques (pour les sliders)
  const priceRange = useMemo(() => {
    if (!deals?.length) return { min: 0, max: 5_000_000 }
    const prices = deals.map(d => d.floor_price).filter(p => p != null)
    if (!prices.length) return { min: 0, max: 5_000_000 }
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [deals])

  const filtered = useMemo(() => {
    if (!deals) return []
    let out = deals
    if (propertyType) out = out.filter(d => d.property_type === propertyType)
    const fMin = floorMin === '' ? null : Number(floorMin)
    const fMax = floorMax === '' ? null : Number(floorMax)
    if (fMin != null) out = out.filter(d => (d.floor_price ?? 0) >= fMin)
    if (fMax != null) out = out.filter(d => (d.floor_price ?? Infinity) <= fMax)

    const sorted = [...out]
    switch (sort) {
      case 'floor_asc':
        sorted.sort((a, b) => (a.floor_price ?? Infinity) - (b.floor_price ?? Infinity)); break
      case 'floor_desc':
        sorted.sort((a, b) => (b.floor_price ?? -Infinity) - (a.floor_price ?? -Infinity)); break
      case 'timer_asc':
        sorted.sort((a, b) => new Date(a.bid_close_at || 0) - new Date(b.bid_close_at || 0)); break
      case 'recent':
      default:
        sorted.sort((a, b) => new Date(b.bid_open_at || 0) - new Date(a.bid_open_at || 0)); break
    }
    return sorted
  }, [deals, propertyType, floorMin, floorMax, sort])

  const hasFilter = filters.region || filters.mrc || filters.city || propertyType || floorMin || floorMax

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Enchères en cours</h1>
        <p className="text-sm text-gray-600">
          Multilogements, projets et terrains à plex partout au Québec.
          Pour participer aux enchères : inscription gratuite et qualification.
        </p>
      </div>

      {/* Filtres + tri */}
      <div className="card p-5 mb-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtrer
          </p>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <QuebecLocationPicker value={filters} onChange={setFilters} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Type de propriété"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            options={[
              { value: '', label: 'Tous les types' },
              ...PROPERTY_TYPES,
            ]}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Prix plancher min
            </label>
            <input
              type="number" min={priceRange.min} step="50000"
              value={floorMin}
              onChange={(e) => setFloorMin(e.target.value)}
              placeholder={priceRange.min ? formatMoney(priceRange.min) : '0 $'}
              className="input-base"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Prix plancher max
            </label>
            <input
              type="number" min="0" step="50000"
              value={floorMax}
              onChange={(e) => setFloorMax(e.target.value)}
              placeholder={priceRange.max ? formatMoney(priceRange.max) : 'illimité'}
              className="input-base"
            />
          </div>
        </div>

        {hasFilter && (
          <button
            onClick={() => {
              setFilters({ region: '', mrc: '', city: '' })
              setPropertyType(''); setFloorMin(''); setFloorMax('')
            }}
            className="text-xs link-brand font-medium"
          >
            ↺ Réinitialiser tous les filtres
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner label="Chargement des enchères..." />
      ) : !deals?.length ? (
        // Marketplace vide — aucun deal actif sur la plateforme
        <div className="card p-12 text-center bg-[#FFF7ED] border-[#FED7AA]">
          <BellRing className="h-12 w-12 mx-auto text-[#EA580C] mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">
            Aucune enchère en cours pour le moment.
          </h3>
          <p className="text-sm text-gray-600 mb-5">
            Revenez bientôt — de nouveaux deals sont publiés régulièrement.
          </p>
          <Link to="/register/acheteur" className="btn-primary inline-flex">
            S'inscrire pour être notifié <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : !filtered.length ? (
        // Filtres trop restrictifs — il y a des deals mais aucun ne correspond
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucune enchère pour ces critères</h3>
          <p className="text-sm text-gray-500 mb-4">
            Essayez d'élargir la recherche en modifiant ou réinitialisant les filtres ci-dessus.
          </p>
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

      {deals?.length > 0 && (
      <div className="mt-12 card p-6 bg-[#FFEDD5] border-[#FDBA74] text-center">
        <h2 className="font-bold text-[#9A3412] mb-2">Envie d'enchérir ?</h2>
        <p className="text-sm text-[#9A3412]/80 mb-4">
          Inscrivez-vous comme acheteur qualifié. Qualification sous 24h.
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <Link to="/register/acheteur" className="btn-primary">
            S'inscrire <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/login" className="btn-secondary">Se connecter</Link>
        </div>
      </div>
      )}
    </div>
  )
}
