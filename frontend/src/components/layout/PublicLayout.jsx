import { Link, Outlet } from 'react-router-dom'
import Logo from '../ui/Logo'
import { useAuth } from '../../contexts/AuthContext'

export default function PublicLayout() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-[#1A1A1A]">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/marketplace" className="text-gray-700 hover:text-[#EA580C] font-medium">
              Marketplace
            </Link>
            <Link to="/leaderboard" className="text-gray-700 hover:text-[#EA580C] font-medium">
              Leaderboard
            </Link>
            {user ? (
              <Link to="/" className="btn-primary text-xs">Mon espace</Link>
            ) : (
              <Link to="/login" className="btn-primary text-xs">Se connecter</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
