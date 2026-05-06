import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, Users, Lock, ArrowRight } from 'lucide-react'
import { publicMarketplaceApi } from '../../api/public'
import Spinner from '../../components/ui/Spinner'
import CountdownBoxes from '../../components/ui/CountdownBoxes'
import QuebecLocationPicker from '../../components/ui/QuebecLocationPicker'
import { fileUrl } from '../../utils/url'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel, mrcLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

function PublicDealCard({ d }) {
  return (
    <div className="card overflow-hidden hover:shadow-md hover:border-[#FDBA74] transition-all duration-200 group">
      {d.teaser_photo_path && (
        <div className="h-44 overflow-hidden bg-gray-100 relative">
          <img
            src={fileUrl(d.teaser_photo_path)}
            alt={d.city}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <p className="text-xs text-gray-500">
              {PROPERTY_TYPE_LABELS[d.property_type] || d.property_type}
              {d.num_units ? ` · ${d.num_units} log.` : ''}
            </p>
            <p className="font-semibold text-gray-900 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {d.city}
              {d.region && <span className="text-xs text-gray-400 font-normal">· {regionLabel(d.region)}</span>}
            </p>
          </div>
          <CountdownBoxes closeAt={d.bid_close_at} size="compact" />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
          {d.floor_price != null && (
            <div>
              <dt className="text-xs text-gray-500">Prix plancher</dt>
              <dd className="font-semibold text-gray-700">{formatMoney(d.floor_price)}</dd>
            </div>
          )}
          {d.displayed_price != null && (
            <div>
              <dt className="text-xs text-gray-500">Prix affiché</dt>
              <dd className="font-bold text-[#9A3412]">{formatMoney(d.displayed_price)}</dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {d.bidders_count} {d.bidders_count > 1 ? 'acheteurs' : 'acheteur'}
          </span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 link-brand font-medium"
            title="Connectez-vous pour signer le NDA et accéder au dossier complet"
          >
            <Lock className="h-3 w-3" /> Voir le dossier
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Marketplace() {
  const [filters, setFilters] = useState({ region: '', mrc: '', city: '' })

  const { data: deals, isLoading } = useQuery({
    queryKey: ['marketplace', filters.region, filters.mrc, filters.city],
    queryFn: () => publicMarketplaceApi({
      region: filters.region || undefined,
      mrc: filters.mrc || undefined,
      city: filters.city || undefined,
    }),
    refetchInterval: 30_000,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Enchères en cours</h1>
        <p className="text-sm text-gray-600">
          Multilogements, projets et terrains à plex partout au Québec.
          Pour participer aux enchères : inscription gratuite et qualification.
        </p>
      </div>

      {/* Filtres MRC/villes */}
      <div className="card p-5 mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">Filtrer</p>
        <QuebecLocationPicker
          value={filters}
          onChange={setFilters}
        />
        {(filters.region || filters.mrc || filters.city) && (
          <button
            onClick={() => setFilters({ region: '', mrc: '', city: '' })}
            className="mt-3 text-xs link-brand font-medium"
          >
            ↺ Réinitialiser les filtres
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner label="Chargement des enchères..." />
      ) : !deals?.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Aucune enchère pour ces critères</h3>
          <p className="text-sm text-gray-500 mb-4">
            Essayez d'élargir la recherche ou {' '}
            <Link to="/register/acheteur" className="link-brand font-medium">inscrivez-vous</Link>
            {' '}pour être notifié des nouveaux deals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map(d => <PublicDealCard key={d.id} d={d} />)}
        </div>
      )}

      <div className="mt-12 card p-6 bg-[#FFEDD5] border-[#FDBA74] text-center">
        <h2 className="font-bold text-[#9A3412] mb-2">Envie d'enchérir ?</h2>
        <p className="text-sm text-[#9A3412]/80 mb-4">
          Inscrivez-vous comme acheteur qualifié. Qualification sous 24h.
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <Link to="/register/acheteur" className="btn-primary">
            S'inscrire <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/login" className="btn-secondary">Se connecter</Link>
        </div>
      </div>
    </div>
  )
}
