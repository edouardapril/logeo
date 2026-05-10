import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Eye, ShieldCheck, Trophy, MessageSquare, Calendar,
  AlertCircle, X,
} from 'lucide-react'
import { publicSampleDealApi } from '../../api/public'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import DealHero from '../../components/deal/DealHero'
import DealFiche from '../../components/deal/DealFiche'

// LOTPLOT 21 — Page publique consultable sans login. Le visiteur voit le
// dossier complet (adresse, courtier, financiers, photos HD), mais toute
// action métier (NDA, bid, question, visite) est interceptée vers /signup.

const ACTION_COPY = {
  nda: {
    title: "Inscrivez-vous pour signer le NDA",
    body: "Le NDA Logeo est juridiquement contraignant et exige un compte qualifié. Créez le vôtre en quelques minutes pour accéder à des dossiers réels et participer aux enchères.",
  },
  bid: {
    title: "Inscrivez-vous pour faire une offre",
    body: "Les enchères sont réservées aux acheteurs qualifiés par l'équipe Logeo. Inscription en moins de 2 minutes ; qualification sous 24 h.",
  },
  question: {
    title: "Inscrivez-vous pour poser une question",
    body: "Toutes les Q&R sont visibles par les acheteurs ayant signé le NDA — transparence totale. Créez votre compte pour échanger directement avec les courtiers.",
  },
  visit: {
    title: "Inscrivez-vous pour demander une visite",
    body: "Les visites physiques sont coordonnées par le courtier après signature du NDA. Inscription gratuite et rapide.",
  },
}

function SampleBanner() {
  return (
    <div className="bg-[#9A3412] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            <span className="hidden sm:inline">MODE EXEMPLE — </span>
            Vous consultez un deal fictif. Inscrivez-vous pour participer à de vrais deals.
          </p>
        </div>
        <Link
          to="/register/acheteur"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#9A3412] text-xs font-bold hover:bg-orange-50"
        >
          Créer mon compte →
        </Link>
      </div>
    </div>
  )
}

function SignupCtaModal({ open, action, onClose }) {
  const navigate = useNavigate()
  if (!action) return null
  const copy = ACTION_COPY[action]
  return (
    <Modal open={open} onClose={onClose} title={copy.title} size="md">
      <div className="space-y-4 text-sm">
        <p className="text-gray-700 leading-relaxed">{copy.body}</p>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          Vous consultez un <strong>deal fictif</strong> — aucune action n'est possible
          sur cet exemple. Sur les deals réels, cette action ouvrirait le flow normal.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Continuer la visite</button>
          <button
            onClick={() => navigate('/register/acheteur')}
            className="btn-primary"
          >
            Créer mon compte acheteur
          </button>
          <button
            onClick={() => navigate('/register/courtier')}
            className="btn-secondary text-xs"
            title="Inscription côté courtier (vendeur)"
          >
            …ou courtier
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function SampleDealPage() {
  const [interceptedAction, setInterceptedAction] = useState(null)

  const { data: deal, isLoading, error } = useQuery({
    queryKey: ['public', 'sample-deal'],
    queryFn: publicSampleDealApi,
    retry: false,
  })

  if (isLoading) {
    return (
      <>
        <SampleBanner />
        <div className="max-w-6xl mx-auto px-4 py-12">
          <Spinner label="Chargement du deal exemple..." />
        </div>
      </>
    )
  }

  if (error || !deal) {
    return (
      <>
        <SampleBanner />
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="card p-6 bg-amber-50 border-amber-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Aucun deal exemple disponible</p>
              <p className="text-xs text-amber-800 mt-1">
                {error?.response?.data?.detail ||
                  "Le deal exemple n'a pas encore été configuré. Si vous êtes admin, exécutez `python -m app.seeds.sample_deal`."}
              </p>
            </div>
          </div>
          <Link to="/" className="mt-6 inline-flex items-center gap-1 text-sm link-brand">
            <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
          </Link>
        </div>
      </>
    )
  }

  const intercept = (action) => () => setInterceptedAction(action)

  return (
    <>
      <SampleBanner />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Link>

        {/* Hero — mode exemple : pas de timer réel ni de prix fluctuant */}
        <DealHero deal={deal} hideAuctionBlock />

        {/* Fiche complète — toutes les permissions débloquées comme post-NDA.
            C'est l'avantage du sample : on ne cache rien pour permettre au
            prospect de voir l'expérience complète. */}
        <DealFiche
          deal={deal}
          permissions={{
            canSeeAddress: true,
            canSeeFinancials: true,
            canSeePhotos: true,
            canSeeCourtier: true,
            canSeeDocuments: true,
            canSeeAdminMeta: false,
          }}
        />

        {/* CTA actions interceptées — placés après la fiche pour qu'on puisse
            les essayer depuis le bas, avec une explication "essayez-les". */}
        <div className="card p-6 mt-8 bg-gradient-to-br from-[#FFEDD5] to-white border-[#FDBA74]">
          <h2 className="font-bold text-gray-900 text-lg mb-2">
            Sur un vrai deal, voici les actions disponibles
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            Cliquez pour voir ce qu'il se passerait — vous serez invité à créer
            votre compte pour vraiment effectuer l'action.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={intercept('nda')}
              className="card p-4 text-left hover:border-[#FDBA74] transition-all flex items-start gap-3"
            >
              <ShieldCheck className="h-5 w-5 text-[#C2410C] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Signer le NDA</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Accède au dossier complet (adresse, baux, courtier).
                </p>
              </div>
            </button>
            <button
              onClick={intercept('bid')}
              className="card p-4 text-left hover:border-[#FDBA74] transition-all flex items-start gap-3"
            >
              <Trophy className="h-5 w-5 text-[#C2410C] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Faire une offre</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Proxy bid anonyme, anti-snipe automatique.
                </p>
              </div>
            </button>
            <button
              onClick={intercept('question')}
              className="card p-4 text-left hover:border-[#FDBA74] transition-all flex items-start gap-3"
            >
              <MessageSquare className="h-5 w-5 text-[#C2410C] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Poser une question</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Q&R publique pour tous les acheteurs ayant signé.
                </p>
              </div>
            </button>
            <button
              onClick={intercept('visit')}
              className="card p-4 text-left hover:border-[#FDBA74] transition-all flex items-start gap-3"
            >
              <Calendar className="h-5 w-5 text-[#C2410C] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Demander une visite</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Coordonnée directement par le courtier.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-8 mb-6 text-center">
          <p className="text-sm text-gray-700 mb-3">
            Prêt à voir les vrais deals off-market ?
          </p>
          <Link to="/register/acheteur" className="btn-primary">
            Créer mon compte acheteur →
          </Link>
        </div>
      </div>

      <SignupCtaModal
        open={!!interceptedAction}
        action={interceptedAction}
        onClose={() => setInterceptedAction(null)}
      />
    </>
  )
}
