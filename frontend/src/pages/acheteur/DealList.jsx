import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Sparkles, MapPin } from 'lucide-react'
import { listDealsApi } from '../../api/acheteur'
import DealCard from '../../components/deal/DealCard'
import Spinner from '../../components/ui/Spinner'
import { REGIONS, regionFromDeal } from '../../utils/constants'

export default function DealList() {
  const [region, setRegion] = useState('')

  const { data: deals, isLoading, error } = useQuery({
    queryKey: ['acheteur', 'deals'],
    queryFn: listDealsApi,
    refetchInterval: 30_000,
  })

  const dealsByRegion = useMemo(() => {
    if (!deals) return null
    const counts = REGIONS.reduce((a, r) => ({ ...a, [r.value]: 0 }), {})
    deals.forEach(d => {
      const r = regionFromDeal(d) || 'autre'
      counts[r] = (counts[r] || 0) + 1
      counts[''] = (counts[''] || 0) + 1
    })
    return counts
  }, [deals])

  const filtered = useMemo(() => {
    if (!deals) return []
    if (!region) return deals
    return deals.filter(d => regionFromDeal(d) === region)
  }, [deals, region])

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Deals disponibles</h1>
        <p className="text-sm text-gray-600">
          Opportunités off-market en cours d'enchère · Mise à jour automatique
        </p>
      </div>

      {/* Filtre régions */}
      {deals?.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <MapPin className="h-4 w-4 text-gray-400" />
          {REGIONS.map(r => {
            const count = dealsByRegion?.[r.value] || 0
            const active = region === r.value
            return (
              <button
                key={r.value || 'all'}
                onClick={() => setRegion(r.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#EA580C] text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                } ${count === 0 && r.value ? 'opacity-40' : ''}`}
              >
                {r.label}
                <span className={`text-xs px-1.5 rounded-full ${
                  active ? 'bg-white/25' : 'bg-gray-100 text-gray-600'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {!filtered.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">
            {deals?.length ? 'Aucun deal dans cette région' : 'Aucun deal actif pour le moment'}
          </h3>
          <p className="text-sm text-gray-500">
            {deals?.length
              ? 'Essayez une autre région ou retirez le filtre.'
              : 'Vous recevrez un email dès qu\'un nouveau deal sera publié.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(deal => (
            <DealCard key={deal.id} deal={deal} to={`/acheteur/deals/${deal.id}`} />
          ))}
        </div>
      )}
    </div>
  )
}
