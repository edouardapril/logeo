import { Lock, Camera, MapPin, FileText, Users, CheckCircle2 } from 'lucide-react'

/**
 * Grille « Détails propriété » — 4 cards pour Photos HD / Adresse exacte /
 * Baux & déclaration / Coordonnées courtier. Chaque card est verrouillée
 * (icône cadenas + flou) ou débloquée selon `permissions`.
 *
 * Visuel emprunté à DealPublic (LockedBlock) — appliqué partout pour homogénéité.
 */

function FeatureCard({ icon: Icon, title, hint, locked, lockedHint }) {
  if (locked) {
    return (
      <div className="card p-5 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 opacity-60"
          style={{ filter: 'blur(8px)' }}
        />
        <div className="relative flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
            <Lock className="h-5 w-5 text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 flex items-center gap-2">
              <Icon className="h-4 w-4 text-gray-400" />
              {title}
            </p>
            {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
            <p className="text-xs italic text-gray-500 mt-2">
              {lockedHint || 'Accès après signature du NDA'}
            </p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="card p-5 bg-emerald-50/30 border-emerald-200">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-500" />
            {title}
          </p>
          {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
          <p className="text-xs text-emerald-700 font-medium mt-2">Débloqué</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Props :
 *   - permissions : { canSeePhotos, canSeeAddress, canSeeDocuments, canSeeCourtier }
 *   - lockedHint : phrase personnalisée (ex: « Accès après signature NDA » /
 *     « Réservé au propriétaire » / « Réservé à l'admin »)
 */
export default function LockedFeatureGrid({ permissions = {}, lockedHint }) {
  const {
    canSeePhotos = false,
    canSeeAddress = false,
    canSeeDocuments = false,
    canSeeCourtier = false,
  } = permissions
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FeatureCard
        icon={Camera}
        title="Photos haute résolution"
        hint="Intérieur, extérieur, logements, parties communes."
        locked={!canSeePhotos}
        lockedHint={lockedHint}
      />
      <FeatureCard
        icon={MapPin}
        title="Adresse exacte"
        hint="Numéro civique et rue."
        locked={!canSeeAddress}
        lockedHint={lockedHint}
      />
      <FeatureCard
        icon={FileText}
        title="Baux et déclaration vendeur"
        hint="Documents légaux complets — revenus locatifs détaillés par logement."
        locked={!canSeeDocuments}
        lockedHint={lockedHint}
      />
      <FeatureCard
        icon={Users}
        title="Coordonnées du courtier"
        hint="Contact direct pour la due diligence."
        locked={!canSeeCourtier}
        lockedHint={lockedHint}
      />
    </div>
  )
}
