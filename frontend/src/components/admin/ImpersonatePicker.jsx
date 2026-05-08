import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, X, Search } from 'lucide-react'
import {
  impersonateCandidatesApi,
  impersonateUserApi,
} from '../../api/admin'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'

const ROLE_LABEL = {
  acheteur: 'Acheteur',
  courtier: 'Courtier',
  regional_partner: 'Partenaire régional',
}

export default function ImpersonatePicker() {
  const navigate = useNavigate()
  const { startImpersonation } = useAuth()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['admin', 'impersonate-candidates', q],
    queryFn: () => impersonateCandidatesApi(q),
    enabled: open,
  })

  const startMut = useMutation({
    mutationFn: (target) => impersonateUserApi(target.id).then(t => ({ token: t, target })),
    onSuccess: ({ token, target }) => {
      startImpersonation(token, target)
      toast.success(`Mode visualisation : ${target.full_name}`)
      setOpen(false)
      // Redirige vers le dashboard du rôle impersonné
      if (target.role === 'acheteur') navigate('/acheteur')
      else if (target.role === 'courtier') navigate('/courtier')
      else navigate('/')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
      >
        <Eye className="h-4 w-4" />
        Voir en tant que…
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Voir en tant que"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Démarrer une session de visualisation. La session expire automatiquement
            après 60 minutes. Toutes les actions sont enregistrées dans l'audit.
          </p>
          <div className="card p-3 bg-amber-50 border-amber-200 text-xs text-amber-900">
            Les actions destructives ou engageantes (signer NDA, placer une offre,
            soumettre un deal, envoyer un message, modifier un paiement) sont
            <strong> bloquées</strong> en mode visualisation.
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email ou nom…"
              className="input-base pl-9"
              autoFocus
            />
          </div>

          {isLoading ? (
            <Spinner />
          ) : !candidates?.length ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {q ? 'Aucun utilisateur trouvé' : 'Tape un email ou un nom pour commencer'}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {candidates.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => startMut.mutate(u)}
                    disabled={startMut.isPending}
                    className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between gap-3 disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 flex-shrink-0">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">
              <X className="h-4 w-4" /> Annuler
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
