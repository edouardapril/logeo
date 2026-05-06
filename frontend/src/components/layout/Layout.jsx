import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, LogOut, Plus, Search,
  CreditCard, Receipt, UserCircle, ShieldOff,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Logo from '../ui/Logo'

const NAV_BY_ROLE = {
  admin: [
    { to: '/admin',           label: 'Tableau de bord',   icon: LayoutDashboard },
    { to: '/admin/deals',     label: 'Deals',             icon: Building2 },
    { to: '/admin/users',     label: 'Utilisateurs',      icon: Users },
    { to: '/admin/payments',  label: 'Paiements',         icon: Receipt },
    { to: '/admin/sanctions', label: 'Sanctions',         icon: ShieldOff },
  ],
  courtier: [
    { to: '/courtier',         label: 'Mes deals',         icon: Building2 },
    { to: '/courtier/submit',  label: 'Soumettre un deal', icon: Plus },
  ],
  acheteur: [
    { to: '/acheteur/deals',    label: 'Deals disponibles', icon: Search },
    { to: '/acheteur/paiement', label: 'Paiement',          icon: CreditCard },
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
  const roleItems = NAV_BY_ROLE[user?.role] || []

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
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-[#1A1A1A] text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <Logo size="sm" className="text-white" />
          <p className="mt-2 text-xs text-white/60">{ROLE_LABEL[user?.role]}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {roleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/courtier'}
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
        <div className="max-w-7xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
