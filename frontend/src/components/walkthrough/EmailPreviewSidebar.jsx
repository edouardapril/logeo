import { useState, useEffect, useRef } from 'react'
import { Mail, X, ChevronRight, ChevronLeft } from 'lucide-react'

// LOTPLOT 23 → 26 — Sidebar des emails preview du walkthrough.
//
// Layouts :
//   - Desktop ≥ 1024px : panneau à droite (data-walkthrough-sidebar)
//       * collapsed = false → 360px de large, liste des emails
//       * collapsed = true  → bande verticale 48px, juste l'icône + badge
//       Toggle persisté en localStorage. Default basé sur le viewport
//       (≥1280px = ouvert, sinon réduit). LOTPLOT 26 fix #1 + #2.
//   - Mobile < 1024px : FAB en bas-droite qui ouvre une bottom-sheet.
//
// LOTPLOT 26 fix #3 : prop `autoCollapse` qui force le panneau réduit
// quand le walkthrough atteint la dernière étape, pour ne pas masquer
// les CTAs finaux ("Retour à l'accueil", "M'inscrire").

const STORAGE_KEY = 'logeo_walkthrough_email_panel_collapsed'

function getInitialCollapsed() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === '1'
  } catch {}
  // Pas de préférence stockée → décide selon largeur viewport.
  // ≥ 1280px : ouvert (place suffisante côté principal).
  // < 1280px : réduit (le contenu principal a besoin de toute la place).
  if (typeof window === 'undefined') return false
  return window.innerWidth < 1280
}

export default function EmailPreviewSidebar({ emails, onMarkRead, autoCollapse = false }) {
  const [openOnMobile, setOpenOnMobile] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [pulse, setPulse] = useState(false)
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)

  // Pulse à chaque nouvel email
  useEffect(() => {
    if (emails.length === 0) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 1200)
    return () => clearTimeout(t)
  }, [emails.length])

  // Persiste le toggle desktop
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {}
  }, [collapsed])

  // LOTPLOT 26 fix #3 — auto-collapse quand le flow atteint l'étape finale.
  // On ne bascule QUE de ouvert→réduit (pas l'inverse) : si l'utilisateur
  // a ré-ouvert manuellement, on respecte sa décision.
  const prevAutoCollapseRef = useRef(autoCollapse)
  useEffect(() => {
    if (autoCollapse && !prevAutoCollapseRef.current && !collapsed) {
      setCollapsed(true)
    }
    prevAutoCollapseRef.current = autoCollapse
  }, [autoCollapse, collapsed])

  const unread = emails.filter(e => !e.read).length

  // ── Desktop ──
  // L'aside garde toujours `data-walkthrough-sidebar` pour que TutorialOverlay
  // mesure dynamiquement sa largeur réelle (48 ou 360px) et clamp les tooltips
  // hors de cette zone (LOTPLOT 25).
  const Desktop = (
    <aside
      data-walkthrough-sidebar
      className={`hidden lg:flex flex-col fixed right-0 top-0 bottom-0 bg-white border-l border-gray-200 shadow-md z-[45] transition-[width] duration-200 ease-out ${
        collapsed ? 'w-12' : 'w-[360px]'
      }`}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="h-full flex flex-col items-center gap-3 py-4 px-1 hover:bg-gray-50 transition-colors"
          aria-label="Ouvrir le panneau email"
          title="Ouvrir le panneau email"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
          <Mail className={`h-5 w-5 text-[#EA580C] ${pulse ? 'animate-bounce' : ''}`} />
          {unread > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EA580C] text-white">
              {unread}
            </span>
          )}
          <span
            className="text-[10px] uppercase tracking-wider text-gray-500 mt-2"
            style={{ writingMode: 'vertical-rl' }}
          >
            Emails
          </span>
        </button>
      ) : (
        <>
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className={`h-5 w-5 text-[#EA580C] flex-shrink-0 ${pulse ? 'animate-bounce' : ''}`} />
              <h2 className="font-semibold text-gray-900 truncate">Emails reçus</h2>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {unread > 0 && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#EA580C] text-white">
                  {unread} nouveau{unread > 1 ? 'x' : ''}
                </span>
              )}
              <button
                onClick={() => setCollapsed(true)}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                aria-label="Réduire le panneau"
                title="Réduire le panneau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <EmailList
            emails={emails}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onMarkRead={onMarkRead}
          />
        </>
      )}
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
