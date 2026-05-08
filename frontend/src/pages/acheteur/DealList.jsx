import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Sparkles } from 'lucide-react'
import { listDealsApi, listActiveRegionsApi } from '../../api/acheteur'
import DealCard from '../../components/deal/DealCard'
import Spinner from '../../components/ui/Spinner'
import OnboardingProgress from '../../components/acheteur/OnboardingProgress'
import { Select } from '../../components/ui/Input'
import { PROPERTY_TYPES } from '../../utils/constants'
import { regionLabel } from '../../utils/quebec'

export default function DealList() {
  const [region, setRegion] = useState('')
  const [propertyType, setPropertyType] = useState('')

  const { data: deals, isLoading, error } = useQuery({
    queryKey: ['acheteur', 'deals', region, propertyType],
    queryFn: () => listDealsApi({
      region: region || undefined,
      property_type: propertyType || undefined,
    }),
    refetchInterval: 30_000,
  })

  const { data: activeRegions } = useQuery({
    queryKey: ['acheteur', 'deals', 'regions'],
    queryFn: listActiveRegionsApi,
    enabled: !error,
  })

  if (isLoading) return <Spinner label="Chargement des deals..." />

  if (error?.response?.status === 403) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <Sparkles className="h-12 w-12 mx-auto text-amber-400 mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Compte en cours de qualification</h2>
        <p className="text-sm text-gray-600">
          Votre profil d'investisseur est en cours d'examen par l'équipe Logeo.
          Nous vous contacterons sous 24h pour finaliser votre qualification et vous donner accès aux deals.
        </p>
      </div>
    )
  }

  const regionOptions = [
    { value: '', label: 'Toutes les régions' },
    ...(activeRegions || []).map(r => ({
      value: r.region,
      label: `${regionLabel(r.region)} (${r.count})`,
    })),
  ]

  const propertyTypeOptions = [
    { value: '', label: 'Tous les types' },
    ...PROPERTY_TYPES,
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Deals disponibles</h1>
        <p className="text-sm text-gray-600">
          Opportunités off-market en cours d'enchère · Mise à jour automatique
        </p>
      </div>

      {/* Barre de progression onboarding (sprint UX item 2) */}
      <OnboardingProgress />

      {/* Filtres */}
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Région"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={regionOptions}
          />
          <Select
            label="Type d'immeuble"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            options={propertyTypeOptions}
          />
        </div>
        {(region || propertyType) && (
          <button
            onClick={() => { setRegion(''); setPropertyType('') }}
            className="text-xs link-brand font-medium mt-3"
          >
            ↺ Réinitialiser les filtres
          </button>
        )}
      </div>

      {!deals?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">
            {(region || propertyType) ? 'Aucun deal pour ces critères' : 'Aucun deal actif pour le moment'}
          </h3>
          <p className="text-sm text-gray-500">
            {(region || propertyType)
              ? 'Essayez d\'autres filtres ou retirez-les pour voir tous les deals.'
              : 'Vous recevrez un email dès qu\'un nouveau deal sera publié.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} to={`/acheteur/deals/${deal.id}`} />
          ))}
        </div>
      )}
    </div>
  )
}
