import { CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react'

/**
 * Barre de progression du deal côté courtier propriétaire.
 *
 * Étapes : Soumis → Approuvé → Enchères ouvertes → Acheteur trouvé → PA signée.
 * État dérivé du `deal.status` :
 *   - draft, analyse  : 1 fait, 2 en cours
 *   - bid             : 2 faits, 3 en cours
 *   - intro           : 3 faits, 4 fait, 5 en cours
 *   - pa_signed       : tous faits
 *   - nogo            : refusé (état terminal alternatif)
 *   - auction_ended   : enchère close sans gagnant (état alternatif)
 */

const STEPS = [
  { key: 'submitted', label: 'Soumis' },
  { key: 'approved',  label: 'Approuvé' },
  { key: 'bidding',   label: 'Enchères ouvertes' },
  { key: 'winner',    label: 'Acheteur trouvé' },
  { key: 'closed',    label: 'PA signée' },
]

function statusToProgress(status) {
  switch (status) {
    case 'draft': case 'analyse':
      return { doneIdx: 0, currentIdx: 1, terminal: null }
    case 'bid':
      return { doneIdx: 2, currentIdx: 2, terminal: null }
    case 'intro':
      return { doneIdx: 3, currentIdx: 4, terminal: null }
    case 'pa_signed':
      return { doneIdx: 4, currentIdx: 5, terminal: 'success' }
    case 'nogo':
      return { doneIdx: 0, currentIdx: 1, terminal: 'nogo' }
    case 'auction_ended':
      return { doneIdx: 2, currentIdx: 3, terminal: 'ended' }
    default:
      return { doneIdx: 0, currentIdx: 0, terminal: null }
  }
}

export default function CourtierDealProgress({ deal }) {
  if (!deal?.status) return null
  const { doneIdx, currentIdx, terminal } = statusToProgress(deal.status)

  return (
    <div className="card p-4 mb-6 bg-white border-gray-200">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
        Statut de mon deal
      </p>
      <ol className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = i < doneIdx
          const current = i === currentIdx
          const Icon = done ? CheckCircle2 : current ? Clock : Circle
          const color = done
            ? 'text-emerald-600'
            : current
              ? 'text-[#EA580C]'
              : 'text-gray-300'
          return (
            <li key={s.key} className="flex items-center gap-1.5 flex-shrink-0">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className={`text-xs font-medium whitespace-nowrap ${
                done ? 'text-emerald-700' : current ? 'text-[#C2410C]' : 'text-gray-400'
              }`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className={`mx-1 h-px w-6 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
            </li>
          )
        })}
      </ol>
      {terminal === 'nogo' && (
        <div className="mt-3 inline-flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          Deal refusé par l'admin {deal.nogo_reason ? `· ${deal.nogo_reason}` : ''}
        </div>
      )}
      {terminal === 'ended' && (
        <p className="mt-3 text-xs text-gray-700">
          Enchère terminée sans gagnant. Vous pouvez relancer une nouvelle ronde
          depuis cette page.
        </p>
      )}
      {terminal === 'success' && (
        <p className="mt-3 text-xs text-emerald-700">
          Promesse d'achat signée — commission Logeo en attente de paiement final.
        </p>
      )}
    </div>
  )
}
