import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, Calendar, Trophy, ArrowLeft } from 'lucide-react'
import { publicAcheteurApi } from '../../api/public'
import RatingStars from '../../components/ui/RatingStars'
import Spinner from '../../components/ui/Spinner'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'

const STATUS_LABEL = {
  bid: 'Enchère active',
  intro: 'Intro confirmée',
  pa_signed: 'PA signée',
}

export default function AcheteurPublic() {
  const { id } = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: ['public', 'acheteur', id],
    queryFn: () => publicAcheteurApi(id),
  })

  if (isLoading) return <Spinner label="Chargement du profil..." />
  if (error || !data) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500">Profil introuvable.</p>
      </div>
    )
  }

  const initials = (data.full_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/leaderboard" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour au leaderboard
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          {data.profile_photo_path ? (
            <img
              src={fileUrl(data.profile_photo_path)}
              alt={data.full_name}
              className="h-20 w-20 rounded-full object-cover border-2 border-[#FED7AA]"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{data.full_name}</h1>
            <p className="text-sm text-gray-600">Acheteur Logeo</p>
            {data.average_rating != null && (
              <div className="mt-2">
                <RatingStars
                  value={data.average_rating}
                  count={data.review_count}
                  showNumber size="sm" readonly
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Enchères remportées</p>
              <p className="text-2xl font-bold text-gray-900">{data.won_deals}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Deals finalisés</p>
              <p className="text-2xl font-bold text-gray-900">{data.completed_deals}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Évaluations</p>
              <p className="text-2xl font-bold text-gray-900">{data.review_count}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Historique des deals remportés</h2>
        {!data.history?.length ? (
          <p className="text-sm text-gray-500 italic py-4">
            Aucun deal remporté pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.history.map(h => (
              <li key={h.deal_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {PROPERTY_TYPE_LABELS[h.property_type] || h.property_type} · {h.city}
                    </p>
                    <p className="text-xs text-gray-500">
                      {h.date ? new Date(h.date).toLocaleDateString('fr-CA') : '—'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                  {STATUS_LABEL[h.status] || h.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-400 mt-4 italic">
          Les montants des transactions ne sont pas affichés publiquement.
        </p>
      </div>
    </div>
  )
}
