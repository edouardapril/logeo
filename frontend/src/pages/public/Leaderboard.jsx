import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Building2, Users } from 'lucide-react'
import { leaderboardApi } from '../../api/public'
import RatingStars from '../../components/ui/RatingStars'
import Spinner from '../../components/ui/Spinner'
import { fileUrl } from '../../utils/url'

function PodiumRow({ idx, link, photo, title, subtitle, stats, rating }) {
  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
  return (
    <li className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-[#FDBA74] hover:bg-[#FFEDD5]/30 transition-colors">
      <span className="w-8 text-center text-lg font-bold text-gray-500">
        {medal || `#${idx + 1}`}
      </span>
      {photo ? (
        <img src={fileUrl(photo)} alt={title} className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center font-bold">
          {(title || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {link ? (
          <Link to={link} className="font-semibold text-gray-900 hover:text-[#EA580C]">{title}</Link>
        ) : (
          <p className="font-semibold text-gray-900">{title}</p>
        )}
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{stats}</p>
        {rating?.average_rating != null && (
          <div className="mt-1">
            <RatingStars
              value={rating.average_rating}
              count={rating.review_count}
              showNumber size="sm" readonly
            />
          </div>
        )}
      </div>
    </li>
  )
}

export default function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['public', 'leaderboard'],
    queryFn: () => leaderboardApi(10),
    refetchInterval: 60_000,
  })

  if (isLoading) return <Spinner label="Chargement du classement..." />

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Trophy className="h-7 w-7 text-amber-500" />
          Leaderboard Logeo
        </h1>
        <p className="text-sm text-gray-600">
          Top contributeurs par nombre de deals complétés. Mis à jour automatiquement.
          Aucun montant n'est exposé — uniquement les nombres et notes moyennes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-[#C2410C]" />
            Top acheteurs
          </h2>
          {!data?.acheteurs?.length ? (
            <p className="text-sm text-gray-500 italic py-8 text-center">
              Aucun deal complété pour le moment.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.acheteurs.map((a, i) => (
                <PodiumRow
                  key={a.id}
                  idx={i}
                  link={`/acheteur/${a.id}`}
                  photo={a.profile_photo_path}
                  title={a.full_name}
                  subtitle={`${a.completed_deals} deal${a.completed_deals > 1 ? 's' : ''} complété${a.completed_deals > 1 ? 's' : ''}`}
                  stats={`${a.completed_deals}`}
                  rating={a}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#C2410C]" />
            Top courtiers
          </h2>
          {!data?.courtiers?.length ? (
            <p className="text-sm text-gray-500 italic py-8 text-center">
              Aucun courtier classé pour le moment.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.courtiers.map((c, i) => (
                <PodiumRow
                  key={c.id}
                  idx={i}
                  photo={c.profile_photo_path}
                  title={c.full_name}
                  subtitle={c.agency_name || `${c.published_deals} publié${c.published_deals > 1 ? 's' : ''}`}
                  stats={`${c.completed_deals}/${c.published_deals}`}
                  rating={c}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        Données publiques anonymisées. Les montants des deals ne sont jamais affichés.
      </p>
    </div>
  )
}
