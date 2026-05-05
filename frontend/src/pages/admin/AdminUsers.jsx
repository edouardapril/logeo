import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Power } from 'lucide-react'
import { listUsersApi, qualifyUserApi, toggleUserApi } from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'

const ROLES = [
  { value: '', label: 'Tous les rôles' },
  { value: 'acheteur', label: 'Acheteurs' },
  { value: 'courtier', label: 'Courtiers' },
  { value: 'admin', label: 'Admins' },
]

export default function AdminUsers() {
  const [role, setRole] = useState('acheteur')
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', role],
    queryFn: () => listUsersApi(role || undefined),
  })

  const qualify = useMutation({
    mutationFn: ({ userId, isQualified }) => qualifyUserApi(userId, isQualified),
    onSuccess: () => {
      toast.success('Statut mis à jour')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const toggle = useMutation({
    mutationFn: (userId) => toggleUserApi(userId),
    onSuccess: () => {
      toast.success('Compte modifié')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: () => toast.error('Erreur'),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Utilisateurs</h1>
      <p className="text-sm text-gray-600 mb-6">Gérer les courtiers et acheteurs</p>

      <div className="flex items-center gap-2 mb-4">
        {ROLES.map(r => (
          <button
            key={r.value}
            onClick={() => setRole(r.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              role === r.value
                ? 'bg-logeo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Détails</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users?.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.role === 'courtier' && u.oaciq_number && `OACIQ ${u.oaciq_number}`}
                    {u.role === 'courtier' && u.agency_name && ` · ${u.agency_name}`}
                    {u.role === 'acheteur' && u.phone && u.phone}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {u.role === 'acheteur' && (
                        u.is_qualified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" /> Qualifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            En attente
                          </span>
                        )
                      )}
                      {!u.is_active && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          Désactivé
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'acheteur' && (
                        <button
                          onClick={() => qualify.mutate({ userId: u.id, isQualified: !u.is_qualified })}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                            u.is_qualified
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.is_qualified ? 'Disqualifier' : 'Qualifier'}
                        </button>
                      )}
                      <button
                        onClick={() => toggle.mutate(u.id)}
                        title={u.is_active ? 'Désactiver' : 'Réactiver'}
                        className="text-xs p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users?.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-500">Aucun utilisateur</p>
          )}
        </div>
      )}
    </div>
  )
}
