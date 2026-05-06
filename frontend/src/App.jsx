import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'

import Login from './pages/auth/Login'
import RegisterCourtier from './pages/auth/RegisterCourtier'
import RegisterAcheteur from './pages/auth/RegisterAcheteur'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDeals from './pages/admin/AdminDeals'
import AdminDealDetail from './pages/admin/AdminDealDetail'
import AdminPayments from './pages/admin/AdminPayments'
import AdminSanctions from './pages/admin/AdminSanctions'

import CourtierDashboard from './pages/courtier/CourtierDashboard'
import SubmitDeal from './pages/courtier/SubmitDeal'
import CourtierDealDetail from './pages/courtier/CourtierDealDetail'
import Convention from './pages/courtier/Convention'

import DealList from './pages/acheteur/DealList'
import DealDetail from './pages/acheteur/DealDetail'
import PaiementPage from './pages/acheteur/PaiementPage'

import Profile from './pages/common/Profile'

import Leaderboard from './pages/public/Leaderboard'
import AcheteurPublic from './pages/public/AcheteurPublic'
import PublicLayout from './components/layout/PublicLayout'

function ProtectedRoute({ roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'courtier') return <Navigate to="/courtier" replace />
  return <Navigate to="/acheteur/deals" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register/courtier" element={<RegisterCourtier />} />
        <Route path="/register/acheteur" element={<RegisterAcheteur />} />
        <Route path="/" element={<RoleRedirect />} />

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/deals" element={<AdminDeals />} />
            <Route path="/admin/deals/:dealId" element={<AdminDealDetail />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/sanctions" element={<AdminSanctions />} />
          </Route>
        </Route>

        {/* Courtier */}
        <Route element={<ProtectedRoute roles={['courtier']} />}>
          <Route element={<Layout />}>
            <Route path="/courtier" element={<CourtierDashboard />} />
            <Route path="/courtier/submit" element={<SubmitDeal />} />
            <Route path="/courtier/deals/:dealId" element={<CourtierDealDetail />} />
            <Route path="/courtier/convention" element={<Convention />} />
          </Route>
        </Route>

        {/* Acheteur */}
        <Route element={<ProtectedRoute roles={['acheteur']} />}>
          <Route element={<Layout />}>
            <Route path="/acheteur/deals" element={<DealList />} />
            <Route path="/acheteur/deals/:dealId" element={<DealDetail />} />
            <Route path="/acheteur/paiement" element={<PaiementPage />} />
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
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/acheteur/:id" element={<AcheteurPublic />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
