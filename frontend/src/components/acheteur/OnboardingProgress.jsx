import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Check, Clock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { onboardingStatusApi } from '../../api/acheteur'

const STEP_CTA = {
  verify_email:        { to: '/profil',                    label: 'Vérifier' },
  qualified:           { to: null,                          label: 'En attente' },
  has_card:            { to: '/acheteur/paiement',          label: 'Ajouter une carte' },
  nda_signed:          { to: null,                          label: 'Sur la page du deal' },
  engagement_signed:   { to: null,                          label: 'Sur la page du deal' },
}

/**
 * Barre de progression du parcours acheteur.
 * Affichée en haut des pages acheteur. Les étapes done sont vertes, l'étape courante orange pulsante.
 *
 *  Props:
 *    dealId (optional) : ajoute les étapes per-deal (NDA + engagement)
 *    compact (bool)     : version réduite (utile en haut de la page deal)
 */
export default function OnboardingProgress({ dealId = null, compact = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', dealId || 'global'],
    queryFn: () => onboardingStatusApi(dealId),
    refetchInterval: 60_000,
  })

  if (isLoading || !data) return null
  if (data.ready_to_bid) {
    // Pas besoin d'afficher la barre — l'utilisateur est prêt
    return compact ? (
      <div className="card p-3 mb-4 bg-emerald-50 border-emerald-200 flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <p className="text-emerald-900 font-medium">Vous êtes prêt à enchérir.</p>
      </div>
    ) : null
  }

  const cur = data.current_step_index
  const total = data.steps.length

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-900">
          Étape {cur + 1}/{total} —{' '}
          <span className="text-[#C2410C]">{data.steps[cur]?.label}</span>
        </p>
        <span className="text-xs text-gray-500">
          {data.blocking_message || 'En attente...'}
        </span>
      </div>

      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {data.steps.map((s, i) => {
          const isCurrent = i === cur
          const isDone = s.done
          return (
            <li key={s.key} className="flex flex-col items-center text-center">
              <span className={`
                h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-inset
                ${isDone     ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : ''}
                ${isCurrent  ? 'bg-[#FFEDD5] text-[#C2410C] ring-[#FDBA74] animate-pulse' : ''}
                ${!isDone && !isCurrent ? 'bg-gray-100 text-gray-400 ring-gray-200' : ''}
              `}>
                {isDone ? <Check className="h-4 w-4" /> : (i + 1)}
              </span>
              <span className={`mt-1 text-[11px] font-medium leading-tight ${
                isDone ? 'text-emerald-700' :
                isCurrent ? 'text-[#C2410C]' :
                'text-gray-400'
              }`}>
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Hint + CTA pour l'étape courante */}
      {data.steps[cur] && (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-sm">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Clock className="h-4 w-4 text-[#C2410C] flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">
              {data.steps[cur].helper || 'Étape en cours...'}
            </span>
          </div>
          {STEP_CTA[data.steps[cur].key]?.to && (
            <Link
              to={STEP_CTA[data.steps[cur].key].to}
              className="btn-primary text-xs whitespace-nowrap"
            >
              {STEP_CTA[data.steps[cur].key].label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
