import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Trophy, MapPin, Building, FileText, Lock,
  Phone, Mail, CheckCircle2, Receipt, ArrowRight, AlertTriangle, Hourglass,
} from 'lucide-react'
import TutorialOverlay from './TutorialOverlay'
import { ACHETEUR_EMAILS } from '../../utils/walkthroughEmailTemplates'

// LOTPLOT 23 — Flow Acheteur du walkthrough.
//
// Architecture :
// - `STEPS` array de définitions (id + label pour ProgressTracker).
// - Chaque step pilote :
//     1) le rendu courant (mock UI dans `<StepUI>`),
//     2) le tooltip (target selector + texte + position),
//     3) les actions qui font avancer (clic bouton, ou Suivant).
// - State driver : props `state` + `onPatch(patch)` + `onPushEmail(email)`.
// Tous les boutons d'action dans la mock UI sont tagués avec un id stable
// (`id="walkthrough-..."`) que TutorialOverlay cible via querySelector.

export const ACHETEUR_STEPS = [
  { id: 'intro',         label: 'Bienvenue' },
  { id: 'teaser',        label: 'Teaser anonyme' },
  { id: 'sign_nda',      label: 'Signer le NDA' },
  { id: 'nda_modal',     label: 'Clauses NDA' },
  { id: 'access_dossier',label: 'Dossier complet' },
  { id: 'place_bid',     label: 'Faire une offre' },
  { id: 'bid_modal',     label: 'Mise privée' },
  { id: 'outbid',        label: 'Surenchérir' },
  { id: 'auction_close', label: 'Fermeture' },
  { id: 'post_win',      label: 'Due diligence' },
  { id: 'awaiting_pa',   label: 'PA en cours' },
  { id: 'payment',       label: 'Paiement Interac' },
  { id: 'completed',     label: 'Terminé' },
]

export default function AcheteurFlow({ state, onPatch, onPushEmail }) {
  const stepIndex = ACHETEUR_STEPS.findIndex(s => s.id === state.step_id)
  const currentStep = ACHETEUR_STEPS[stepIndex] || ACHETEUR_STEPS[0]

  const goNext = () => {
    const nextIdx = Math.min(stepIndex + 1, ACHETEUR_STEPS.length - 1)
    onPatch({ step_id: ACHETEUR_STEPS[nextIdx].id, step_index: nextIdx })
  }

  const goTo = (id) => {
    const idx = ACHETEUR_STEPS.findIndex(s => s.id === id)
    if (idx < 0) return
    onPatch({ step_id: id, step_index: idx })
  }

  // ── Tooltip config par step ────────────────────────────────────────────────
  const tooltipForStep = {
    intro: {
      target: '#walkthrough-acheteur-root',
      pos: 'bottom',
      text: "Bienvenue. Vous allez explorer Logeo dans la peau d'un acheteur. Nous avons un deal disponible — un multilogement à Saint-Constant. Cliquez sur « Suivant » pour découvrir le teaser.",
      showNext: true,
    },
    teaser: {
      target: '#walkthrough-teaser-card',
      pos: 'right',
      text: "Voici le teaser public. L'adresse exacte et l'identité du courtier sont confidentielles à ce stade. Pour accéder au dossier complet, vous devez signer un NDA.",
      showNext: true,
    },
    sign_nda: {
      target: '#walkthrough-sign-nda-btn',
      pos: 'top',
      text: 'Cliquez ici pour signer le NDA et débloquer le dossier complet.',
      showNext: false,
    },
    nda_modal: {
      target: '#walkthrough-nda-confirm-btn',
      pos: 'top',
      text: 'Le NDA est légalement contraignant. Cochez les clauses pour confirmer votre engagement de confidentialité et de non-contournement, puis signez.',
      showNext: false,
    },
    access_dossier: {
      target: '#walkthrough-full-dossier',
      pos: 'top',
      text: "Vous accédez maintenant au dossier complet : adresse exacte, courtier, photos privées, baux, analyse Logeo. Vous pouvez aussi poser des questions ou demander une visite.",
      showNext: true,
    },
    place_bid: {
      target: '#walkthrough-place-bid-btn',
      pos: 'top',
      text: "Logeo utilise un proxy bidding privé : vous indiquez votre maximum, le prix affiché ne monte que par tranches de 5 000 $ pour vous maintenir leader. Cliquez pour bidder.",
      showNext: false,
    },
    bid_modal: {
      target: '#walkthrough-bid-confirm-btn',
      pos: 'top',
      text: "Votre maximum reste privé — seul le prix calculé est public. Pour la démo, on a pré-rempli 850 000 $. Validez pour placer l'offre.",
      showNext: false,
    },
    outbid: {
      target: '#walkthrough-counter-bid-btn',
      pos: 'top',
      text: 'Un autre acheteur vient de surenchérir. Cliquez pour augmenter votre maximum à 950 000 $ et reprendre la tête.',
      showNext: false,
    },
    auction_close: {
      target: '#walkthrough-auction-close',
      pos: 'top',
      text: "L'enchère se ferme — vous remportez le deal au prix calculé. Le timer anti-snipe Logeo a déjà été géré pour vous.",
      showNext: true,
    },
    post_win: {
      target: '#walkthrough-dd-confirm-btn',
      pos: 'top',
      text: "Vous avez 5 jours pour finaliser votre due diligence (inspection, financement, vérifications). Cliquez pour confirmer la procédure.",
      showNext: false,
    },
    awaiting_pa: {
      target: '#walkthrough-pa-signed-btn',
      pos: 'top',
      text: "La PA est rédigée et signée hors plateforme entre vous et le courtier. Logeo n'intervient pas. Simulez la signature pour la démo.",
      showNext: false,
    },
    payment: {
      target: '#walkthrough-paid-btn',
      pos: 'top',
      text: 'Vous recevez les instructions Interac : montant, destinataire, référence. Effectuez le virement pour finaliser.',
      showNext: false,
    },
    completed: {
      target: '#walkthrough-completed',
      pos: 'top',
      text: "Bravo ! Vous avez complété tout le parcours. Sur la vraie plateforme, c'est exactement comme ça que ça se passe.",
      showNext: false,
    },
  }
  const tip = tooltipForStep[state.step_id] || tooltipForStep.intro

  return (
    <div id="walkthrough-acheteur-root" className="space-y-6 max-w-3xl">
      <StepUI
        state={state}
        onPatch={onPatch}
        onPushEmail={onPushEmail}
        goNext={goNext}
        goTo={goTo}
      />
      <TutorialOverlay
        targetSelector={tip.target}
        tooltipText={tip.text}
        tooltipPosition={tip.pos}
        showNextButton={tip.showNext}
        onNext={goNext}
        step={{ index: stepIndex, total: ACHETEUR_STEPS.length }}
      />
    </div>
  )
}

// ── Mock UI par step ─────────────────────────────────────────────────────────

function StepUI({ state, onPatch, onPushEmail, goNext, goTo }) {
  const { step_id } = state

  // Modaux NDA / bid : gérés par state local du composant
  const [ndaModalOpen, setNdaModalOpen] = useState(false)
  const [bidModalOpen, setBidModalOpen] = useState(false)
  const [ndaConsents, setNdaConsents] = useState({ a: false, b: false, c: false, d: false })
  const [bidAmount, setBidAmount] = useState('')

  // Auto-effets : ouvrir modales quand le step l'exige
  useEffect(() => {
    setNdaModalOpen(step_id === 'nda_modal')
    setBidModalOpen(step_id === 'bid_modal')
    if (step_id === 'bid_modal') setBidAmount('850000')
  }, [step_id])

  // Auto step "outbid" — quand on arrive sur outbid, on simule le concurrent
  useEffect(() => {
    if (step_id !== 'outbid') return
    const t = setTimeout(() => {
      toast(`⚡ Un autre acheteur a surenchéri — vous êtes en 2ᵉ position.`, { icon: '⚠️' })
      onPushEmail(ACHETEUR_EMAILS.outbid)
    }, 600)
    return () => clearTimeout(t)
  }, [step_id, onPushEmail])

  // ─ Affichage du dossier (variantes selon le step) ───────────────────────────
  // Avant signature NDA : teaser anonyme. Après : dossier complet.
  const ndaSigned = ['access_dossier', 'place_bid', 'bid_modal', 'outbid', 'auction_close',
    'post_win', 'awaiting_pa', 'payment', 'completed'].includes(step_id)

  return (
    <>
      <div className="space-y-6">
        <DealHeader state={state} ndaSigned={ndaSigned} />
        {ndaSigned ? (
          <FullDossier id="walkthrough-full-dossier" state={state} />
        ) : (
          <TeaserCard id="walkthrough-teaser-card" />
        )}

        {/* CTA section conditionnée par le step */}
        {step_id === 'teaser' && (
          <button
            id="walkthrough-sign-nda-btn"
            onClick={() => goTo('nda_modal')}
            className="btn-primary w-full md:w-auto"
          >
            <ShieldCheck className="h-4 w-4" /> Signer le NDA pour accéder au dossier
          </button>
        )}

        {step_id === 'sign_nda' && (
          <button
            id="walkthrough-sign-nda-btn"
            onClick={() => goTo('nda_modal')}
            className="btn-primary w-full md:w-auto"
          >
            <ShieldCheck className="h-4 w-4" /> Signer le NDA
          </button>
        )}

        {(step_id === 'access_dossier' || step_id === 'place_bid') && (
          <div className="card p-5 bg-[#FFF7ED] border-[#FDBA74]">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-[#EA580C]" /> Soumettre une offre
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Prix actuel : <strong>{formatMoney(state.current_price)}</strong> ·
              Plancher : <strong>800 000 $</strong> · Incrément 5 000 $.
            </p>
            <button
              id="walkthrough-place-bid-btn"
              onClick={() => goTo('bid_modal')}
              className="btn-primary"
              disabled={step_id !== 'place_bid'}
            >
              <Trophy className="h-4 w-4" /> Faire une offre
            </button>
          </div>
        )}

        {step_id === 'outbid' && (
          <div className="card p-5 bg-red-50 border-red-200">
            <p className="text-sm text-red-900 font-semibold mb-1">
              ⚡ Vous avez été dépassé · prix actuel {formatMoney(state.current_price)}
            </p>
            <p className="text-xs text-red-800 mb-3">
              Un concurrent a surenchéri. Vous pouvez augmenter votre maximum pour reprendre la tête.
            </p>
            <button
              id="walkthrough-counter-bid-btn"
              onClick={() => {
                onPatch({
                  user_max_bid: 950000,
                  current_price: 925000,
                  ranking_position: 1,
                })
                onPushEmail(ACHETEUR_EMAILS.bid_placed)
                toast.success('Offre relevée — vous êtes de nouveau en tête.')
                goTo('auction_close')
              }}
              className="btn-primary"
            >
              <ArrowRight className="h-4 w-4" /> Relever à 950 000 $
            </button>
          </div>
        )}

        {step_id === 'auction_close' && (
          <div id="walkthrough-auction-close" className="card p-5 bg-emerald-50 border-emerald-200">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5" /> L'enchère est fermée — vous avez gagné !
            </h3>
            <p className="text-sm text-emerald-800">
              Prix final : <strong>920 000 $</strong> · Frais Logeo (1 %) :
              <strong> 9 200 $</strong> payables à la signature de la PA.
            </p>
            <button
              onClick={() => {
                onPushEmail(ACHETEUR_EMAILS.won)
                goNext()
              }}
              className="btn-primary mt-3"
            >
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step_id === 'post_win' && (
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <Hourglass className="h-4 w-4 text-[#C2410C]" /> Due diligence — 5 jours
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Profitez de cette fenêtre pour finaliser inspection, financement et vérifications.
              À l'issue, confirmez la procédure ou retirez-vous sans pénalité.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                id="walkthrough-dd-confirm-btn"
                onClick={() => {
                  onPushEmail(ACHETEUR_EMAILS.dd_confirmed)
                  toast.success('Due diligence confirmée — en attente de la PA')
                  goNext()
                }}
                className="btn-primary"
              >
                Confirmer la procédure → PA
              </button>
              <button
                onClick={() => {
                  toast('Vous vous êtes retiré — démo terminée. Recommencez pour explorer le flow gagnant.', { icon: '↩️' })
                }}
                className="btn-secondary"
              >
                Me retirer (DD négative)
              </button>
            </div>
          </div>
        )}

        {step_id === 'awaiting_pa' && (
          <div className="card p-5 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-900 mb-2">
              <strong>Procédure confirmée</strong> — la PA est en cours de rédaction et signature
              hors plateforme entre vous et le courtier.
            </p>
            <p className="text-xs text-amber-800 mb-3">
              <em>Pour la démo</em> : simulez la signature de la PA.
            </p>
            <button
              id="walkthrough-pa-signed-btn"
              onClick={() => {
                onPushEmail(ACHETEUR_EMAILS.interac_instructions)
                goNext()
              }}
              className="btn-primary"
            >
              Simuler : la PA a été signée
            </button>
          </div>
        )}

        {step_id === 'payment' && (
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#C2410C]" /> Instructions Interac
            </h3>
            <ul className="text-sm text-gray-700 space-y-1 mb-3">
              <li><strong>Montant :</strong> 9 200 $ CAD</li>
              <li><strong>Destinataire :</strong> paiements@logeo.ca</li>
              <li><strong>Référence :</strong> LOGEO-EXEMPLE</li>
            </ul>
            <button
              id="walkthrough-paid-btn"
              onClick={() => {
                onPushEmail(ACHETEUR_EMAILS.payment_confirmed)
                toast.success('Paiement reçu — deal finalisé.')
                goNext()
              }}
              className="btn-primary"
            >
              Simuler : virement effectué
            </button>
          </div>
        )}

        {step_id === 'completed' && (
          <div id="walkthrough-completed" className="card p-8 bg-gradient-to-br from-emerald-50 to-white border-emerald-200 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Parcours terminé 🎉</h2>
            <p className="text-sm text-gray-700 mb-5 max-w-md mx-auto">
              Sur la vraie plateforme, c'est exactement comme ça que ça se passe.
              Inscrivez-vous pour accéder à de vrais deals off-market au Québec.
            </p>
            {/* LOTPLOT 23B fix #3 : 2 CTAs côte à côte (empilés sur mobile) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link to="/register/acheteur" className="btn-primary w-full sm:w-auto">
                M'inscrire comme acheteur <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/" className="btn-secondary w-full sm:w-auto">
                Retour à l'accueil
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── NDA Modal ── */}
      {ndaModalOpen && (
        <DemoModal title="Accord de non-divulgation (NDA)" onClose={() => setNdaModalOpen(false)}>
          <p className="text-xs text-gray-600 mb-3">
            Cochez les 4 clauses pour signer (preuve légale Loi 25 — IP + horodatage enregistrés).
          </p>
          {[
            { key: 'a', label: 'Confidentialité totale du dossier (adresse, courtier, financiers).' },
            { key: 'b', label: 'Non-contact direct vendeur/courtier hors canal Logeo, 24 mois.' },
            { key: 'c', label: 'Reconnaissance source exclusive Logeo (pénalité 3× les frais en cas de contournement).' },
            { key: 'd', label: 'Non-partage avec tiers sans autorisation écrite.' },
          ].map(c => (
            <label key={c.key} className="block p-2 rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={ndaConsents[c.key]}
                onChange={(e) => setNdaConsents({ ...ndaConsents, [c.key]: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-800">{c.label}</span>
            </label>
          ))}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setNdaModalOpen(false)} className="btn-secondary">Annuler</button>
            <button
              id="walkthrough-nda-confirm-btn"
              disabled={!Object.values(ndaConsents).every(Boolean)}
              onClick={() => {
                setNdaModalOpen(false)
                onPushEmail(ACHETEUR_EMAILS.nda_signed)
                toast.success('NDA signé · accès au dossier complet')
                goTo('access_dossier')
              }}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="h-4 w-4" /> Je signe le NDA
            </button>
          </div>
        </DemoModal>
      )}

      {/* ── Bid Modal ── */}
      {bidModalOpen && (
        <DemoModal title="Faire une offre" onClose={() => setBidModalOpen(false)}>
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 leading-relaxed">
              Entrez votre <strong>offre maximale</strong>. Cette valeur reste <strong>privée</strong>.
              Le prix affiché n'augmentera que si nécessaire pour vous maintenir leader.
            </div>
            <p className="text-xs text-gray-600">
              Prix courant : <strong>{formatMoney(state.current_price)}</strong> · incrément 5 000 $ ·
              frais Logeo 1 % à la PA (Interac).
            </p>
            <input
              type="number"
              step="5000"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setBidModalOpen(false)} className="btn-secondary">Annuler</button>
              <button
                id="walkthrough-bid-confirm-btn"
                onClick={() => {
                  const max = parseInt(bidAmount) || 850000
                  setBidModalOpen(false)
                  onPatch({
                    user_max_bid: max,
                    current_price: 805000,
                    ranking_position: 1,
                  })
                  onPushEmail(ACHETEUR_EMAILS.bid_placed)
                  toast.success(`Offre soumise — vous êtes le meneur (${formatMoney(805000)})`)
                  goTo('outbid')
                }}
                className="btn-primary"
              >
                <Trophy className="h-4 w-4" /> Placer mon offre
              </button>
            </div>
          </div>
        </DemoModal>
      )}
    </>
  )
}

// ── Sous-composants UI ──────────────────────────────────────────────────────

function DealHeader({ state, ndaSigned }) {
  return (
    <div className="card p-5 bg-gradient-to-br from-white via-white to-[#FFEDD5]/40 border-[#FDBA74]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Saint-Constant · Multilogement 6-24 logements
          </h1>
          <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            Montérégie · Roussillon · 8 logements
          </p>
          {ndaSigned && (
            <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-1">
              <MapPin className="h-4 w-4 text-red-500" />
              123 rue Démo, Saint-Constant, QC J5A 0A0
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">Prix actuel</p>
          <p className="text-2xl font-bold text-[#9A3412]">
            {formatMoney(state.current_price)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Plancher 800 000 $</p>
        </div>
      </div>
    </div>
  )
}

function TeaserCard({ id }) {
  return (
    <div id={id} className="card p-6">
      <h2 className="font-semibold text-gray-900 mb-3">Teaser public · accès limité</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div><dt className="text-xs text-gray-500">Type</dt><dd className="font-medium">Multilogement</dd></div>
        <div><dt className="text-xs text-gray-500">Logements</dt><dd className="font-medium">8</dd></div>
        <div><dt className="text-xs text-gray-500">Revenus bruts</dt><dd className="font-medium">96 000 $</dd></div>
        <div><dt className="text-xs text-gray-500">Revenus nets</dt><dd className="font-medium">64 000 $</dd></div>
      </dl>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[Building, MapPin, FileText, Lock].map((Icon, i) => (
          <div key={i} className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center relative overflow-hidden">
            <Icon className="h-6 w-6 text-gray-300" />
            <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center">
              <Lock className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3 italic">
        Adresse exacte, photos haute résolution, baux et coordonnées du courtier débloqués après signature du NDA.
      </p>
    </div>
  )
}

function FullDossier({ id, state }) {
  return (
    <div id={id} className="space-y-4">
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[#C2410C]" /> Données financières
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-gray-500">Prix plancher</dt><dd className="font-bold text-[#C2410C]">800 000 $</dd></div>
          <div><dt className="text-xs text-gray-500">Évaluation municipale</dt><dd className="font-medium">720 000 $</dd></div>
          <div><dt className="text-xs text-gray-500">Revenus bruts</dt><dd className="font-medium">96 000 $</dd></div>
          <div><dt className="text-xs text-gray-500">Revenus nets</dt><dd className="font-medium">64 000 $</dd></div>
          <div><dt className="text-xs text-gray-500">TGA</dt><dd className="font-semibold text-emerald-600">8.0 %</dd></div>
          <div><dt className="text-xs text-gray-500">Année construction</dt><dd className="font-medium">1985</dd></div>
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Building className="h-4 w-4" /> Logements (8)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-2.5">
              <p className="font-semibold">Logement {i + 1}</p>
              <p className="text-gray-500">4½ · 1 050 $/mois</p>
              <p className="text-emerald-700">Loué</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3"><Phone className="h-4 w-4 inline mr-1" /> Courtier</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-gray-500">Nom</dt><dd className="font-medium">Courtier Exemple Logeo</dd></div>
          <div><dt className="text-xs text-gray-500">Agence</dt><dd className="font-medium">Agence Exemple inc.</dd></div>
          <div><dt className="text-xs text-gray-500"><Mail className="h-3 w-3 inline" /> Email</dt><dd className="font-medium">exemple@logeo.demo</dd></div>
          <div><dt className="text-xs text-gray-500"><Phone className="h-3 w-3 inline" /> Téléphone</dt><dd className="font-medium">514-555-0100</dd></div>
        </div>
      </div>
    </div>
  )
}

function DemoModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)
