import { useState, useEffect } from 'react'
import { Mail, X, ChevronRight } from 'lucide-react'

// LOTPLOT 23 — Sidebar des emails preview du walkthrough.
// - Desktop : panneau à droite, 360px de large, fixe
// - Mobile : bouton flottant en bas-droite qui ouvre une bottom-sheet
// - Chaque arrivée d'email fait pulse l'icône + badge "+N nouveaux"

export default function EmailPreviewSidebar({ emails, onMarkRead }) {
  const [openOnMobile, setOpenOnMobile] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [pulse, setPulse] = useState(false)

  // Pulse à chaque nouvel email
  useEffect(() => {
    if (emails.length === 0) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 1200)
    return () => clearTimeout(t)
  }, [emails.length])

  const unread = emails.filter(e => !e.read).length

  // ── Desktop ──
  const Desktop = (
    // LOTPLOT 24 : z-45 pour passer au-dessus du dim TutorialOverlay (z-30)
    // sans chevaucher la tooltip (z-50). Permet à l'utilisateur de lire
    // ses emails et cliquer dessus pendant qu'un tooltip est actif.
    // LOTPLOT 25 : `data-walkthrough-sidebar` permet à TutorialOverlay de
    // mesurer dynamiquement la zone occupée et d'éviter de placer la tooltip
    // dessous (sinon le texte est tronqué derrière le panel email).
    <aside data-walkthrough-sidebar className="hidden lg:flex flex-col fixed right-0 top-0 bottom-0 w-[360px] bg-white border-l border-gray-200 shadow-md z-[45]">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className={`h-5 w-5 text-[#EA580C] ${pulse ? 'animate-bounce' : ''}`} />
          <h2 className="font-semibold text-gray-900">Emails reçus</h2>
        </div>
        {unread > 0 && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#EA580C] text-white">
            {unread} nouveau{unread > 1 ? 'x' : ''}
          </span>
        )}
      </div>
      <EmailList
        emails={emails}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        onMarkRead={onMarkRead}
      />
    </aside>
  )

  // ── Mobile FAB + bottom-sheet ──
  const Mobile = (
    <>
      <button
        onClick={() => setOpenOnMobile(true)}
        className={`lg:hidden fixed bottom-4 right-4 z-[45] h-12 w-12 rounded-full bg-[#EA580C] text-white shadow-lg flex items-center justify-center ${pulse ? 'animate-bounce' : ''}`}
        aria-label="Ouvrir les emails"
      >
        <Mail className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {openOnMobile && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpenOnMobile(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] bg-white rounded-t-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#EA580C]" />
                <h2 className="font-semibold text-gray-900">Emails reçus</h2>
              </div>
              <button onClick={() => setOpenOnMobile(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <EmailList
              emails={emails}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              onMarkRead={onMarkRead}
            />
          </div>
        </div>
      )}
    </>
  )

  return <>{Desktop}{Mobile}</>
}

function EmailList({ emails, expandedId, setExpandedId, onMarkRead }) {
  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-gray-400">
        Les emails que vous recevriez s'afficheront ici au fur et à mesure du parcours.
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
      {[...emails].reverse().map(email => {
        const isExpanded = expandedId === email.id
        return (
          <div key={email.id} className={!email.read ? 'bg-[#FFF7ED]' : ''}>
            <button
              onClick={() => {
                setExpandedId(isExpanded ? null : email.id)
                if (!email.read) onMarkRead(email.id)
              }}
              className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-start gap-2"
            >
              <ChevronRight
                className={`h-4 w-4 text-gray-400 mt-1 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate">{email.from}</p>
                <p className={`text-sm truncate ${email.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                  {email.subject}
                  {email.count > 1 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                      ×{email.count}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(email.at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!email.read && (
                <span className="h-2 w-2 rounded-full bg-[#EA580C] mt-2 flex-shrink-0" aria-label="Non lu" />
              )}
            </button>
            {isExpanded && (
              <div className="px-5 pb-4">
                <div
                  className="rounded-lg overflow-hidden"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: email.body_html }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
