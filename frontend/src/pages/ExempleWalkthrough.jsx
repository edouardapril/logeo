import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RefreshCw, LogOut, UserCog } from 'lucide-react'
import RoleSelectionModal from '../components/walkthrough/RoleSelectionModal'
import EmailPreviewSidebar from '../components/walkthrough/EmailPreviewSidebar'
import ProgressTracker from '../components/walkthrough/ProgressTracker'
import AcheteurFlow, { ACHETEUR_STEPS } from '../components/walkthrough/AcheteurFlow'
import CourtierFlow, { COURTIER_STEPS } from '../components/walkthrough/CourtierFlow'
import {
  readState, initState, clearState, patchState, pushEmail, markEmailRead,
  DEFAULT_WALKTHROUGH_STATE,
} from '../utils/walkthroughState'
import { clearWalkthroughToasts } from '../utils/walkthroughToast'

// LOTPLOT 23 — Page orchestrator du walkthrough /exemple.
// Gère le state machine de haut niveau : sélection de rôle, persistance
// sessionStorage, bandeau MODE EXEMPLE, ProgressTracker, EmailPreviewSidebar,
// et délégation au flow correspondant (AcheteurFlow ou CourtierFlow).

export default function ExempleWalkthrough() {
  const navigate = useNavigate()

  // Initialise depuis sessionStorage (ou défaut). Si state corrompu, on
  // tombe sur DEFAULT_WALKTHROUGH_STATE et on affichera le RoleSelectionModal.
  const [state, setState] = useState(() => readState() || { ...DEFAULT_WALKTHROUGH_STATE })

  const onPatch = (patch) => setState(prev => patchState(prev, patch))
  const onPushEmail = (email) => setState(prev => pushEmail(prev, email))
  const onMarkRead = (emailId) => setState(prev => markEmailRead(prev, emailId))

  const onSelectRole = (role) => {
    setState(initState(role))
  }

  const onRestart = () => {
    if (window.confirm('Recommencer la démo ? Votre progression actuelle sera effacée.')) {
      clearState()
      clearWalkthroughToasts()
      setState({ ...DEFAULT_WALKTHROUGH_STATE })
    }
  }

  const onChangeRole = () => {
    if (window.confirm('Changer de rôle ? Votre progression actuelle sera effacée.')) {
      clearState()
      clearWalkthroughToasts()
      setState({ ...DEFAULT_WALKTHROUGH_STATE })
    }
  }

  const onQuit = () => {
    if (window.confirm('Quitter la démo et retourner à l\'accueil ?')) {
      clearState()
      clearWalkthroughToasts()
      navigate('/')
    }
  }

  const steps = useMemo(() => {
    if (state.role === 'courtier') return COURTIER_STEPS
    if (state.role === 'acheteur') return ACHETEUR_STEPS
    return []
  }, [state.role])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bandeau persistant MODE EXEMPLE */}
      <div className="bg-[#9A3412] text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="h-4 w-4 flex-shrink-0" />
            <p className="text-xs font-medium truncate">
              <span className="hidden sm:inline">MODE EXEMPLE — </span>
              Walkthrough Logeo · {state.role ? roleLabel(state.role) : 'sélection en cours'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {state.role && (
              <button
                onClick={onChangeRole}
                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
                title="Changer de rôle"
              >
                <UserCog className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rôle</span>
              </button>
            )}
            {state.role && (
              <button
                onClick={onRestart}
                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
                title="Recommencer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Recommencer</span>
              </button>
            )}
            <button
              onClick={onQuit}
              className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
              title="Quitter la démo"
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>
      </div>

      {/* ProgressTracker — affiché seulement si rôle choisi */}
      {state.role && (
        <ProgressTracker steps={steps} currentIndex={state.step_index} />
      )}

      {/* RoleSelectionModal — affiché tant que le rôle n'est pas sélectionné */}
      {!state.role && (
        <RoleSelectionModal onSelect={onSelectRole} onQuit={onQuit} />
      )}

      {/* Layout principal — flow + sidebar */}
      {state.role && (
        <div className="max-w-6xl mx-auto px-4 py-6 lg:pr-[392px]">
          {state.role === 'acheteur' && (
            <AcheteurFlow state={state} onPatch={onPatch} onPushEmail={onPushEmail} />
          )}
          {state.role === 'courtier' && (
            <CourtierFlow state={state} onPatch={onPatch} onPushEmail={onPushEmail} />
          )}
        </div>
      )}

      {/* Sidebar emails — visible dès qu'un rôle est choisi */}
      {state.role && (
        <EmailPreviewSidebar
          emails={state.emails_received}
          onMarkRead={onMarkRead}
        />
      )}
    </div>
  )
}

function roleLabel(role) {
  return role === 'acheteur' ? 'parcours acheteur' : 'parcours courtier'
}
