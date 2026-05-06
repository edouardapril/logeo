import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react'
import { conventionStatusApi, signConventionApi } from '../../api/profile'
import Spinner from '../../components/ui/Spinner'

const CLAUSES = [
  {
    key: 'consent_floor_price_binding',
    title: 'Engagement ferme du prix plancher',
    body: "Le prix plancher que je soumets est le prix minimum réel que le vendeur s'engage à accepter. Tout refus d'une offre gagnante au-dessus du prix plancher entraîne une pénalité financière de 3× les frais Logeo et l'expulsion immédiate de la plateforme.",
  },
  {
    key: 'consent_no_circumvention',
    title: 'Non-contournement (24 mois)',
    body: "Je m'engage à ne pas contourner Logeo en concluant directement avec un acheteur découvert via la plateforme, pendant une durée de 24 mois. La pénalité de contournement est de 3× les frais Logeo, juridiquement exécutoire au Québec.",
  },
  {
    key: 'consent_data_accuracy',
    title: 'Exactitude des informations',
    body: "Je certifie l'exactitude de toutes les informations soumises (revenus, dépenses, baux, état de la propriété, divulgations matières). Toute fausse déclaration entraîne la suspension immédiate du deal et de mon accès à la plateforme.",
  },
  {
    key: 'consent_penalties',
    title: 'Acceptation des pénalités',
    body: "Je comprends et accepte que toute infraction aux clauses ci-dessus entraîne une pénalité financière, l'expulsion de la plateforme, et possiblement un signalement à l'OACIQ.",
  },
]

export default function Convention() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const next = location.state?.next || '/courtier'

  const { data: status, isLoading } = useQuery({
    queryKey: ['convention-status'],
    queryFn: conventionStatusApi,
  })

  const [consents, setConsents] = useState({
    consent_floor_price_binding: false,
    consent_no_circumvention: false,
    consent_data_accuracy: false,
    consent_penalties: false,
  })

  const allChecked = CLAUSES.every(c => consents[c.key])

  const sign = useMutation({
    mutationFn: () => signConventionApi(consents),
    onSuccess: () => {
      toast.success('Convention signée — vous pouvez soumettre des deals')
      queryClient.invalidateQueries({ queryKey: ['convention-status'] })
      navigate(next)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  if (isLoading) return <Spinner label="Chargement..." />

  if (status?.signed) {
    return (
      <div className="max-w-2xl">
        <Link to="/courtier" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="card p-8 text-center bg-emerald-50 border-emerald-200">
          <ShieldCheck className="h-12 w-12 mx-auto text-emerald-600 mb-3" />
          <h1 className="text-xl font-bold text-emerald-900 mb-1">Convention signée</h1>
          <p className="text-sm text-emerald-800 mb-1">
            Version {status.version} · signée le {new Date(status.signed_at).toLocaleString('fr-CA')}
          </p>
          <p className="text-xs text-emerald-700">
            Vous pouvez soumettre des deals normalement.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Convention courtier Logeo</h1>
      <p className="text-sm text-gray-600 mb-6">
        Pour publier des deals sur Logeo, vous devez accepter explicitement les clauses
        ci-dessous. Votre signature électronique inclut votre adresse IP et l'horodatage,
        et constitue une preuve légale au Québec (Loi 25).
      </p>

      <div className="card p-5 bg-amber-50 border-amber-200 mb-6 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold mb-1">Lecture attentive recommandée</p>
          <p className="text-xs">
            Toutes les clauses sont juridiquement contraignantes. Une fois signée, la convention
            engage votre responsabilité personnelle de courtier OACIQ.
          </p>
        </div>
      </div>

      <ul className="space-y-3 mb-6">
        {CLAUSES.map(c => (
          <li key={c.key}>
            <label className="block p-4 rounded-lg border border-gray-200 hover:border-[#FDBA74] cursor-pointer">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consents[c.key]}
                  onChange={(e) => setConsents({ ...consents, [c.key]: e.target.checked })}
                  className="mt-1 rounded border-gray-300 text-[#EA580C] focus:ring-[#EA580C]"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm mb-1">{c.title}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.body}</p>
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex justify-end gap-3">
        <Link to="/courtier" className="btn-secondary">Annuler</Link>
        <button
          onClick={() => sign.mutate()}
          disabled={!allChecked || sign.isPending}
          className="btn-primary"
        >
          <ShieldCheck className="h-4 w-4" />
          {sign.isPending ? 'Signature...' : 'Signer la convention'}
        </button>
      </div>
    </div>
  )
}
