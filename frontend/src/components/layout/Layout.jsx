import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, LogOut, Plus, Search,
  CreditCard, Receipt, UserCircle, ShieldOff, Trophy, TrendingUp,
  Menu, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Logo from '../ui/Logo'

const NAV_BY_ROLE = {
  admin: [
    { to: '/admin',           label: 'Tableau de bord',   icon: LayoutDashboard },
    { to: '/admin/deals',     label: 'Deals',             icon: Building2 },
    { to: '/admin/users',     label: 'Utilisateurs',      icon: Users },
    { to: '/admin/payments',  label: 'Paiements',         icon: Receipt },
    { to: '/admin/revenus',   label: 'Revenus',           icon: TrendingUp },
    { to: '/admin/sanctions', label: 'Sanctions',         icon: ShieldOff },
  ],
  courtier: [
    { to: '/courtier',             label: 'Tableau de bord',   icon: LayoutDashboard },
    { to: '/courtier/marketplace', label: 'Marketplace',       icon: Search },
    { to: '/courtier/submit',      label: 'Soumettre un deal', icon: Plus },
  ],
  acheteur: [
    { to: '/acheteur',              label: 'Tableau de bord',   icon: LayoutDashboard },
    { to: '/acheteur/deals',        label: 'Deals disponibles', icon: Search },
    { to: '/acheteur/mes-encheres', label: 'Mes enchères',      icon: Trophy },
    { to: '/acheteur/paiement',     label: 'Paiement',          icon: CreditCard },
  ],
}

const COMMON_NAV = [
  { to: '/profil', label: 'Mon profil', icon: UserCircle },
]

const ROLE_LABEL = {
  admin: 'Admin Logeo',
  courtier: 'Courtier OACIQ',
  acheteur: 'Acheteur investisseur',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const roleItems = NAV_BY_ROLE[user?.role] || []
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Ferme la sidebar mobile à chaque navigation
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#EA580C] text-white'
        : 'text-white/70 hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="min-h-screen md:flex bg-gray-50">
      {/* Topbar mobile (caché >= md) */}
      <header className="md:hidden sticky top-0 z-30 bg-[#1A1A1A] text-white px-4 py-3 flex items-center justify-between border-b border-white/10">
        <Logo size="sm" className="text-white" />
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-white/80 hover:bg-white/10"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — off-canvas sur mobile, fixe sur desktop */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#1A1A1A] text-white
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        aria-hidden={!sidebarOpen}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <Logo size="sm" className="text-white" />
            <p className="mt-2 text-xs text-white/60">{ROLE_LABEL[user?.role]}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg text-white/70 hover:bg-white/10"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {roleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/courtier' || to === '/acheteur'}
              className={navClass}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}

          <div className="pt-2 mt-2 border-t border-white/10">
            {COMMON_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navClass}>
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
