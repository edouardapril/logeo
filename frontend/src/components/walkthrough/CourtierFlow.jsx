import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText, ShieldCheck, Trophy, MapPin, Upload, CheckCircle2,
  ArrowRight, Loader2, Users, Receipt, Hourglass,
} from 'lucide-react'
import TutorialOverlay from './TutorialOverlay'
import { COURTIER_EMAILS } from '../../utils/walkthroughEmailTemplates'

// LOTPLOT 23 — Flow Courtier du walkthrough.
// Symétrique d'AcheteurFlow : steps + tooltip mapping + mock UI conditionnée
// par le step courant. Animations de groupe (acheteurs qui signent NDA, mises
// qui montent) gérées via setInterval avec cleanup.

export const COURTIER_STEPS = [
  { id: 'intro',           label: 'Bienvenue' },
  { id: 'submit_form',     label: 'Soumission' },
  { id: 'upload_docs',     label: 'Documents' },
  { id: 'submit_action',   label: 'Envoyer' },
  { id: 'analyse',         label: 'Analyse Logeo' },
  { id: 'teaser_published',label: 'Teaser publié' },
  { id: 'ndas_signing',    label: 'NDAs signés' },
  { id: 'bidding',         label: 'Enchères en cours' },
  { id: 'auction_close',   label: 'Fermeture' },
  { id: 'introduction',    label: 'Introduction' },
  { id: 'awaiting_pa',     label: 'PA en cours' },
  { id: 'pa_signed',       label: 'PA signée' },
  { id: 'paid',            label: 'Paiement reçu' },
  { id: 'completed',       label: 'Terminé' },
]

export default function CourtierFlow({ state, onPatch, onPushEmail }) {
  const stepIndex = COURTIER_STEPS.findIndex(s => s.id === state.step_id)

  const goNext = () => {
    const nextIdx = Math.min(stepIndex + 1, COURTIER_STEPS.length - 1)
    onPatch({ step_id: COURTIER_STEPS[nextIdx].id, step_index: nextIdx })
  }
  const goTo = (id) => {
    const idx = COURTIER_STEPS.findIndex(s => s.id === id)
    if (idx < 0) return
    onPatch({ step_id: id, step_index: idx })
  }

  const tooltipForStep = {
    intro: {
      target: '#walkthrough-courtier-root',
      pos: 'bottom',
      text: "Vous allez vivre l'expérience côté courtier. Nous allons soumettre un deal multilogement, le faire valider, voir les acheteurs se positionner et finaliser une vente.",
      showNext: true,
    },
    submit_form: {
      target: '#walkthrough-submit-form',
      pos: 'right',
      text: "Voici le formulaire de soumission. En mode normal, vous le remplissez vous-même. Pour la démo, on a pré-rempli les champs.",
      showNext: true,
    },
    upload_docs: {
      target: '#walkthrough-upload-docs',
      pos: 'right',
      text: "Logeo demande les documents essentiels : baux, taxes, certificat de localisation, déclaration vendeur. Tout est sécurisé et ne sera vu que par Logeo et les acheteurs ayant signé un NDA.",
      showNext: true,
    },
    submit_action: {
      target: '#walkthrough-submit-btn',
      pos: 'top',
      text: 'Cliquez pour soumettre votre deal à Logeo. Verdict GO/NO GO sous 48 h.',
      showNext: false,
    },
    analyse: {
      target: '#walkthrough-analyse',
      pos: 'top',
      text: "Logeo analyse votre dossier — vérification financière, validation marché, évaluation des risques. Patientez quelques secondes…",
      showNext: false,
    },
    teaser_published: {
      target: '#walkthrough-teaser-published',
      pos: 'top',
      text: "Verdict GO ! Votre deal est maintenant publié sur la marketplace. L'adresse et votre identité restent confidentielles jusqu'à ce qu'un acheteur signe un NDA.",
      showNext: true,
    },
    ndas_signing: {
      target: '#walkthrough-ndas-counter',
      pos: 'top',
      text: "Les acheteurs qualifiés découvrent votre deal et signent les NDAs. Logeo vous envoie un résumé d'activité chaque jour.",
      showNext: false,
    },
    bidding: {
      target: '#walkthrough-bids-counter',
      pos: 'top',
      text: "Les enchères se placent en proxy bidding. Le système Logeo gère anti-snipe et incrément automatiquement.",
      showNext: false,
    },
    auction_close: {
      target: '#walkthrough-auction-close',
      pos: 'top',
      text: "L'enchère se ferme. Le gagnant est identifié au prix calculé par le proxy.",
      showNext: true,
    },
    introduction: {
      target: '#walkthrough-introduction',
      pos: 'top',
      text: "Logeo vous met en contact direct avec le gagnant pour préparer la PA. L'acheteur a 5 jours pour finaliser sa due diligence.",
      showNext: true,
    },
    awaiting_pa: {
      target: '#walkthrough-pa-signed-btn',
      pos: 'top',
      text: "Vous rédigez et faites signer la PA hors plateforme, selon vos pratiques habituelles. Logeo n'intervient pas dans cette étape.",
      showNext: false,
    },
    pa_signed: {
      target: '#walkthrough-pa-signed-btn',
      pos: 'top',
      text: 'Une fois la PA signée par les deux parties, vous notifiez Logeo. L\'acheteur reçoit alors les instructions de paiement Interac (1 % du prix final).',
      showNext: false,
    },
    paid: {
      target: '#walkthrough-paid',
      pos: 'top',
      text: "L'acheteur a effectué son virement Interac. Le deal est officiellement finalisé.",
      showNext: true,
    },
    completed: {
      target: '#walkthrough-completed',
      pos: 'top',
      text: "Voilà. Votre deal off-market est conclu en moins de deux semaines. Sur la vraie plateforme, c'est exactement comme ça que ça se passe.",
      showNext: false,
    },
  }
  const tip = tooltipForStep[state.step_id] || tooltipForStep.intro

  return (
    <div id="walkthrough-courtier-root" className="space-y-6 max-w-3xl">
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
        step={{ index: stepIndex, total: COURTIER_STEPS.length }}
      />
    </div>
  )
}

function StepUI({ state, onPatch, onPushEmail, goNext, goTo }) {
  const { step_id } = state

  // ── Animation analyse Logeo (étape 5) ─────────────────────────────────────
  const [analyseStage, setAnalyseStage] = useState(0)
  useEffect(() => {
    if (step_id !== 'analyse') return
    setAnalyseStage(0)
    const stages = ['Vérification financière…', 'Validation marché…', 'Évaluation des risques…', 'Verdict : GO ✓']
    let i = 0
    const interval = setInterval(() => {
      i++
      setAnalyseStage(i)
      if (i >= stages.length) {
        clearInterval(interval)
        onPushEmail(COURTIER_EMAILS.verdict_go)
        toast.success('Verdict GO — votre deal est publié.')
        setTimeout(() => goTo('teaser_published'), 700)
      }
    }, 1500)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step_id])

  // ── Animation NDAs ──
  useEffect(() => {
    if (step_id !== 'ndas_signing') return
    onPatch({ fake_buyers_signed: 0 })
    let n = 0
    const interval = setInterval(() => {
      n++
      onPatch({ fake_buyers_signed: n })
      toast(`Acheteur Anonyme #${n} a signé le NDA`, { duration: 1800, icon: '🔏' })
      if (n >= 5) {
        clearInterval(interval)
        onPushEmail(COURTIER_EMAILS.ndas_summary)
        setTimeout(() => goTo('bidding'), 1200)
      }
    }, 1800)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step_id])

  // ── Animation bids ──
  useEffect(() => {
    if (step_id !== 'bidding') return
    onPatch({ fake_buyers_bidding: 0, current_price: 800000 })
    const prices = [805000, 825000, 850000, 870000, 895000, 920000]
    let i = 0
    const interval = setInterval(() => {
      onPatch({
        fake_buyers_bidding: i + 1,
        current_price: prices[i],
      })
      toast(`Mise placée · prix actuel ${formatMoney(prices[i])}`, { duration: 1500, icon: '💰' })
      i++
      if (i >= prices.length) {
        clearInterval(interval)
        onPushEmail(COURTIER_EMAILS.auction_closed_with_winner)
        setTimeout(() => goTo('auction_close'), 1500)
      }
    }, 1500)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step_id])

  return (
    <div className="space-y-6">
      {step_id === 'intro' && (
        <div className="card p-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
            Bienvenue dans le parcours courtier
          </h1>
          <p className="text-sm text-gray-700">
            Nous allons soumettre un deal off-market à Saint-Constant, le faire valider par
            Logeo, voir les acheteurs s'intéresser et finaliser une vente. Cliquez sur
            « Suivant » pour démarrer.
          </p>
        </div>
      )}

      {(step_id === 'submit_form' || step_id === 'upload_docs' || step_id === 'submit_action') && (
        <div className="space-y-4">
          <div id="walkthrough-submit-form" className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#C2410C]" /> Informations propriété
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-gray-500">Type</dt><dd className="font-medium">Multilogement 6-24 logements</dd></div>
              <div><dt className="text-xs text-gray-500">Adresse</dt><dd className="font-medium">32 rue Est, Saint-Constant</dd></div>
              <div><dt className="text-xs text-gray-500">Logements</dt><dd className="font-medium">8</dd></div>
              <div><dt className="text-xs text-gray-500">Prix plancher</dt><dd className="font-bold text-[#C2410C]">800 000 $</dd></div>
              <div><dt className="text-xs text-gray-500">Revenus bruts</dt><dd className="font-medium">96 000 $</dd></div>
              <div><dt className="text-xs text-gray-500">Revenus nets</dt><dd className="font-medium">64 000 $</dd></div>
            </dl>
            <p className="text-xs text-gray-500 italic mt-3">
              Champs pré-remplis pour la démo. En mode normal, vous remplissez chaque section.
            </p>
          </div>

          <div id="walkthrough-upload-docs" className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#C2410C]" /> Documents requis
            </h2>
            <ul className="space-y-2 text-sm">
              {['Baux des 8 logements', 'Compte de taxes municipales', 'Certificat de localisation', 'Déclaration du vendeur'].map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {d}
                  <span className="ml-auto text-xs text-gray-400">déposé</span>
                </li>
              ))}
            </ul>
          </div>

          {step_id === 'submit_action' && (
            <button
              id="walkthrough-submit-btn"
              onClick={() => {
                onPushEmail(COURTIER_EMAILS.submission_received)
                toast.success('Soumission envoyée — en analyse par Logeo')
                goTo('analyse')
              }}
              className="btn-primary"
            >
              Soumettre à Logeo <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {step_id === 'analyse' && (
        <div id="walkthrough-analyse" className="card p-8 text-center">
          <Loader2 className="h-10 w-10 mx-auto text-[#EA580C] animate-spin mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Logeo analyse votre deal…</h2>
          <ul className="text-sm text-gray-700 space-y-2 max-w-sm mx-auto">
            {['Vérification financière', 'Validation marché', 'Évaluation des risques', 'Verdict GO ✓'].map((s, i) => (
              <li key={i} className={`flex items-center gap-2 transition-opacity ${analyseStage > i ? 'opacity-100' : 'opacity-30'}`}>
                {analyseStage > i ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step_id === 'teaser_published' && (
        <div id="walkthrough-teaser-published" className="card p-6 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <h2 className="font-bold text-emerald-900 flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5" /> Verdict GO · votre deal est publié
          </h2>
          <p className="text-sm text-emerald-800 mb-3">
            Le teaser anonyme est maintenant visible sur la marketplace. Les acheteurs
            qualifiés peuvent consulter les premiers indicateurs et signer un NDA pour
            accéder au dossier complet.
          </p>
          <div className="rounded-lg bg-white border border-gray-200 p-4 text-sm">
            <h3 className="font-semibold mb-1">Saint-Constant · Multilogement 6-24 logements</h3>
            <p className="text-xs text-gray-500">Montérégie · 8 logements · plancher 800 000 $ · TGA 8.0 %</p>
          </div>
        </div>
      )}

      {step_id === 'ndas_signing' && (
        <div id="walkthrough-ndas-counter" className="card p-8 text-center">
          <Users className="h-10 w-10 mx-auto text-[#EA580C] mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {state.fake_buyers_signed} NDA signés
          </h2>
          <p className="text-sm text-gray-600">Les acheteurs qualifiés découvrent votre dossier…</p>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-4 max-w-sm mx-auto">
            <div
              className="h-full bg-[#EA580C] transition-all duration-700"
              style={{ width: `${(state.fake_buyers_signed / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {step_id === 'bidding' && (
        <div id="walkthrough-bids-counter" className="card p-8 text-center">
          <Trophy className="h-10 w-10 mx-auto text-[#EA580C] mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Enchères en cours · {state.fake_buyers_bidding} mises
          </h2>
          <p className="text-3xl font-bold text-[#9A3412] mt-3">
            {formatMoney(state.current_price)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Prix actuel · proxy bid privé · anti-snipe automatique</p>
        </div>
      )}

      {step_id === 'auction_close' && (
        <div id="walkthrough-auction-close" className="card p-6 bg-emerald-50 border-emerald-200">
          <h2 className="font-bold text-emerald-900 flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5" /> Enchère fermée — gagnant identifié
          </h2>
          <ul className="text-sm text-emerald-800 space-y-1">
            <li>Prix final : <strong>920 000 $ CAD</strong></li>
            <li>Acheteurs qualifiés ayant signé un NDA : <strong>5</strong></li>
            <li>Mises placées : <strong>7</strong></li>
          </ul>
        </div>
      )}

      {step_id === 'introduction' && (
        <div id="walkthrough-introduction" className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#C2410C]" /> Introduction au gagnant
          </h2>
          <p className="text-sm text-gray-700 mb-3">
            Logeo vous transmet les coordonnées de l'acheteur retenu :
          </p>
          <dl className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-gray-500">Nom</dt><dd className="font-medium">Acheteur Démo</dd></div>
            <div><dt className="text-xs text-gray-500">Email</dt><dd className="font-medium">demo-acheteur@logeo.ca</dd></div>
            <div><dt className="text-xs text-gray-500">Téléphone</dt><dd className="font-medium">514-555-0199</dd></div>
            <div><dt className="text-xs text-gray-500">DD jusqu'au</dt><dd className="font-medium">{deadlineLabel()}</dd></div>
          </dl>
          {/* Push email at this step on mount */}
          <PushOnMount onPush={() => onPushEmail(COURTIER_EMAILS.introduction_winner)} />
        </div>
      )}

      {(step_id === 'awaiting_pa' || step_id === 'pa_signed') && (
        <div className="card p-5 bg-amber-50 border-amber-200">
          <h2 className="font-semibold text-amber-900 flex items-center gap-2 mb-2">
            <Hourglass className="h-4 w-4" /> Promesse d'achat (hors plateforme)
          </h2>
          <p className="text-sm text-amber-800 mb-3">
            Vous rédigez et faites signer la PA selon vos pratiques habituelles.
            Logeo n'intervient pas dans cette étape. Une fois signée, notifiez Logeo
            pour déclencher le paiement Interac de l'acheteur.
          </p>
          <button
            id="walkthrough-pa-signed-btn"
            onClick={() => {
              onPushEmail(COURTIER_EMAILS.pa_signed)
              toast.success('PA marquée signée — acheteur notifié pour le paiement')
              goTo('paid')
            }}
            className="btn-primary"
          >
            Simuler : la PA est signée
          </button>
        </div>
      )}

      {step_id === 'paid' && (
        <div id="walkthrough-paid" className="card p-6 bg-emerald-50 border-emerald-200">
          <h2 className="font-bold text-emerald-900 flex items-center gap-2 mb-2">
            <Receipt className="h-5 w-5" /> Paiement reçu · deal finalisé
          </h2>
          <p className="text-sm text-emerald-800">
            Le virement Interac de l'acheteur (9 200 $ CAD) a été reçu et confirmé par
            Logeo. Le deal est officiellement clos.
          </p>
          <PushOnMount onPush={() => onPushEmail(COURTIER_EMAILS.deal_finalized)} />
        </div>
      )}

      {step_id === 'completed' && (
        <div id="walkthrough-completed" className="card p-8 bg-gradient-to-br from-emerald-50 to-white border-emerald-200 text-center">
          <div className="h-14 w-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Deal conclu 🎯</h2>
          <p className="text-sm text-gray-700 mb-5 max-w-md mx-auto">
            De la soumission à la finalisation : moins de deux semaines. Sur la vraie
            plateforme, c'est exactement comme ça que ça se passe.
          </p>
          <Link to="/register/courtier" className="btn-primary">
            M'inscrire comme courtier <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

// Helper qui pousse un email exactement une fois quand un step est monté.
function PushOnMount({ onPush }) {
  useEffect(() => {
    onPush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function deadlineLabel() {
  const d = new Date()
  d.setDate(d.getDate() + 5)
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' })
}

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)
