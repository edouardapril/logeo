import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Building2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { courtierListDealsApi } from '../../api/courtier'
import { conventionStatusApi } from '../../api/profile'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function CourtierDashboard() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ['courtier', 'deals'],
    queryFn: courtierListDealsApi,
  })
  const { data: conv } = useQuery({
    queryKey: ['convention-status'],
    queryFn: conventionStatusApi,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mes deals</h1>
          <p className="text-sm text-gray-600">Suivi de vos soumissions et enchères en cours</p>
        </div>
        <Link to="/courtier/submit" className="btn-primary">
          <Plus className="h-4 w-4" /> Soumettre un deal
        </Link>
      </div>

      {/* Bandeau convention */}
      {conv?.needs_resign ? (
        <div className="card p-4 mb-6 bg-amber-50 border-amber-200 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">Convention courtier à signer</p>
            <p className="text-xs text-amber-800 mt-1">
              Vous devez accepter explicitement les clauses (prix plancher, non-contournement, exactitude des données, pénalités) pour pouvoir soumettre des deals.
            </p>
          </div>
          <Link to="/courtier/convention" className="btn-primary text-xs whitespace-nowrap">
            Signer maintenant
          </Link>
        </div>
      ) : conv?.signed && (
        <div className="card p-3 mb-6 bg-emerald-50 border-emerald-200 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-xs text-emerald-900">
            Convention {conv.version} signée le {new Date(conv.signed_at).toLocaleDateString('fr-CA')}
          </p>
        </div>
      )}

      {isLoading ? <Spinner /> : !deals?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucun deal pour le moment</h3>
          <p className="text-sm text-gray-500 mb-4">
            Soumettez votre premier deal off-market à l'équipe Logeo
          </p>
          <Link to="/courtier/submit" className="btn-primary inline-flex">
            <Plus className="h-4 w-4" /> Soumettre un deal
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Prix demandé</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Soumis le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/courtier/deals/${d.id}`} className="font-medium text-gray-900 hover:text-[#EA580C]">
                      {d.property_type}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.city}</td>
                  <td className="px-4 py-3 font-medium">{formatMoney(d.asking_price)}</td>
                  <td className="px-4 py-3"><Badge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleDateString('fr-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
