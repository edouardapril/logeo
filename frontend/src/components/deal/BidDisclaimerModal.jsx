import { useState, useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import Modal from '../ui/Modal'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

const CONSENTS = [
  {
    key: 'consent_documentation',
    label: "J'ai consulté l'ensemble de la documentation disponible (photos, baux, déclaration vendeur, analyse Logeo, certificat de localisation).",
  },
  {
    key: 'consent_questions_visit',
    label: "J'ai eu l'opportunité de poser mes questions au courtier et d'effectuer une visite si souhaité.",
  },
  {
    key: 'consent_firm_offer',
    label: "Je comprends que mon enchère est ferme et irrévocable.",
  },
  {
    key: 'consent_fees_and_deposit',
    label: "Je m'engage à payer les frais Logeo de 1 % du prix final, payables à la signature de la promesse d'achat (PA) par virement Interac. Aucun débit automatique avant la PA.",
  },
]

export default function BidDisclaimerModal({
  open, onClose, amount, onConfirm, isSubmitting,
}) {
  const [consents, setConsents] = useState({
    consent_documentation: false,
    consent_questions_visit: false,
    consent_firm_offer: false,
    consent_fees_and_deposit: false,
  })

  const allChecked = useMemo(
    () => CONSENTS.every(c => consents[c.key]),
    [consents],
  )

  const toggle = (key) => setConsents(prev => ({ ...prev, [key]: !prev[key] }))

  const submit = () => {
    if (!allChecked || !amount) return
    onConfirm(consents)
  }

  const numericAmount = parseInt(amount) || 0
  const estimatedFee = Math.round(numericAmount * 0.01)

  return (
    <Modal open={open} onClose={onClose} title="Décharge — confirmer mon enchère" size="lg">
      <div className="space-y-4 text-sm text-gray-700">
        <div className="rounded-lg bg-[#FFEDD5] border border-[#FDBA74] p-4">
          <p className="font-semibold text-[#9A3412] mb-1">
            Montant de votre offre maximale : {numericAmount ? formatMoney(numericAmount) : '—'}
          </p>
          <p className="text-xs text-[#9A3412]/80">
            Si gagnante : frais Logeo de <strong>{formatMoney(estimatedFee)}</strong> (1 %)
            payables à la signature de la PA par virement Interac. Aucun débit avant.
          </p>
        </div>

        <p className="font-medium text-gray-900">
          Avant de placer votre enchère, vous confirmez :
        </p>

        <ul className="space-y-3">
          {CONSENTS.map(c => (
            <li key={c.key}>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 border border-gray-200">
                <input
                  type="checkbox"
                  checked={consents[c.key]}
                  onChange={() => toggle(c.key)}
                  className="mt-0.5 rounded border-gray-300 text-[#EA580C] focus:ring-[#EA580C]"
                />
                <span className="text-sm leading-relaxed text-gray-700">{c.label}</span>
              </label>
            </li>
          ))}
        </ul>

        <p className="text-xs text-gray-500 italic">
          Votre adresse IP et l'horodatage sont enregistrés au moment de la signature, à titre de preuve légale (Loi 25 du Québec).
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button
            onClick={submit}
            disabled={!allChecked || isSubmitting || !numericAmount}
            className="btn-primary"
          >
            <ShieldCheck className="h-4 w-4" />
            {isSubmitting ? 'Envoi...' : 'Signer et enchérir →'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
