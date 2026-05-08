import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'

import Login from './pages/auth/Login'
import RegisterCourtier from './pages/auth/RegisterCourtier'
import RegisterAcheteur from './pages/auth/RegisterAcheteur'
import VerifyEmail from './pages/auth/VerifyEmail'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDeals from './pages/admin/AdminDeals'
import AdminDealDetail from './pages/admin/AdminDealDetail'
import AdminMarketplace from './pages/admin/AdminMarketplace'
import AdminPayments from './pages/admin/AdminPayments'
import AdminSanctions from './pages/admin/AdminSanctions'
import AdminRevenues from './pages/admin/AdminRevenues'

import CourtierDashboard from './pages/courtier/CourtierDashboard'
import SubmitDeal from './pages/courtier/SubmitDeal'
import CourtierDealDetail from './pages/courtier/CourtierDealDetail'
import CourtierMarketplace from './pages/courtier/CourtierMarketplace'
import Convention from './pages/courtier/Convention'

import AcheteurDashboard from './pages/acheteur/AcheteurDashboard'
import DealList from './pages/acheteur/DealList'
import DealDetail from './pages/acheteur/DealDetail'
import PaiementPage from './pages/acheteur/PaiementPage'
import MesEncheres from './pages/acheteur/MesEncheres'

import Profile from './pages/common/Profile'

// PAUSÉ : Leaderboard désactivé en UI. Code conservé pour réactivation rapide.
// import Leaderboard from './pages/public/Leaderboard'
import AcheteurPublic from './pages/public/AcheteurPublic'
import Marketplace from './pages/public/Marketplace'
import HowItWorks from './pages/public/HowItWorks'
import DealPublic from './pages/public/DealPublic'
import PublicLayout from './components/layout/PublicLayout'

function ProtectedRoute({ roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

function RoleRedirect() {
  const { user } = useAuth()
  // Si pas connecté → page de connexion (split orange/blanc) sert de page d'accueil
  if (!user) return <Login />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'courtier') return <Navigate to="/courtier" replace />
  return <Navigate to="/acheteur" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        {/* /login → redirige vers / (page d'accueil = login split orange/blanc) */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register/courtier" element={<RegisterCourtier />} />
        <Route path="/register/acheteur" element={<RegisterAcheteur />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/" element={<RoleRedirect />} />

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/marketplace" element={<AdminMarketplace />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/deals" element={<AdminDeals />} />
            <Route path="/admin/deals/:dealId" element={<AdminDealDetail />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/sanctions" element={<AdminSanctions />} />
            <Route path="/admin/revenus" element={<AdminRevenues />} />
          </Route>
        </Route>

        {/* Courtier */}
        <Route element={<ProtectedRoute roles={['courtier']} />}>
          <Route element={<Layout />}>
            <Route path="/courtier" element={<CourtierDashboard />} />
            <Route path="/courtier/marketplace" element={<CourtierMarketplace />} />
            <Route path="/courtier/submit" element={<SubmitDeal />} />
            <Route path="/courtier/deals/:dealId" element={<CourtierDealDetail />} />
            <Route path="/courtier/convention" element={<Convention />} />
          </Route>
        </Route>

        {/* Acheteur */}
        <Route element={<ProtectedRoute roles={['acheteur']} />}>
          <Route element={<Layout />}>
            <Route path="/acheteur" element={<AcheteurDashboard />} />
            <Route path="/acheteur/deals" element={<DealList />} />
            <Route path="/acheteur/deals/:dealId" element={<DealDetail />} />
            <Route path="/acheteur/paiement" element={<PaiementPage />} />
            <Route path="/acheteur/mes-encheres" element={<MesEncheres />} />
            {/* Alias pour l'ancien lien */}
            <Route path="/acheteur/payment-method" element={<Navigate to="/acheteur/paiement" replace />} />
          </Route>
        </Route>

        {/* Profil — accessible à tous les rôles authentifiés */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/profil" element={<Profile />} />
          </Route>
        </Route>

        {/* Pages publiques (pas d'auth requise) */}
        <Route element={<PublicLayout />}>
          <Route path="/marketplace" element={<Marketplace />} />
          {/* PAUSÉ : Leaderboard désactivé. Catch-all `*` (plus bas) redirige /leaderboard vers /. */}
          {/* <Route path="/leaderboard" element={<Leaderboard />} /> */}
          <Route path="/acheteur/:id" element={<AcheteurPublic />} />
          <Route path="/comment-ca-marche" element={<HowItWorks />} />
          <Route path="/deals/:id" element={<DealPublic />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
