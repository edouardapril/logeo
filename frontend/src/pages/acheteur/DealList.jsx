import { useQuery } from '@tanstack/react-query'
import { Building2, Sparkles } from 'lucide-react'
import { listDealsApi } from '../../api/acheteur'
import DealCard from '../../components/deal/DealCard'
import Spinner from '../../components/ui/Spinner'

export default function DealList() {
  const { data: deals, isLoading, error } = useQuery({
    queryKey: ['acheteur', 'deals'],
    queryFn: listDealsApi,
    refetchInterval: 30_000,
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Deals disponibles</h1>
        <p className="text-sm text-gray-600">
          Opportunités off-market en cours d'enchère · Mise à jour automatique
        </p>
      </div>

      {!deals?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucun deal actif pour le moment</h3>
          <p className="text-sm text-gray-500">
            Vous recevrez un email dès qu'un nouveau deal sera publié.
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
