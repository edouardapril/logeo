import { ScrollText, ShieldCheck } from 'lucide-react'

const COMMON_CLAUSES = [
  {
    key: 'tos_cgu',
    label: "J'ai lu et j'accepte les Conditions générales d'utilisation (CGU) de Logeo.",
  },
  {
    key: 'tos_privacy',
    label: "J'ai lu la politique de confidentialité (Loi 25 du Québec) et j'autorise le traitement de mes données.",
  },
  {
    key: 'tos_canadian_resident',
    label: 'Je confirme être résident canadien.',
  },
]

const ACHETEUR_CLAUSE = {
  key: 'tos_qualified_investor',
  label: "Je confirme être un investisseur qualifié au sens de Logeo (revenu, actifs ou expérience d'investissement immobilier).",
}

const TOS_TEXT = `LOGEO — CONDITIONS GÉNÉRALES D'UTILISATION (résumé)

1. Qui peut utiliser Logeo
   - Courtiers immobiliers détenant un permis OACIQ valide.
   - Acheteurs investisseurs qualifiés (résidents canadiens).

2. Types de propriétés acceptées
   - Multilogement (2-6, 7-24, 24+ logements)
   - Projets multifamiliaux et terrains constructibles à plex
   - Aucun résidentiel unifamilial / condo personnel

3. Règles des enchères
   - Prix plancher fixé par le courtier, public, contraignant pour le vendeur
   - Incrément minimum 10 000 $ CAD
   - Anti-snipe : timer prolongé +10 min si bid <10 min de la fin
   - Bids fermes et irrévocables

4. Politique de paiement
   - Frais Logeo : 1 % du prix gagnant
   - Dépôt 25 % débité automatiquement à la fermeture (min 2 500 $)
   - Solde 75 % débité après confirmation due diligence
   - Désistement = perte du dépôt 25 %

5. Responsabilité limitée
   - Logeo est intermédiaire ; ne garantit pas l'état des propriétés
   - Acheteurs effectuent leur propre due diligence
   - Loi 25 du Québec — protection des renseignements personnels appliquée

6. Loi applicable
   - Province de Québec, Canada
   - Différends résolus selon la législation québécoise`


/**
 * Bloc Conditions d'utilisation utilisé sur les pages d'inscription (acheteur/courtier).
 * Affiche un résumé scrollable + 3 ou 4 cases obligatoires.
 *
 * Props:
 *   role: 'acheteur' | 'courtier'
 *   value: { tos_cgu, tos_privacy, tos_canadian_resident, tos_qualified_investor? }
 *   onChange: (next) => void
 */
export default function TermsConsent({ role, value, onChange }) {
  const clauses = role === 'acheteur'
    ? [...COMMON_CLAUSES, ACHETEUR_CLAUSE]
    : COMMON_CLAUSES

  const toggle = (key) => onChange?.({ ...value, [key]: !value?.[key] })

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-56 overflow-y-auto text-xs text-gray-700 whitespace-pre-line">
        <p className="font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
          <ScrollText className="h-3.5 w-3.5" /> Résumé
        </p>
        {TOS_TEXT}
      </div>

      <ul className="space-y-2">
        {clauses.map(c => (
          <li key={c.key}>
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:border-[#FDBA74]">
              <input
                type="checkbox"
                checked={!!value?.[c.key]}
                onChange={() => toggle(c.key)}
                className="mt-0.5 rounded border-gray-300 text-[#EA580C] focus:ring-[#EA580C]"
              />
              <span className="text-sm text-gray-700 leading-snug">{c.label}</span>
            </label>
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-500 italic flex items-start gap-1.5">
        <ShieldCheck className="h-3 w-3 flex-shrink-0 mt-0.5" />
        Votre IP et l'horodatage de l'acceptation sont enregistrés à titre de preuve légale (Loi 25).
      </p>
    </div>
  )
}

export function allTermsAccepted(role, value) {
  if (!value) return false
  const required = role === 'acheteur'
    ? ['tos_cgu', 'tos_privacy', 'tos_canadian_resident', 'tos_qualified_investor']
    : ['tos_cgu', 'tos_privacy', 'tos_canadian_resident']
  return required.every(k => value[k])
}
