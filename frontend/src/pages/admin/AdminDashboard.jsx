import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, Users, Clock, CheckCircle2, ArrowRight } from 'lucide-react'
import { adminListDealsApi, listUsersApi } from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

function StatCard({ icon: Icon, label, value, tone = 'logeo' }) {
  const tones = {
    logeo: 'bg-logeo-50 text-logeo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data: deals, isLoading: loadingDeals } = useQuery({
    queryKey: ['admin', 'deals'],
    queryFn: () => adminListDealsApi(),
  })
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => listUsersApi(),
  })

  if (loadingDeals || loadingUsers) return <Spinner label="Chargement du tableau de bord..." />

  const dealsToReview = deals?.filter(d => d.status === 'analyse') || []
  const activeAuctions = deals?.filter(d => d.status === 'bid') || []
  const acheteurs = users?.filter(u => u.role === 'acheteur') || []
  const pendingQualif = acheteurs.filter(u => !u.is_qualified)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord</h1>
      <p className="text-sm text-gray-600 mb-6">Vue d'ensemble de la plateforme Logeo</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock} label="Deals à analyser" value={dealsToReview.length} tone="amber" />
        <StatCard icon={Building2} label="Enchères actives" value={activeAuctions.length} tone="blue" />
        <StatCard icon={Users} label="Acheteurs à qualifier" value={pendingQualif.length} tone="logeo" />
        <StatCard icon={CheckCircle2} label="Total deals" value={deals?.length || 0} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Deals en attente d'analyse</h2>
            <Link to="/admin/deals" className="text-sm text-logeo-600 hover:underline flex items-center gap-1">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {dealsToReview.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Aucun deal en attente</p>
          ) : (
            <ul className="space-y-2">
              {dealsToReview.slice(0, 5).map(d => (
                <li key={d.id}>
                  <Link
                    to={`/admin/deals/${d.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{d.city} · {d.property_type}</p>
                      <p className="text-xs text-gray-500">{formatMoney(d.asking_price)}</p>
                    </div>
                    <Badge status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Enchères en cours</h2>
            <Link to="/admin/deals" className="text-sm text-logeo-600 hover:underline flex items-center gap-1">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {activeAuctions.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Aucune enchère active</p>
          ) : (
            <ul className="space-y-2">
              {activeAuctions.slice(0, 5).map(d => (
                <li key={d.id}>
                  <Link
                    to={`/admin/deals/${d.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{d.city} · {d.property_type}</p>
                      <p className="text-xs text-gray-500">
                        Ferme le {new Date(d.bid_close_at).toLocaleString('fr-CA')}
                      </p>
                    </div>
                    <Badge status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
