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
            <Link to="/marketplace" className="text-gray-700 hover:text-[#EA580C] font-medium hidden sm:inline">
              Marketplace
            </Link>
            <Link to="/comment-ca-marche" className="text-gray-700 hover:text-[#EA580C] font-medium hidden sm:inline">
              Comment ça marche
            </Link>
            {/* PAUSÉ : lien Leaderboard masqué dans le header public, code conservé pour réactivation
            <Link to="/leaderboard" className="text-gray-700 hover:text-[#EA580C] font-medium hidden md:inline">
              Leaderboard
            </Link>
            */}
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
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Logeo · Marketplace immobilière off-market au Québec</p>
          <nav className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-[#EA580C]">Termes et conditions</Link>
            <Link to="/privacy" className="hover:text-[#EA580C]">Politique de confidentialité</Link>
            <a href="mailto:contact@logeo.ca" className="hover:text-[#EA580C]">contact@logeo.ca</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
