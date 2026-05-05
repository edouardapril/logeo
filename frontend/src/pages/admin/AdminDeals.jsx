import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminListDealsApi } from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'analyse', label: 'En analyse' },
  { value: 'bid', label: 'Enchère active' },
  { value: 'intro', label: 'Intro confirmée' },
  { value: 'pa_signed', label: 'PA signée' },
  { value: 'nogo', label: 'Refusés' },
]

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function AdminDeals() {
  const [status, setStatus] = useState('')

  const { data: deals, isLoading } = useQuery({
    queryKey: ['admin', 'deals', status],
    queryFn: () => adminListDealsApi(status || undefined),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tous les deals</h1>
      <p className="text-sm text-gray-600 mb-6">Analyser, gérer et confirmer les paiements</p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              status === s.value
                ? 'bg-logeo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Prix demandé</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Fin enchère</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals?.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/deals/${d.id}`} className="font-medium text-gray-900 hover:text-logeo-600">
                      {d.property_type}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.city}</td>
                  <td className="px-4 py-3 font-medium">{formatMoney(d.asking_price)}</td>
                  <td className="px-4 py-3"><Badge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {d.bid_close_at ? new Date(d.bid_close_at).toLocaleString('fr-CA') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleDateString('fr-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deals?.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-500">Aucun deal</p>
          )}
        </div>
      )}
    </div>
  )
}
