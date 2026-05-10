import { Eye, Search, FileText, ArrowRight } from 'lucide-react'

// LOTPLOT 23 — Modal d'entrée du walkthrough. Rendu en plein écran (fixed
// inset-0) plutôt que via le wrapper Modal standard, parce qu'on veut bloquer
// complètement l'interaction avec la page derrière jusqu'au choix de rôle.

export default function RoleSelectionModal({ onSelect, onQuit }) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 md:p-10 relative">
        <button
          onClick={onQuit}
          className="absolute top-4 right-4 text-xs text-gray-500 hover:text-gray-900 underline"
          aria-label="Quitter la démo"
        >
          Quitter la démo
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-full bg-[#FED7AA] items-center justify-center mb-3">
            <Eye className="h-6 w-6 text-[#EA580C]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur la démo Logeo
          </h1>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">
            Choisissez votre rôle pour vivre l'expérience comme si vous étiez sur la
            vraie plateforme. Aucune inscription requise — tout est simulé en local.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onSelect('acheteur')}
            className="group text-left p-6 rounded-xl border-2 border-gray-200 hover:border-[#EA580C] hover:bg-[#FFF7ED] active:bg-[#FFEDD5] transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-[#FFEDD5] flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-[#C2410C]" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Je suis un acheteur potentiel</h3>
            <p className="text-sm text-gray-600 mb-4">
              Découvrez comment trouver des deals off-market, signer un NDA, enchérir,
              gagner et finaliser un achat.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#EA580C]">
              Commencer le parcours acheteur
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={() => onSelect('courtier')}
            className="group text-left p-6 rounded-xl border-2 border-gray-200 hover:border-[#EA580C] hover:bg-[#FFF7ED] active:bg-[#FFEDD5] transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-[#FFEDD5] flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-[#C2410C]" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Je suis un courtier</h3>
            <p className="text-sm text-gray-600 mb-4">
              Découvrez comment soumettre un deal off-market, le faire valider, attirer
              des acheteurs et conclure une vente.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#EA580C]">
              Commencer le parcours courtier
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          Vous pourrez changer de rôle à tout moment depuis le bandeau supérieur.
        </p>
      </div>
    </div>
  )
}
